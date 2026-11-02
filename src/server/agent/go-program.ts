import { goToolchain } from "../../contracts/go-runtime.ts";

// Fixed host program; source commands are never interpolated into a shell.
export const goBuildProgram = String.raw`const fs=require('node:fs'),path=require('node:path'),{createHash}=require('node:crypto'),{spawnSync}=require('node:child_process');
const plan=JSON.parse(process.argv[2]),values=JSON.parse(fs.readFileSync(0,'utf8'));let stage='cache';
const digest=bytes=>createHash('sha256').update(bytes).digest('hex');
function snapshot(root){const rows=[];function visit(folder){for(const name of fs.readdirSync(folder).sort()){const file=path.join(folder,name),stat=fs.lstatSync(file);if(stat.isSymbolicLink()||stat.isFile()&&stat.nlink!==1||!stat.isFile()&&!stat.isDirectory())throw Error('source file type changed');if(stat.isDirectory())visit(file);else rows.push([path.relative(root,file),digest(fs.readFileSync(file))])}}visit(root);return JSON.stringify(rows)}
function noDaemons(){for(const pid of fs.readdirSync('/proc')){if(!/^[0-9]+$/.test(pid)||Number(pid)===1||Number(pid)===process.pid)continue;try{const state=/^State:\s+([A-Z])/m.exec(fs.readFileSync('/proc/'+pid+'/status','utf8'));if(state?.[1]!=='Z')throw Error('unexpected background process after original Go tests')}catch(error){if(error.code!=='ENOENT')throw error}}}
const env={...Object.fromEntries(values.map(row=>[row.key,row.value])),PATH:'/work/go/bin:/usr/local/bin:/usr/bin:/bin',HOME:'/work',TMPDIR:'/work/tmp',GOROOT:'/work/go',GOPATH:'/work/gopath',GOCACHE:'/work/go-cache',GOMODCACHE:'/work/modules',GOTMPDIR:'/work/tmp',GOTOOLCHAIN:'local',GOWORK:'off',GOENV:'off',GO111MODULE:'on',GOPROXY:'file:///input/proxy',GOSUMDB:'off',GOPRIVATE:'',GONOPROXY:'',GONOSUMDB:'',CGO_ENABLED:'0',GOOS:'linux',GOARCH:'amd64',GOMAXPROCS:'2',GOTELEMETRY:'off'};
function command(args,timeout){const result=spawnSync('/work/go/bin/go',args,{cwd:'/work/project',env,encoding:'utf8',timeout,maxBuffer:1048576});if(result.error||result.status!==0||result.signal){process.stdout.write((result.stdout||'')+(result.stderr||''));throw Error('original Go command failed: '+args[0])}return result.stdout+result.stderr}
try{
const tool=fs.readFileSync('/go-toolchain.tar.gz');if(tool.length!==TOOL_BYTES||digest(tool)!=='TOOL_HASH')throw Error('Go toolchain bytes changed');
fs.mkdirSync('/work/tmp');fs.mkdirSync('/work/project');fs.cpSync('/source','/work/project',{recursive:true,dereference:false});const original=snapshot('/work/project');
const extracted=spawnSync('/bin/tar',['--no-same-owner','--no-same-permissions','-xzf','/go-toolchain.tar.gz','-C','/work'],{encoding:'utf8',timeout:20000,maxBuffer:8192});if(extracted.status!==0||extracted.error)throw Error('Go toolchain extraction failed');
const version=command(['version'],5000);if(version.trim()!=='go version goTOOL_VERSION linux/amd64')throw Error('Go toolchain version changed');console.log(version.trim());
stage='install';command(['mod','download'],60000);command(['mod','verify'],30000);if(snapshot('/work/project')!==original)throw Error('module installation changed original source or go.sum');
stage='test';const report=command(['test','-json','-count=1','-mod=readonly','-p=2','-timeout=30s','./...'],120000);const events=report.trim().split('\n').filter(Boolean).map(line=>JSON.parse(line));
process.stdout.write(report);if(events.some(event=>event.Action==='skip'||event.Action==='fail')||!events.some(event=>event.Action==='pass'&&typeof event.Test==='string'))throw Error('original Go tests were absent or skipped');
if(snapshot('/work/project')!==original)throw Error('original tests changed source or go.sum');
stage='build';fs.mkdirSync('/work/output');command(['build','-mod=readonly','-trimpath','-buildvcs=false','-p=2','-ldflags=-s -w','-o','/work/output/server',plan.runtime.packagePath],90000);if(snapshot('/work/project')!==original)throw Error('build changed original source or go.sum');
stage='workload';noDaemons();console.log('Launchlane: original Go tests, read-only module lock and compiled executable ready');
}catch(error){console.error('Launchlane Go check failed:',stage,error.message);process.exit({cache:74,install:71,test:76,build:72,workload:73}[stage]||75)}
`.replace("TOOL_BYTES", String(goToolchain.bytes)).replace("TOOL_HASH", goToolchain.sha256).replace("TOOL_VERSION", goToolchain.version);

