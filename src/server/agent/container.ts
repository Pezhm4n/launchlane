import { spawn } from "node:child_process";
import { randomUUID } from "node:crypto";
import { AppError, ensure } from "../errors.ts";
import { parseProjectBuildPlan, projectBuildImage, type ProjectBuildPlan } from "../../contracts/project-build.ts";
import { object } from "../../contracts/validation.ts";
import { environmentVariables, isApplicationEnvironmentKey, type EnvironmentVariable } from "../../contracts/environment.ts";

import { htmlWorkloadByteLimit } from "../../contracts/deployment.ts";

export const node22Image = projectBuildImage;
export type CommandResult = { output: string; exitCode: number | null; signal: string | null };
export function docker(args: string[], signal: AbortSignal, maxBytes = 32768, input?: Buffer): Promise<CommandResult> {
  ensure(!signal.aborted, "CANCELLED", "اجرای ایزوله متوقف شد.", 409);
  return new Promise((resolve, reject) => {
    const child = spawn("docker", args, { windowsHide: true, stdio: ["pipe", "pipe", "pipe"] });
    child.stdin.on("error", () => undefined); child.stdin.end(input);
    let output = "", limited = false;
    const stop = () => child.kill();
    signal.addEventListener("abort", stop, { once: true });
    for (const pipe of [child.stdout, child.stderr]) pipe.on("data", (bytes: Buffer) => {
      output += bytes.toString("utf8");
      if (Buffer.byteLength(output) > maxBytes) { limited = true; child.kill(); }
    });
    child.once("error", () => {
      signal.removeEventListener("abort", stop);
      reject(new AppError("SANDBOX_UNAVAILABLE", "Docker این نصب برای اجرای ایزوله در دسترس نیست؛ هیچ script روی میزبان اجرا نشد.", 503));
    });
    child.once("close", (exitCode, killed) => {
      signal.removeEventListener("abort", stop);
      resolve({ output: output.slice(0, maxBytes), exitCode: limited || signal.aborted ? null : exitCode, signal: limited ? "OUTPUT_LIMIT" : killed });
    });
  });
}

export async function containerState(id: string) {
  const inspected = await docker(["inspect", "--format", "{{json .State}}", id], AbortSignal.timeout(5000), 4096);
  ensure(inspected.exitCode === 0, "SANDBOX_UNCERTAIN", "رسید پایان محیط ایزوله قابل بررسی نیست.", 409);
  const state = object(JSON.parse(inspected.output));
  ensure(state.Running === false && typeof state.OOMKilled === "boolean" && typeof state.ExitCode === "number" && Number.isInteger(state.ExitCode),
    "SANDBOX_UNCERTAIN", "محیط ایزوله پایان قطعی ندارد.", 409);
  return { exitCode: state.ExitCode, oom: state.OOMKilled };
}

// Source and dependencies never receive the Docker socket or host credentials. The only mount is read-only.
const testProgram = `const fs=require('node:fs'),{spawn}=require('node:child_process');
const watchdog=setTimeout(()=>process.exit(124),20000);
fs.cpSync('/source','/work/project',{recursive:true,dereference:false});
const child=spawn('/usr/local/bin/node',['--test-reporter=tap','--test','--',...process.argv.slice(1)],{
cwd:'/work/project',stdio:['ignore','pipe','pipe'],env:{PATH:'/usr/local/bin:/usr/bin:/bin',HOME:'/work',TMPDIR:'/work',NODE_ENV:'test'}});
child.stdout.pipe(process.stdout);child.stderr.pipe(process.stderr);
child.once('error',()=>process.exit(125));child.once('exit',code=>{clearTimeout(watchdog);process.exit(code??125)});`;

