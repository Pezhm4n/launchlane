export function componentDockerfile(image: string, port: number): string {
  return `FROM ${image}\nWORKDIR /app\nCOPY .launchlane-component.cjs .launchlane-component.json .launchlane-component.gz ./\nRUN node .launchlane-component.cjs materialize\nUSER 1000:1000\nEXPOSE ${port}\nCMD ["node",".launchlane-component.cjs"]\n`;
}

// Fixed programs. Source commands remain reviewed plan data; no model code is interpolated.
export const componentPackProgram = String.raw`
function canonicalComponent(value){if(value===null||typeof value!=='object')return JSON.stringify(value);if(Array.isArray(value))return '['+value.map(canonicalComponent).join(',')+']';return '{'+Object.keys(value).sort().map(key=>JSON.stringify(key)+':'+canonicalComponent(value[key])).join(',')+'}'}
function packageComponent(){
const path=require('node:path'),project='/work/project',component=plan.component,entries=new Map(),contents=new Map(),packages=new Set();let total=0,visited=0;
const relative=value=>{if(value===project)return '.';if(!value.startsWith(project+'/'))throw Error('component path outside workspace');return value.slice(project.length+1)};
function collect(file){if(++visited>32768)throw Error('component entry limit');const rel=relative(file);if(entries.has(rel))return;const stat=fs.lstatSync(file);if(stat.isSymbolicLink()){const target=fs.realpathSync(file);relative(target);entries.set(rel,{path:rel,type:'symlink',target:relative(target)});collect(target);return}
if(stat.isDirectory()){for(const item of fs.readdirSync(file)){if(item==='node_modules')continue;collect(path.join(file,item))}return}
if(!stat.isFile()||stat.size>16777216||total+stat.size>100663296||entries.size>=8192)throw Error('component output limit');const bytes=fs.readFileSync(file);total+=bytes.length;entries.set(rel,{path:rel,type:'file',bytes:bytes.length,sha256:createHash('sha256').update(bytes).digest('hex'),executable:!!(stat.mode&73)});contents.set(rel,{path:rel,base64:bytes.toString('base64')});}
function dependency(folder,name,optional){if(!/^(?:@[a-z0-9_.-]+\/)?[a-z0-9_][a-z0-9_.-]*$/.test(name))throw Error('component dependency name invalid');let parent=folder;while(parent===project||parent.startsWith(project+'/')){const candidate=path.join(parent,'node_modules',name);if(fs.existsSync(candidate)){const target=fs.realpathSync(candidate);relative(target);if(candidate!==target)entries.set(relative(candidate),{path:relative(candidate),type:'symlink',target:relative(target)});collectPackage(target);return}parent=path.dirname(parent)}if(!optional)throw Error('component production dependency missing: '+name)}
function collectPackage(folder){if(packages.has(folder))return;packages.add(folder);collect(folder);collectDependencies(folder)}
function collectDependencies(folder){const pkg=JSON.parse(fs.readFileSync(path.join(folder,'package.json'),'utf8'));for(const [name]of Object.entries({...pkg.dependencies,...pkg.optionalDependencies,...pkg.peerDependencies})){dependency(folder,name,!!pkg.optionalDependencies?.[name]||pkg.peerDependenciesMeta?.[name]?.optional===true)}}
if(component.kind==='static')collect(path.join(project,component.root,component.outputDirectory));else {collectPackage(component.root==='.'?project:path.join(project,component.root));if(component.root!=='.')collectDependencies(project)}
// Preserve inherited module format and the original workspace/lock as provenance; never run another install.
for(const item of plan.workspace.files){if(item.path==='package.json'||item.path==='pnpm-lock.yaml'||item.path==='pnpm-workspace.yaml')collect(project+'/'+item.path)}
const output={version:1,sourceHash:plan.sourceHash,planHash:createHash('sha256').update(canonicalComponent(plan)).digest('hex'),entries:[...entries.values()].sort((a,b)=>a.path.localeCompare(b.path,'en')),contents:[...contents.values()].sort((a,b)=>a.path.localeCompare(b.path,'en')),totalBytes:total};
const wire=require('node:zlib').gzipSync(Buffer.from(JSON.stringify(output)),{level:6});if(wire.length>16777216)throw Error('component compressed output limit');fs.writeFileSync('/work/component-output.gz',wire,{flag:'wx'});return {output,wire};
}
`;