// A second fresh worker sees only the final archive files: no compiler, module cache or build tree.
export const goRuntimeCheckProgram = String.raw`const fs=require('node:fs'),{spawn}=require('node:child_process'),{createHash}=require('node:crypto');
const plan=JSON.parse(process.argv[2]),values=JSON.parse(fs.readFileSync(0,'utf8')),base='/work/runtime';let child;
const digest=value=>createHash('sha256').update(value).digest('hex');
(async()=>{fs.cpSync('/input',base,{recursive:true,dereference:false});
const metadata=JSON.parse(fs.readFileSync(base+'/.launchlane-executable.json','utf8')),binding=metadata.verification;
const env={...Object.fromEntries(values.map(row=>[row.key,row.value])),PATH:'/usr/local/bin:/usr/bin:/bin',HOME:'/work',TMPDIR:'/work',PORT:String(plan.runtime.port)};
const prepared=require('node:child_process').spawnSync(process.execPath,[base+'/.launchlane-executable.cjs','materialize'],{env,encoding:'utf8',timeout:10000,maxBuffer:8192});if(prepared.status!==0||prepared.error)throw Error('compiled materialization failed');
const before=digest(fs.readFileSync(base+'/.launchlane-runtime/server'));child=spawn(process.execPath,[base+'/.launchlane-executable.cjs'],{env,stdio:['ignore','inherit','inherit']});
const origin='http://127.0.0.1:'+plan.port,deadline=Date.now()+30000;let matched=false;
while(Date.now()<deadline){if(child.exitCode!==null||child.signalCode)throw Error('production executable host exited');try{const response=await fetch(origin+plan.workload.path,{redirect:'manual',signal:AbortSignal.timeout(1500)});let size=0,parts=[];for await(const part of response.body){size+=part.length;if(size>65536)throw Error('response limit');parts.push(Buffer.from(part))}const body=Buffer.concat(parts).toString('utf8'),a=plan.workload.assertion;const json=a.kind==='json'?JSON.parse(body):null;const valid=a.kind==='text'?body.includes(a.contains):json&&Object.hasOwn(json,a.field)&&json[a.field]===a.equals;if(response.status===plan.workload.status&&valid){matched=true;break}}catch{}await new Promise(resolve=>setTimeout(resolve,100))}
if(!matched)throw Error('original compiled Go workload did not match');
const proof=await fetch(origin+'/launchlane-build-proof.json',{signal:AbortSignal.timeout(2000)});if(proof.status!==200||await proof.text()!==JSON.stringify({version:1,testedSourceHash:binding.testedSourceHash,planHash:binding.planHash,outputArtifactHash:binding.outputArtifactHash})+'\n')throw Error('compiled proof mismatch');
if(before!==digest(fs.readFileSync(base+'/.launchlane-runtime/server'))||child.exitCode!==null||child.signalCode)throw Error('compiled executable changed or exited');
console.log('Launchlane: fresh compiled Go runtime and original workload verified without compiler or build tree');
})().then(()=>{child?.kill();process.exit(0)}).catch(error=>{console.error('Launchlane Go runtime failed:',error.message);child?.kill();process.exit(73)});
`;