export async function runContainerTests(workspace: string, testFiles: readonly string[], signal: AbortSignal,
  onCreated?: (id: string) => void): Promise<CommandResult & { containerId: string; image: string }> {
  ensure(!workspace.includes(","), "SANDBOX_PATH_DENIED", "مسیر workspace برای mount ایزوله معتبر نیست.", 403);
  let id: string | null = null;
  try {
    const created = await docker(["create", "--pull=never", "--name", `launchlane-repair-${randomUUID()}`, "--label", "ir.launchlane.worker=scoped-test-v1",
      "--network", "none", "--read-only", "--cap-drop", "ALL", "--security-opt", "no-new-privileges", "--user", "1000:1000",
      "--cpus", "1", "--memory", "256m", "--memory-swap", "256m", "--pids-limit", "64",
      "--tmpfs", "/work:rw,nosuid,nodev,size=67108864,uid=1000,gid=1000,mode=0700",
      "--mount", `type=bind,source=${workspace},target=/source,readonly`, node22Image,
      "node", "-e", testProgram, "--", ...testFiles], signal, 4096);
    ensure(created.exitCode === 0 && /^[a-f0-9]{64}$/.test(created.output.trim()),
      "SANDBOX_UNAVAILABLE", "محیط ایزوله با image تأییدشده ایجاد نشد؛ script روی میزبان اجرا نشده است.", 503);
    id = created.output.trim();
    onCreated?.(id);
    const result = await docker(["start", "--attach", id], signal);
    const state = await containerState(id), stopped = result.signal ?? (state.oom ? "OOM" : null);
    return { ...result, signal: stopped, exitCode: signal.aborted || stopped ? null : state.exitCode, containerId: id, image: node22Image };
  } finally {
    // Only a full identity returned by this create is removable; never enumerate or stop other containers.
    if (id) {
      const removed = await docker(["rm", "--force", id], AbortSignal.timeout(5000), 4096);
      ensure(removed.exitCode === 0, "SANDBOX_CLEANUP_UNCONFIRMED", "پایان محیط همین آزمون تأیید نشد؛ رسید آن برای بررسی باقی می‌ماند.", 503);
    }
  }
}

// Read only executable/style references from bounded HTML, including normal unquoted HTML attributes.
export const frontendAssetProgram = String.raw`const frontendScriptMimes=new Set(['application/javascript','text/javascript','application/ecmascript','text/ecmascript']);
function frontendAssetMime(kind,value){const type=(value||'').split(';')[0].trim().toLowerCase();return kind==='style'?type==='text/css':kind==='script'&&frontendScriptMimes.has(type)}
function frontendAssets(html){
if(Buffer.byteLength(html)>65536)throw Error('frontend document limit');
const lower=html.replace(/[A-Z]/g,value=>value.toLowerCase()),references=[];let cursor=0,base=null,tags=0;
const space=value=>/[\t\n\f\r ]/.test(value||'');
const decode=value=>value.replace(/&(?:#(x[0-9a-f]+|[0-9]+);?|([a-z]+);)/gi,(whole,number,name)=>{if(number){const code=number[0].toLowerCase()==='x'?parseInt(number.slice(1),16):parseInt(number,10);if(code===0||code>1114111||code>=55296&&code<=57343)throw Error('invalid asset character reference');return String.fromCodePoint(code)}return ({amp:'&',quot:'"',apos:"'",lt:'<',gt:'>'})[name.toLowerCase()]||whole});
while(cursor<html.length){
const start=html.indexOf('<',cursor);if(start<0)break;
if(html.startsWith('<!--',start)){if(html[start+4]==='>'){cursor=start+5;continue}if(html.slice(start+4,start+6)==='->'){cursor=start+6;continue}
const normal=html.indexOf('-->',start+4),abrupt=html.indexOf('--!>',start+4),end=normal<0?abrupt:abrupt<0?normal:Math.min(normal,abrupt);
if(end<0)throw Error('incomplete frontend comment');cursor=end+(end===abrupt?4:3);continue}
let at=start+1;if(!/[a-z]/i.test(html[at]||'')){cursor=at;continue}
const nameStart=at;while(/[a-z0-9:-]/i.test(html[at]||''))at++;
const tag=lower.slice(nameStart,at),attributes=Object.create(null);let closed=false;
if(++tags>2048)throw Error('frontend tag limit');
while(at<html.length){
while(space(html[at]))at++;
if(html[at]==='>'){at++;closed=true;break}
if(html[at]==='/'&&html[at+1]==='>'){at+=2;closed=true;break}
const attributeStart=at;while(at<html.length&&!space(html[at])&&!/[=/> <]/.test(html[at]))at++;
if(at===attributeStart){at++;continue}
const name=lower.slice(attributeStart,at);while(space(html[at]))at++;
let value='';if(html[at]==='='){at++;while(space(html[at]))at++;const quote=html[at];
if(quote==='"'||quote==="'"){const valueStart=++at;while(at<html.length&&html[at]!==quote)at++;value=html.slice(valueStart,at);if(at<html.length)at++}
else{const valueStart=at;while(at<html.length&&!space(html[at])&&html[at]!=='>')at++;value=html.slice(valueStart,at)}}
if(!Object.hasOwn(attributes,name))attributes[name]=value;
}
cursor=at;if(!closed)throw Error('incomplete frontend tag');
if(tag==='base'&&base===null&&Object.hasOwn(attributes,'href'))base=decode(attributes.href);
const scriptType=(attributes.type||'').trim().toLowerCase().split(';')[0];
if(tag==='script'&&Object.hasOwn(attributes,'src')&&(!scriptType||scriptType==='module'||frontendScriptMimes.has(scriptType)))references.push({path:decode(attributes.src),kind:'script'});
if(tag==='link'&&Object.hasOwn(attributes,'href')){const rel=(attributes.rel||'').toLowerCase().split(/[\t\n\f\r ]+/),as=(attributes.as||'').trim().toLowerCase();
const kind=rel.includes('stylesheet')?'style':rel.includes('modulepreload')?'script':rel.includes('preload')&&(as==='script'||as==='style')?as:null;
if(kind)references.push({path:decode(attributes.href),kind})}
if(['script','style','textarea','title'].includes(tag)){let end=lower.indexOf('</'+tag,cursor);while(end>=0&&!/[\t\n\f\r />]/.test(lower[end+tag.length+2]||''))end=lower.indexOf('</'+tag,end+2);cursor=end<0?html.length:end}
}
return {base,references};
}`;

