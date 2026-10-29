// The package manager and tarballs are immutable, read-only inputs. pnpm sees only
// this loopback registry inside a network=none worker; no registry credentials exist.
export const pnpmInstallProgram = String.raw`
function verifyPnpmSource(){
let files=0,total=0;function visit(root,relative=''){for(const entry of fs.readdirSync(root,{withFileTypes:true})){const path=relative?relative+'/'+entry.name:entry.name,source='/source/'+path,target='/work/project/'+path;if(entry.isDirectory()){visit(source,path);continue}if(!entry.isFile()||++files>1000)throw Error('pnpm source inventory changed');const before=fs.readFileSync(source);total+=before.length;if(total>20971520)throw Error('pnpm source bytes limit');const stat=fs.lstatSync(target);if(!stat.isFile()||stat.isSymbolicLink()||fs.realpathSync(target)!==target||createHash('sha256').update(fs.readFileSync(target)).digest('hex')!==createHash('sha256').update(before).digest('hex'))throw Error('pnpm reviewed source changed: '+path)}}visit('/source');
}
async function installPnpm(){
const tool=plan.workspace.manager,expected=plan.nodeVersion==='24'?'24.18.0':'22.23.3';if(process.versions.node!==expected)throw Error('pnpm runtime changed');
const rows=JSON.parse(fs.readFileSync('/tarballs/pnpm-registry.json','utf8')),tarballs=new Map();
let toolFile=null;
for(const item of rows){if(!/^\/[A-Za-z0-9@_./+%-]+\.tgz$/.test(item.path)||!/^([a-f0-9]{64})\.tgz$/.test(item.file)||typeof item.integrity!=='string')throw Error('pnpm registry manifest invalid');const bytes=fs.readFileSync('/tarballs/'+item.file),parts=item.integrity.split('-');if(!['sha256','sha512'].includes(parts[0])||createHash(parts[0]).update(bytes).digest('base64')!==parts[1])throw Error('pnpm cache integrity changed');if(tarballs.has(item.path)&&tarballs.get(item.path)!==item.file)throw Error('pnpm registry path conflict');tarballs.set(item.path,item.file);if(item.integrity===tool.integrity&&item.path==='/pnpm/-/pnpm-'+tool.version+'.tgz')toolFile=item.file;}
if(!toolFile)throw Error('pinned pnpm tool missing');
await npm(['install','--prefix','/work/manager','--offline','--ignore-scripts','--no-package-lock','--no-audit','--no-fund','/tarballs/'+toolFile]);
fs.mkdirSync('/work/bin');fs.symlinkSync('/work/manager/node_modules/pnpm/bin/pnpm.mjs','/work/bin/pnpm');env.PATH='/work/bin:'+env.PATH;env.PNPM_HOME='/work/pnpm-home';env.XDG_CONFIG_HOME='/work/config';env.XDG_CACHE_HOME='/work/cache';env.npm_config_offline='false';env.npm_config_engine_strict='true';managerExecutable='/work/bin/pnpm';
const metadata=new Map(JSON.parse(fs.readFileSync('/tarballs/pnpm-metadata.json','utf8')).map(item=>[item.path,item.value]));
const http=require('node:http'),registry=http.createServer((req,res)=>{const key=decodeURIComponent(req.url),target=tarballs.get(key);if(req.method!=='GET'||!target&&!metadata.has(key)){res.writeHead(404);res.end('unapproved registry path');return}if(!target){res.setHeader('content-type','application/json');res.end(JSON.stringify(metadata.get(key)));return}res.setHeader('content-type','application/octet-stream');fs.createReadStream('/tarballs/'+target).pipe(res)});
await new Promise(resolve=>registry.listen(0,'127.0.0.1',resolve));const origin='http://127.0.0.1:'+registry.address().port;
try{await npm(['install','--frozen-lockfile','--registry='+origin,'--store-dir=/work/pnpm-store','--config.manage-package-manager-versions=false','--config.package-manager-strict-version=true','--config.verify-store-integrity=true']);}
finally{await new Promise(resolve=>registry.close(resolve));}
for(const file of plan.workspace.files){if(createHash('sha256').update(fs.readFileSync('/work/project/'+file.path)).digest('hex')!==file.sha256)throw Error('pnpm source lock or manifest changed during frozen install');}
verifyPnpmSource();
console.log('Launchlane: pinned pnpm '+tool.version+'; frozen root lock and all workspace importers preserved');
}
`;
