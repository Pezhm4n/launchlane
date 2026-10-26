import { createHash } from "node:crypto";
import type { WorkerSqliteAdapter } from "../../contracts/worker-sqlite.ts";
import { workerSqliteDatabaseProgram } from "./worker-sqlite-runtime.ts";

export const workerSqlitePaths = {
  server: "launchlane-worker-server.mjs", database: "launchlane-worker-db.cjs", build: "launchlane-worker-build.cjs", descriptor: "launchlane-worker.json",
} as const;
export const workerSqliteStart = `node ${workerSqlitePaths.server}`;
export const workerSqliteBuild = `node ${workerSqlitePaths.build}`;

export const workerSqliteBuildProgram = String.raw`'use strict';
const fs=require('node:fs'),{spawnSync}=require('node:child_process'),path=require('node:path');
const descriptor=JSON.parse(fs.readFileSync(path.join(__dirname,'launchlane-worker.json'),'utf8'));
function run(file,args){const result=spawnSync(process.execPath,[file,...args],{cwd:__dirname,env:process.env,stdio:'inherit'});if(result.error||result.status!==0)throw Error('WORKER_BUILD_FAILED')}
run(path.join(path.dirname(require.resolve('vite/package.json')),'bin','vite.js'),['build']);
const output=path.join(__dirname,'dist','launchlane-private');fs.mkdirSync(output,{recursive:true});
require('esbuild').buildSync({entryPoints:[descriptor.workerEntry],bundle:true,platform:'node',format:'cjs',target:'node24',outfile:path.join(output,'worker.cjs')});
`;