const buildProgram = `const fs=require('node:fs'),{spawn}=require('node:child_process'),{createHash}=require('node:crypto');
${frontendAssetProgram}
const plan=JSON.parse(process.argv[1]);let stage='cache';const watchdog=setTimeout(()=>process.exit(124),plan.buildCommand!==null?270000:110000);
const env={PATH:'/usr/local/bin:/usr/bin:/bin',HOME:'/work',TMPDIR:'/work',CI:'true',NEXT_TELEMETRY_DISABLED:'1',PORT:String(plan.port),NODE_OPTIONS:'--max-old-space-size=512',npm_config_cache:'/work/cache',npm_config_offline:'true',npm_config_audit:'false',npm_config_fund:'false'};
for(const item of JSON.parse(fs.readFileSync(0,'utf8')||'[]')){if(!/^[A-Za-z_][A-Za-z0-9_]*$/.test(item.key)||/^(?:PATH|HOME|TMPDIR|NODE_OPTIONS|NODE_ENV|PORT|CI|NEXT_TELEMETRY_DISABLED|npm_config_.*)$/i.test(item.key)||typeof item.value!=='string')throw Error('invalid project environment');env[item.key]=item.value}
fs.cpSync('/source','/work/project',{recursive:true,dereference:false});
fs.writeFileSync('/work/user.npmrc','');fs.writeFileSync('/work/global.npmrc','');
const npm=async args=>new Promise((resolve,reject)=>{const p=spawn('/usr/local/bin/npm',args,{cwd:'/work/project',env,stdio:['ignore','pipe','pipe']});p.stdout.pipe(process.stdout);p.stderr.pipe(process.stderr);p.once('error',reject);p.once('exit',code=>code===0?resolve():reject(Error('command exited '+code)))});
(async()=>{
const cacache=require('/usr/local/lib/node_modules/npm/node_modules/cacache');
for(const item of JSON.parse(fs.readFileSync('/tarballs/manifest.json','utf8'))){if(!/^[a-f0-9]{64}\\.tgz$/.test(item.file)||!['sha512','sha256'].includes(item.algorithm))throw Error('invalid cache manifest');const bytes=fs.readFileSync('/tarballs/'+item.file);if(item.algorithm+'-'+createHash(item.algorithm).update(bytes).digest('base64')!==item.integrity)throw Error('cache integrity changed');await cacache.put('/work/cache/_cacache','launchlane:'+item.file,bytes,{algorithms:[item.algorithm]})}
stage='install';if(plan.install!=='none')await npm(['ci','--offline','--no-audit','--no-fund','--userconfig=/work/user.npmrc','--globalconfig=/work/global.npmrc']);
const cacheBefore=fs.statfsSync('/work');fs.rmSync('/work/cache',{recursive:true,force:true});const cacheAfter=fs.statfsSync('/work');
console.log('Launchlane: dependency staging released before build',JSON.stringify({workBytesBefore:(cacheBefore.blocks-cacheBefore.bfree)*cacheBefore.bsize,workBytesAfter:(cacheAfter.blocks-cacheAfter.bfree)*cacheAfter.bsize}));
stage='build';if(plan.buildCommand!==null)await npm(['run','build']);
stage='test';if(plan.testCommand!==null)await npm(['test']);
stage='workload';
let child;
if(plan.frontend){
const path=require('node:path'),http=require('node:http'),root=fs.realpathSync('/work/project/'+plan.frontend.outputDirectory);
if(!root.startsWith('/work/project/')||!fs.statSync(root+'/index.html').isFile())throw Error('frontend output index.html missing');
const mime={'.html':'text/html; charset=utf-8','.js':'application/javascript','.mjs':'application/javascript','.css':'text/css','.json':'application/json','.svg':'image/svg+xml','.png':'image/png','.woff2':'font/woff2'};
const server=http.createServer((req,res)=>{try{const pathname=decodeURIComponent(new URL(req.url,'http://localhost').pathname);let file=path.resolve(root,'.'+pathname);if(file!==root&&!file.startsWith(root+'/'))throw Error('path denied');if(file===root)file=root+'/index.html';if(!fs.existsSync(file)&&!path.extname(file))file=root+'/index.html';const resolved=fs.realpathSync(file);if(!resolved.startsWith(root+'/')||!fs.statSync(resolved).isFile())throw Error('file denied');res.setHeader('content-type',mime[path.extname(resolved)]||'application/octet-stream');fs.createReadStream(resolved).pipe(res)}catch{res.writeHead(404);res.end('not found')}});
await new Promise(resolve=>server.listen(plan.port,'127.0.0.1',resolve));child={kill:()=>server.close()};
const localOrigin=new URL('http://127.0.0.1:'+plan.port).origin,html=fs.readFileSync(root+'/index.html','utf8'),assets=frontendAssets(html),base=new URL(assets.base??'/',localOrigin+'/'),seen=new Set();let totalAssetBytes=0;
if(base.origin!==localOrigin)throw Error('external build asset is not verified');
for(const reference of assets.references){const url=new URL(reference.path,base);if(url.origin!==localOrigin)throw Error('external build asset is not verified');const key=reference.kind+':'+url.href;if(seen.has(key))continue;seen.add(key);if(seen.size>16)throw Error('built asset count limit');
const asset=await fetch(url,{redirect:'manual',signal:AbortSignal.timeout(1000)});let size=0;for await(const bytes of asset.body){size+=bytes.length;totalAssetBytes+=bytes.length;if(size>2097152||totalAssetBytes>8388608)throw Error('built asset limit')};
if(asset.status!==200||size===0||!frontendAssetMime(reference.kind,asset.headers.get('content-type')))throw Error('built asset missing or invalid')}
}else{child=spawn('/usr/local/bin/npm',['start'],{cwd:'/work/project',env:{...env,NODE_ENV:'production'},stdio:['ignore','pipe','pipe']});child.stdout.pipe(process.stdout);child.stderr.pipe(process.stderr);child.on('error',()=>{});}
try{let result=null,lastIssue='no matching response';const deadline=Date.now()+15000;while(Date.now()<deadline){try{const response=await fetch('http://127.0.0.1:'+plan.port+plan.workload.path,{redirect:'manual',signal:AbortSignal.timeout(1000)});const chunks=[],type=(response.headers.get('content-type')||'').split(';')[0].trim().toLowerCase(),limit=plan.workload.assertion.kind==='text'&&/^next start(?:\\s|$)/.test(plan.startCommand)&&['text/html','application/xhtml+xml'].includes(type)?${htmlWorkloadByteLimit}:65536;let size=0;for await(const bytes of response.body){size+=bytes.length;if(size>limit)throw Error('response exceeded '+limit+' bytes; HTTP '+response.status);chunks.push(Buffer.from(bytes))};const body=Buffer.concat(chunks).toString('utf8');
const a=plan.workload.assertion;let matches=false;if(a.kind==='text')matches=body.includes(a.contains);else{try{const json=JSON.parse(body);matches=json!==null&&typeof json==='object'&&!Array.isArray(json)&&Object.hasOwn(json,a.field)&&json[a.field]===a.equals}catch{}}
if(response.status===plan.workload.status&&matches){console.log('Launchlane: original workload response',JSON.stringify({status:response.status,bytes:size,limit,contentType:type}));result=true;break}else{lastIssue='HTTP '+response.status+'; expected assertion '+(matches?'matched':'not matched')}}catch(error){lastIssue=String(error.message).slice(0,160)}await new Promise(resolve=>setTimeout(resolve,250))};if(!result)throw Error('original workload expectation not met; '+lastIssue);console.log('Launchlane: '+(plan.install==='none'?'dependency-free':'locked install')+', build and original workload verified');
}finally{child.kill()}
clearTimeout(watchdog);process.exit(0)
})().catch(error=>{console.error('Launchlane build check failed:',stage,error.message);process.exit({cache:74,install:71,build:72,workload:73,test:76}[stage]??75)});`;