export const componentMaterializeProgram = String.raw`
function materializeComponent(output,root){
const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto'),names=new Map(output.entries.map(entry=>[entry.path,entry]));
function safe(value){if(typeof value!=='string'||value.length>512||value.startsWith('/')||/[\\:\u0000-\u001f\u007f]/.test(value)||value.split('/').some(part=>!part||part==='.'||part==='..'))throw Error('component unsafe path');return path.join(root,...value.split('/'))}
if(fs.existsSync(root))throw Error('component materialization target exists');fs.mkdirSync(root,{recursive:true});
for(const file of output.contents){const entry=names.get(file.path),target=safe(file.path),bytes=Buffer.from(file.base64,'base64');if(entry?.type!=='file'||bytes.length!==entry.bytes||crypto.createHash('sha256').update(bytes).digest('hex')!==entry.sha256)throw Error('component bytes changed');fs.mkdirSync(path.dirname(target),{recursive:true});fs.writeFileSync(target,bytes,{flag:'wx',mode:entry.executable?0o555:0o444});}
for(const entry of output.entries){if(entry.type!=='symlink')continue;const link=safe(entry.path),target=safe(entry.target);fs.mkdirSync(path.dirname(link),{recursive:true});fs.symlinkSync(path.relative(path.dirname(link),target),link)}
function verify(folder){for(const item of fs.readdirSync(folder)){const target=path.join(folder,item),stat=fs.lstatSync(target),relative=path.relative(root,target).split(path.sep).join('/'),entry=names.get(relative);if(stat.isSymbolicLink()){if(entry?.type!=='symlink'||fs.realpathSync(target)!==safe(entry.target))throw Error('component link changed')}else if(stat.isDirectory())verify(target);else if(entry?.type!=='file'||crypto.createHash('sha256').update(fs.readFileSync(target)).digest('hex')!==entry.sha256)throw Error('component file changed')}}verify(root);
}
`;

export const componentRuntimeProgram = String.raw`
function startComponent(root,component,proof,publicPort,environment=process.env){
const fs=require('node:fs'),path=require('node:path'),http=require('node:http'),{spawn}=require('node:child_process');let child=null;
if(component.kind==='node'){child=spawn(process.execPath,component.argv,{cwd:path.join(root,component.root),env:{...environment,NODE_ENV:"production",PORT:String(component.internalPort)},stdio:['ignore','inherit','inherit']});child.on('error',()=>{});}
const staticRoot=path.join(root,component.root,component.outputDirectory),mime={'.html':'text/html; charset=utf-8','.js':'application/javascript','.mjs':'application/javascript','.css':'text/css','.json':'application/json','.svg':'image/svg+xml','.png':'image/png','.woff2':'font/woff2'};
const server=http.createServer((req,res)=>{if(req.method==='GET'&&req.url==='/launchlane-build-proof.json'){res.setHeader('content-type','application/json');res.end(JSON.stringify(proof)+'\n');return}
if(component.kind==='node'){const headers={...req.headers};delete headers.connection;const upstream=http.request({hostname:'127.0.0.1',port:component.internalPort,path:req.url,method:req.method,headers,timeout:30000},answer=>{res.writeHead(answer.statusCode||502,answer.headers);answer.pipe(res)});upstream.on('error',()=>{if(!res.headersSent)res.writeHead(502);res.end('component unavailable')});upstream.on('timeout',()=>upstream.destroy());req.pipe(upstream);return}
try{if(!['GET','HEAD'].includes(req.method))throw Error('method');const pathname=decodeURIComponent(new URL(req.url,'http://localhost').pathname);let file=path.resolve(staticRoot,'.'+pathname);if(file!==staticRoot&&!file.startsWith(staticRoot+'/'))throw Error('path');if(file===staticRoot)file=staticRoot+'/index.html';if(!fs.existsSync(file)&&!path.extname(file))file=staticRoot+'/index.html';const resolved=fs.realpathSync(file);if(!resolved.startsWith(staticRoot+'/')||!fs.statSync(resolved).isFile())throw Error('file');res.setHeader('content-type',mime[path.extname(resolved)]||'application/octet-stream');if(req.method==='HEAD')res.end();else fs.createReadStream(resolved).pipe(res)}catch{res.writeHead(404);res.end('not found')}});
return new Promise(resolve=>server.listen(publicPort,'0.0.0.0',()=>resolve({kill(){child?.kill();server.close()}})));
}
`;

