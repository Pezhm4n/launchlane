import { executablePort, type ExecutableVerification } from "../../contracts/go-runtime.ts";
import type { SourceFile } from "../workspace/inspect.ts";
import { ensure } from "../errors.ts";
import { projectBuildImage } from "../../contracts/project-build.ts";

export function executableDockerfile(runtime: ExecutableVerification["runtime"]): string { return `FROM ${projectBuildImage}\nWORKDIR /app\nCOPY . ./\nRUN node .launchlane-executable.cjs materialize\nUSER 1000:1000\nEXPOSE ${executablePort(runtime)}\nCMD ["node",".launchlane-executable.cjs"]\n`; }
export const executableHostProgram = String.raw`const fs=require('node:fs'),path=require('node:path'),http=require('node:http'),{spawn}=require('node:child_process'),{createHash}=require('node:crypto'),{gunzipSync}=require('node:zlib');
const base=__dirname,metadata=JSON.parse(fs.readFileSync(path.join(base,'.launchlane-executable.json'),'utf8')),binding=metadata.verification;
const wire=fs.readFileSync(path.join(base,'.launchlane-executable.gz'));
if(wire.length>12582912||createHash('sha256').update(wire).digest('hex')!==binding.outputArtifactHash)throw Error('compiled bundle changed');
const output=JSON.parse(gunzipSync(wire,{maxOutputLength:12582912}).toString('utf8')),bytes=Buffer.from(output.base64,'base64');
if(output.version!==1||output.sourceHash!==binding.testedSourceHash||output.planHash!==binding.planHash||bytes.length!==output.bytes||bytes.length>8388608||createHash('sha256').update(bytes).digest('hex')!==output.sha256)throw Error('compiled provenance changed');
const folder=path.join(base,'.launchlane-runtime'),entry=path.join(folder,'server');
if(process.argv[2]==='materialize'){fs.mkdirSync(folder,{mode:0o755});fs.writeFileSync(entry,bytes,{flag:'wx',mode:0o555});process.exit(0)}
const stat=fs.lstatSync(entry);if(!stat.isFile()||stat.isSymbolicLink()||stat.nlink!==1||createHash('sha256').update(fs.readFileSync(entry)).digest('hex')!==output.sha256)throw Error('compiled executable changed');
const child=spawn(entry,[],{cwd:base,env:{...process.env,PORT:String(binding.runtime.port)},stdio:['ignore','inherit','inherit']});
child.on('error',()=>process.exit(1));child.on('exit',code=>process.exit(code||1));
const proof=JSON.stringify({version:1,testedSourceHash:binding.testedSourceHash,planHash:binding.planHash,outputArtifactHash:binding.outputArtifactHash})+'\n';
const server=http.createServer((req,res)=>{
if(req.method==='GET'&&req.url==='/launchlane-build-proof.json'){res.setHeader('content-type','application/json');res.end(proof);return}
const headers={...req.headers};delete headers.connection;
const upstream=http.request({hostname:'127.0.0.1',port:binding.runtime.port,path:req.url,method:req.method,headers,timeout:30000},answer=>{res.writeHead(answer.statusCode||502,answer.headers);answer.pipe(res)});
upstream.on('error',()=>{if(!res.headersSent)res.writeHead(502);res.end('application unavailable')});upstream.on('timeout',()=>upstream.destroy());req.on('aborted',()=>upstream.destroy());req.pipe(upstream);
});
server.on('upgrade',(req,socket,head)=>{const upstream=http.request({hostname:'127.0.0.1',port:binding.runtime.port,path:req.url,method:req.method,headers:req.headers});upstream.on('upgrade',(res,peer,pending)=>{socket.write('HTTP/1.1 '+res.statusCode+' '+res.statusMessage+'\r\n'+res.rawHeaders.reduce((text,value,index)=>text+value+(index%2?'\r\n':': '),'')+'\r\n');if(pending.length)socket.write(pending);if(head.length)peer.write(head);peer.pipe(socket);socket.pipe(peer);peer.on('error',()=>socket.destroy());socket.on('error',()=>peer.destroy())});upstream.on('error',()=>socket.destroy());upstream.on('response',()=>socket.destroy());upstream.end()});
server.listen(metadata.port,'0.0.0.0');process.on('SIGTERM',()=>{child.kill();server.close();setTimeout(()=>process.exit(0),2000).unref()});
`;

export function executableSourceFiles(files: readonly SourceFile[], verification: ExecutableVerification): SourceFile[] {
  ensure(!files.some(file => file.path.startsWith(".launchlane-executable") || file.path.startsWith(".launchlane-runtime") || file.path === "liara.original.json"),
    "EXECUTABLE_ARTIFACT_COLLISION", "فایل generated نباید فایل source را جایگزین کند.", 409);
  return [...files.map(file => file.path === "liara.json" ? { ...file, path: "liara.original.json" } : file),
    { path: ".launchlane-executable.cjs", content: Buffer.from(executableHostProgram) },
    { path: ".launchlane-executable.json", content: Buffer.from(`${JSON.stringify({ version: 1, verification, port: executablePort(verification.runtime) })}\n`) },
    { path: ".launchlane-executable.Dockerfile", content: Buffer.from(executableDockerfile(verification.runtime)) },
    { path: "liara.json", content: Buffer.from(`${JSON.stringify({ platform: "docker", port: executablePort(verification.runtime), build: { dockerfile: ".launchlane-executable.Dockerfile" } })}\n`) }];
}