// The API Worker and frontend run behind one server. Compiled backend files are never static assets.
export const workerSqliteServerProgram = String.raw`import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {createServer} from 'node:http';
import {Readable} from 'node:stream';
import {createRequire} from 'node:module';
import {createHash} from 'node:crypto';
import {DatabaseSync} from 'node:sqlite';
const require=createRequire(import.meta.url),base=path.dirname(fileURLToPath(import.meta.url));
const descriptor=JSON.parse(fs.readFileSync(path.join(base,'launchlane-worker.json'),'utf8'));
const {DatabaseBinding,migrate}=require('./launchlane-worker-db.cjs');
const source=require('./dist/launchlane-private/worker.cjs'),worker=source.default;
if(!worker||typeof worker.fetch!=='function')throw Error('WORKER_FETCH_REQUIRED');
const data='/data';if(!fs.existsSync(data))throw Error('WORKER_PERSISTENT_DIRECTORY_REQUIRED');
if(fs.lstatSync(data).isSymbolicLink()||fs.realpathSync(data)!==data)throw Error('WORKER_DATA_PATH_DENIED');
const databasePath=path.join(data,'worker.sqlite');
if(fs.existsSync(databasePath)&&(fs.lstatSync(databasePath).isSymbolicLink()||!fs.lstatSync(databasePath).isFile()||fs.lstatSync(databasePath).nlink!==1))throw Error('WORKER_DATA_PATH_DENIED');
const database=new DatabaseSync(databasePath,{allowExtension:false});database.exec('PRAGMA foreign_keys=ON;PRAGMA busy_timeout=5000;');
const migrationRoot=path.join(base,descriptor.migrationsDirectory);
if(fs.realpathSync(migrationRoot)!==migrationRoot||fs.lstatSync(migrationRoot).isSymbolicLink())throw Error('WORKER_MIGRATION_PATH_DENIED');
const migrations=fs.readdirSync(migrationRoot).filter(name=>/^\d{4}_[A-Za-z0-9_-]+\.sql$/.test(name)).map(name=>{
 const file=path.join(migrationRoot,name),stat=fs.lstatSync(file);
 if(!stat.isFile()||stat.isSymbolicLink()||stat.nlink!==1||stat.size>4194304)throw Error('WORKER_MIGRATION_PATH_DENIED');
 const sql=fs.readFileSync(file,'utf8');return {name,sql,sha256:createHash('sha256').update(sql).digest('hex')};
});
const migration=migrate(database,migrations),root=fs.realpathSync(path.join(base,'dist'));
const mime={'.html':'text/html; charset=utf-8','.js':'application/javascript','.mjs':'application/javascript','.css':'text/css','.json':'application/json','.svg':'image/svg+xml','.png':'image/png','.jpg':'image/jpeg','.jpeg':'image/jpeg','.ico':'image/x-icon','.woff2':'font/woff2','.woff':'font/woff','.ttf':'font/ttf','.webmanifest':'application/manifest+json'};
const assets={fetch:async request=>{
 let pathname;try{pathname=decodeURIComponent(new URL(request.url).pathname)}catch{return new Response('bad path',{status:400})}
 if(!['GET','HEAD'].includes(request.method))return new Response('method denied',{status:405});
 const parts=pathname.split('/').filter(Boolean);if(parts.some(part=>part.startsWith('.')||part==='launchlane-private'||part.includes('\\')||part.includes(':')))return new Response('not found',{status:404});
 let target=path.resolve(root,'.'+pathname);
 if(target!==root&&!target.startsWith(root+path.sep))return new Response('not found',{status:404});
 if(target===root||!fs.existsSync(target)&&!path.extname(target))target=path.join(root,'index.html');
 try{const stat=fs.lstatSync(target);if(!stat.isFile()||stat.isSymbolicLink()||fs.realpathSync(target)!==target||!target.startsWith(root+path.sep))return new Response('not found',{status:404});
  const bytes=fs.readFileSync(target);return new Response(request.method==='HEAD'?null:bytes,{headers:{'content-type':mime[path.extname(target)]||'application/octet-stream','content-length':String(bytes.length)}});
 }catch{return new Response('not found',{status:404})}
}};
const bindings=Object.fromEntries(descriptor.requiredEnvironmentKeys.filter(key=>typeof process.env[key]==='string').map(key=>[key,process.env[key]]));
bindings[descriptor.databaseBinding]=new DatabaseBinding(database);bindings[descriptor.assetsBinding]=assets;
const health=()=>({ok:true,databaseReady:true,migrations:migration.total,authenticationConfigured:descriptor.requiredEnvironmentKeys.every(key=>typeof bindings[key]==='string'&&bindings[key].length>=4)});
const server=createServer(async(req,res)=>{
 try{
  if(!req.url||!req.url.startsWith('/')||req.url.startsWith('//')){res.writeHead(400);res.end();return}
  const headers=new Headers();for(const[key,value]of Object.entries(req.headers))if(value!==undefined&&!['host','cf-connecting-ip','content-length','transfer-encoding'].includes(key))headers.set(key,Array.isArray(value)?value.join(','):value);
  headers.set('cf-connecting-ip',req.socket.remoteAddress||'local');
  const method=req.method||'GET';let bytes=0;const chunks=[];
  if(!['GET','HEAD'].includes(method))for await(const chunk of req){bytes+=chunk.length;if(bytes>1048576){res.writeHead(413);res.end();return}chunks.push(chunk)}
  const request=new Request(new URL(req.url,'https://worker.invalid'),{method,headers,...(!['GET','HEAD'].includes(method)?{body:Buffer.concat(chunks)}:{})});
  const response=new URL(request.url).pathname==='/launchlane-health'&&method==='GET'?Response.json(health()):await worker.fetch(request,bindings);
  res.statusCode=response.status;for(const[key,value]of response.headers)if(key!=='set-cookie')res.setHeader(key,value);const cookies=response.headers.getSetCookie();if(cookies.length)res.setHeader('set-cookie',cookies);
  if(!response.body||method==='HEAD'){res.end();return}await new Promise((resolve,reject)=>{const stream=Readable.fromWeb(response.body);stream.once('error',reject);res.once('finish',resolve);res.once('close',resolve);stream.pipe(res)});
 }catch{if(!res.headersSent)res.writeHead(500);res.end('worker request failed')}
});
const port=Number(process.env.PORT||3000);if(!Number.isInteger(port)||port<1||port>65535)throw Error('WORKER_PORT_INVALID');
server.listen(port,'0.0.0.0',()=>console.log('Launchlane: Worker adapter listening'));
for(const signal of ['SIGINT','SIGTERM'])process.once(signal,()=>server.close(()=>{database.close();process.exit(0)}));
`;

export const workerSqliteProgramHash = createHash("sha256").update(JSON.stringify([workerSqliteDatabaseProgram, workerSqliteBuildProgram, workerSqliteServerProgram])).digest("hex");
export function workerSqliteFiles(adapter: WorkerSqliteAdapter): Map<string, Buffer> {
  return new Map([
    [workerSqlitePaths.database, Buffer.from(workerSqliteDatabaseProgram)], [workerSqlitePaths.build, Buffer.from(workerSqliteBuildProgram)],
    [workerSqlitePaths.server, Buffer.from(workerSqliteServerProgram)], [workerSqlitePaths.descriptor, Buffer.concat([Buffer.from(JSON.stringify(adapter)), Buffer.from([10])])],
  ]);
}