// Invoked only from a generated, source-bound Dockerfile. The image owns the unpacked
// files as root; the original component runs as uid1000 and cannot replace its proof/code.
export const componentHostProgram = String.raw`const fs=require('node:fs'),path=require('node:path'),{createHash}=require('node:crypto'),{gunzipSync}=require('node:zlib');
${componentMaterializeProgram}
${componentRuntimeProgram}
const base=__dirname,metadata=JSON.parse(fs.readFileSync(path.join(base,'.launchlane-component.json'),'utf8')),wire=fs.readFileSync(path.join(base,'.launchlane-component.gz'));
if(wire.length>16777216||createHash('sha256').update(wire).digest('hex')!==metadata.verification.outputArtifactHash)throw Error('component bundle changed');
const output=JSON.parse(gunzipSync(wire,{maxOutputLength:146800640}).toString('utf8')),binding=metadata.verification;
if(output.version!==1||output.sourceHash!==binding.testedSourceHash||output.planHash!==binding.planHash)throw Error('component provenance changed');
const root=path.join(base,'runtime');if(process.argv[2]==='materialize'){materializeComponent(output,root);process.exit(0)}
for(const entry of output.entries){const target=path.join(root,entry.path),stat=fs.lstatSync(target);if(entry.type==='file'&&(!stat.isFile()||stat.isSymbolicLink()||createHash('sha256').update(fs.readFileSync(target)).digest('hex')!==entry.sha256)||entry.type==='symlink'&&(!stat.isSymbolicLink()||fs.realpathSync(target)!==path.join(root,entry.target)))throw Error('component installed bytes changed')}
const proof={version:1,testedSourceHash:binding.testedSourceHash,planHash:binding.planHash,outputArtifactHash:binding.outputArtifactHash};
startComponent(root,binding.component,proof,metadata.port).then(server=>{process.on('SIGTERM',()=>{server.kill();process.exit(0)})}).catch(()=>process.exit(1));
`;

export const componentCheckProgram = String.raw`
async function assertNoComponentDaemons(graceMs=1000){
const fs=require('node:fs'),deadline=Date.now()+graceMs;
for(;;){const unexpected=[];for(const name of fs.readdirSync('/proc')){if(!/^[0-9]+$/.test(name)||Number(name)===1||Number(name)===process.pid)continue;try{const state=/^State:\s+([A-Z])/m.exec(fs.readFileSync('/proc/'+name+'/status','utf8'));if(state?.[1]!=='Z')unexpected.push(name)}catch(error){if(error.code!=='ENOENT')throw error}}
if(!unexpected.length)return;if(Date.now()>=deadline)throw Error('unexpected background process after original component tests');await new Promise(resolve=>setTimeout(resolve,50))}
}
function clearComponentBuildTree(){const fs=require('node:fs');for(const path of ['/work/project','/work/bin','/work/manager','/work/pnpm-store','/work/cache'])fs.rmSync(path,{recursive:true,force:true});console.log('Launchlane: build tree and tools removed before compiled runtime start');}

async function checkCompiledComponent(plan){const fs=require("node:fs");
if(plan.version===9){
const origin='http://127.0.0.1:'+plan.port;
for(const check of plan.apiChecks){const response=await fetch(origin+check.path,{redirect:'manual',signal:AbortSignal.timeout(3000)});let bytes=0,chunks=[];for await(const part of response.body){bytes+=part.length;if(bytes>65536)throw Error('component API response limit');chunks.push(Buffer.from(part))}if(response.status!==check.status||!(response.headers.get('content-type')||'').toLowerCase().includes('application/json'))throw Error('component API status or type mismatch');const json=JSON.parse(Buffer.concat(chunks).toString('utf8'));for(const assertion of check.assertions){let value=json;for(const key of assertion.pointer){if(!value||typeof value!=='object'||!Object.hasOwn(value,key))throw Error('component API field missing');value=value[key]}if(value!==assertion.equals)throw Error('component API expected effect missing')}}
if(plan.component.kind==='static'){const html=fs.readFileSync('/work/component-runtime/'+plan.component.root+'/'+plan.component.outputDirectory+'/index.html','utf8'),assets=frontendAssets(html),base=new URL(assets.base??'/',origin+'/');if(base.origin!==origin)throw Error('external component asset');for(const ref of assets.references){const url=new URL(ref.path,base);if(url.origin!==origin)throw Error('external component asset');const response=await fetch(url,{redirect:'manual',signal:AbortSignal.timeout(2000)}),body=await response.arrayBuffer();if(response.status!==200||body.byteLength===0||body.byteLength>8388608||!frontendAssetMime(ref.kind,response.headers.get('content-type')))throw Error('compiled component asset missing')}}
}
}
function verifyTestedComponent(plan,componentPackage){const fs=require("node:fs"),{createHash}=require("node:crypto");
if(plan.version===9){const root='/work/component-runtime',path=require('node:path');for(const entry of componentPackage.output.entries){const file=path.join(root,entry.path),stat=fs.lstatSync(file);if(entry.type==='file'&&(!stat.isFile()||stat.isSymbolicLink()||createHash('sha256').update(fs.readFileSync(file)).digest('hex')!==entry.sha256)||entry.type==='symlink'&&(!stat.isSymbolicLink()||fs.realpathSync(file)!==path.join(root,entry.target)))throw Error('tested component changed');}if(!fs.readFileSync('/work/component-output.gz').equals(componentPackage.wire))throw Error('component export changed');console.log('Launchlane: exact compiled component and production dependency closure verified; other components/data remain unverified');}
}
`;