export async function runContainerBuild(workspace: string, tarballs: string, value: ProjectBuildPlan, signal: AbortSignal,
  onCreated?: (id: string) => void, environment: readonly EnvironmentVariable[] = []): Promise<CommandResult & { containerId: string; image: string }> {
  const plan = parseProjectBuildPlan(value), values = environmentVariables(environment);
  ensure(plan.version !== 2, "BUILD_RUNTIME_UNSUPPORTED", "این runner فقط برای Node است.", 409);
  ensure(values.every(row => isApplicationEnvironmentKey(row.key)), "ENV_SCOPE_DENIED", "تنظیمات runner از اطلاعات پروژه جداست.", 409);
  ensure(values.map(row => row.key).sort().join("\0") === [...(plan.environment?.keys ?? [])].sort().join("\0"), "ENV_REFERENCE_CHANGED", "ورودی محیط build با تصمیم برابر نیست.", 409);
  ensure(!workspace.includes(",") && !tarballs.includes(","), "SANDBOX_PATH_DENIED", "مسیر ورودی build معتبر نیست.", 403);
  let id: string | null = null;
  try {
    const created = await docker(["create", "--interactive", "--log-driver", "none", "--pull=never", "--name", `launchlane-build-${randomUUID()}`, "--label", "ir.launchlane.worker=locked-build-v1",
      "--network", "none", "--read-only", "--cap-drop", "ALL", "--security-opt", "no-new-privileges", "--user", "1000:1000",
      "--cpus", "1", "--memory", "2g", "--memory-swap", "2g", "--pids-limit", "128",
      // npm build tools and native modules must execute inside the otherwise isolated tmpfs.
      "--tmpfs", "/work:rw,exec,nosuid,nodev,size=1073741824,uid=1000,gid=1000,mode=0700",
      "--mount", `type=bind,source=${workspace},target=/source,readonly`, "--mount", `type=bind,source=${tarballs},target=/tarballs,readonly`,
      plan.image, "node", "-e", buildProgram, "--", JSON.stringify(plan)], signal, 4096);
    ensure(created.exitCode === 0 && /^[a-f0-9]{64}$/.test(created.output.trim()), "SANDBOX_UNAVAILABLE", "محیط build محدود ایجاد نشد؛ script روی میزبان اجرا نشده است.", 503);
    id = created.output.trim(); onCreated?.(id);
    const input = Buffer.from(JSON.stringify(values));
    let result: CommandResult;
    try { result = await docker(["start", "--attach", "--interactive", id], signal, 32768, input); }
    finally { input.fill(0); }
    const state = await containerState(id), stopped = result.signal ?? (state.oom ? "OOM" : null);
    return { ...result, signal: stopped, exitCode: signal.aborted || stopped ? null : state.exitCode, containerId: id, image: plan.image };
  } finally {
    if (id) {
      const removed = await docker(["rm", "--force", id], AbortSignal.timeout(5000), 4096);
      ensure(removed.exitCode === 0, "SANDBOX_CLEANUP_UNCONFIRMED", "پایان container همین build تأیید نشد.", 503);
    }
  }
}
