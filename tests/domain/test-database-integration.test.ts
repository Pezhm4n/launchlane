import assert from "node:assert/strict";
import { createHash, randomUUID } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { PassThrough } from "node:stream";
import { EventEmitter } from "node:events";
import { runInNewContext } from "node:vm";
import { test } from "node:test";
import { agentFixture } from "../helpers/agent-fixture.ts";
import { prepareProjectFlow } from "../../src/server/application/project-flows.ts";
import { CodeRepairAdapter, repairConsent, assertDockerExecutionSettled } from "../../src/server/agent/code-repair.ts";
import { captureProject } from "../../src/server/workspace/inspect.ts";
import { fullstackPreparation } from "../../src/server/agent/fullstack-preparation.ts";
import { preparationPaths } from "../../src/server/agent/preparation.ts";
import { fullstackTestCommand } from "../../src/contracts/fullstack.ts";
import { parseProjectBuildPlan, projectBuildImage } from "../../src/contracts/project-build.ts";
import { postgresTestImage, parseDisposableTestDatabase } from "../../src/contracts/test-database.ts";
import { disposableDatabaseProgram } from "../../src/server/agent/test-database.ts";
import { sandboxProxyKeys } from "../../src/server/agent/docker-proxy.ts";
import { runContainerBuild, type CommandResult, type docker } from "../../src/server/agent/container.ts";
import { assembleFullstackArtifact } from "../../src/server/agent/fullstack-artifact.ts";
import { validateBuildOutput } from "../../src/server/agent/build-output.ts";
import { persistBuildOutput } from "../../src/server/agent/build-output-store.ts";
import { fingerprint } from "../../src/server/policy/action.ts";
import { Store } from "../../src/server/persistence/store.ts";

const sourceHash = "a".repeat(64), pgId = "1".repeat(64), nodeId = "2".repeat(64), endpoint = {socketPath:"/var/run/docker.sock"};
const result = (output="",exitCode:number|null=0):CommandResult=>({output,exitCode,signal:null});
const testDatabase = {version:1,kind:"postgresql",purpose:"compatibility_test",image:postgresTestImage,environmentKeys:["AUTH_DB_URL","AI_HISTORY_TEST_DB_URL"],requiredRelations:["public.users"]} as const;

async function sourceFixture() {
  const f=await agentFixture();
  const files:Record<string,string>={
    "package.json":JSON.stringify({name:"controlled-compatibility",engines:{node:"22"},scripts:{start:"node frontend-server.cjs",server:"node server.cjs",build:"node build.cjs","test:db":"node --test integration.test.mjs"},dependencies:{react:"18",express:"4",pg:"8"},devDependencies:{vite:"6"}}),
    "package-lock.json":JSON.stringify({lockfileVersion:3,packages:{}}),
    "vite.config.ts":"export default {build:{outDir:'build'}};",
    "frontend-server.cjs":"// source fixture; never run on the host",
    "build.cjs":"// controlled compiler entry; transport is synthetic",
    "server.cjs":"const express=require('express'),{Pool}=require('pg');const pool=new Pool({connectionString:process.env.AUTH_DB_URL});const app=express();app.use(express.static('build'));app.listen(3000);",
    "schema.sql":"CREATE TABLE IF NOT EXISTS public.users(id integer PRIMARY KEY);",
    "integration.test.mjs":"import {test} from 'node:test';test('original database oracle',()=>{if(!process.env.AI_HISTORY_TEST_DB_URL)throw Error('test database required')});",
  };
  for(const [path,content]of Object.entries(files))await writeFile(join(f.project,path),content);
  const flow=await prepareProjectFlow(f.config,f.store,f.session.actorId,{kind:"local",directory:"service"},AbortSignal.timeout(10000));
  const captured=await captureProject(f.project,"."),preparation=fullstackPreparation(captured.files,captured.profile);
  const build=parseProjectBuildPlan({version:7,nodeVersion:"22",image:projectBuildImage,fullstack:preparation,testDatabase,
    apiChecks:[{path:"/health/db",status:200,assertions:[{pointer:["auth","ok"],equals:true}]}],buildCommand:preparation.buildCommand,
    testCommand:fullstackTestCommand(preparation),startCommand:preparation.startCommand,port:preparation.port,environment:null,
    workload:{path:"/",status:200,assertion:{kind:"text",contains:"Controlled full application"}}});
  return {...f,flow,captured,preparation,build};
}

async function runFixedWorker(program:string,plan:unknown,payload:unknown,events:string[]) {
  let exitCode:number|null=null;
  const sink=new PassThrough();sink.resume();
  let cacheReleased=false;
  const fs={cpSync:()=>{},writeFileSync:()=>{},statfsSync:(path:unknown)=>{assert.equal(path,"/work");return{blocks:256,bfree:cacheReleased?128:64,bsize:4096};},
    rmSync:(path:unknown,options:unknown)=>{assert.equal(path,"/work/cache");assert.deepEqual(JSON.parse(JSON.stringify(options)),{recursive:true,force:true});cacheReleased=true;events.push("cache.release");},readFileSync:(path:unknown)=>{
    if(path===0)return JSON.stringify(payload);
    if(path==="/tarballs/manifest.json")return "[]";
    if(path==="/work/project/build/index.html")return "<!doctype html><main>Controlled full application</main>";
    throw Error("unexpected fixed-worker file");
  }};
  const spawn=(_file:string,args:string[],options:{env:Record<string,string>})=>{
    const child=Object.assign(new EventEmitter(),{stdout:new PassThrough(),stderr:new PassThrough(),kill:()=>{events.push("app.stop");}});
    const label=args.join(" ");events.push(`npm.${label}`);
    if(args[0]==="ci")assert.equal(cacheReleased,false,"install retains its integrity-checked dependency cache");
    if(label==="run build")assert.equal(cacheReleased,true,"compiler does not share its memory limit with the completed npm staging cache");
    if(args[0]==="ci"||label==="run build")assert.equal(options.env.AUTH_DB_URL,undefined,"fixture values never enter install or frontend build");
    if(label==="start"||label==="run test:db"){
      assert.equal(options.env.AUTH_DB_URL,"postgresql://launchlane_fixture@127.0.0.1:5432/launchlane_fixture");
      assert.equal(options.env.NODE_ENV,"test");
    }
    if(label!=="start")queueMicrotask(()=>{child.stdout.end("# tests 1\n# skipped 0\n");child.stderr.end();child.emit("close",0);});
    return child;
  };
  class Client {
    constructor(options:{connectionString:string;ssl:boolean}){assert.match(options.connectionString,/^postgresql:\/\/launchlane_fixture@127\.0\.0\.1:5432\/launchlane_fixture$/);assert.equal(options.ssl,false);}
    async connect(){events.push("pg.connect");}
    async query(sql:string,args:unknown[]){assert.match(sql,/pg_catalog.to_regclass/);assert.deepEqual(JSON.parse(JSON.stringify(args)),[["public.users"]]);events.push("pg.schema");return{rows:[{name:"public.users",ready:true}]};}
    async end(){events.push("pg.end");}
  }
  const require=(name:string)=>{
    if(name==="node:fs")return fs;
    if(name==="node:child_process")return{spawn};
    if(name==="node:crypto")return{createHash,randomBytes:()=>Buffer.alloc(32,7)};
    if(name==="/usr/local/lib/node_modules/npm/node_modules/cacache")return{put:async()=>{}};
    if(name==="/work/project/node_modules/pg")return{Client};
    throw Error("unexpected fixed-worker module");
  };
  const fetch=async(url:string)=>{
    assert.ok(events.includes("pg.schema"),"schema readiness precedes API checks even when HTML would become ready earlier");
    assert.match(url,/^http:\/\/127\.0\.0\.1:3000\//);
    const body=url.endsWith("/health/db")?JSON.stringify({auth:{ok:true}}):"<main>Controlled full application</main>";
    return{status:200,headers:{get:()=>url.endsWith("/health/db")?"application/json":"text/html"},body:(async function*(){yield Buffer.from(body);})()};
  };
  await runInNewContext(program,{require,Buffer,URL,fetch,console:{log:()=>{},error:()=>{}},AbortSignal,
    process:{argv:["node",JSON.stringify(plan)],stdout:sink,stderr:sink,exit:(code:number)=>{exitCode=code;}},
    setTimeout:()=>0,clearTimeout:()=>{}},{timeout:1000});
  assert.equal(exitCode,0,"the actual fixed worker program must reach a successful exit");
}

function engine(f:Awaited<ReturnType<typeof sourceFixture>>,cleanupFails=false) {
  const events:string[]=[],calls:string[][]=[];let pg=false,node=false,pgRunning=false,jobId="",hash="";
  const command:typeof docker=async(args,_signal,_maxBytes,input)=>{
    assert.deepEqual(args.slice(0,2),["--host","unix:///var/run/docker.sock"]);const a=args.slice(2);calls.push(a);
    if(a[0]==="image")return result(JSON.stringify({id:"sha256:392c708576858a9a583a1b937503a99df57ca5dae63890748f4d0f2fc848abc6",os:"linux",architecture:"amd64",digests:[`postgres@${postgresTestImage.split("@")[1]}`],volumes:{"/var/lib/postgresql/data":{}},onBuild:null}));
    if(a[0]==="create"){
      const labels=new Map<string,string>();for(const [index,value]of a.entries())if(value==="--label"){const field=a[index+1];assert.ok(field);const at=field.indexOf("=");labels.set(field.slice(0,at),field.slice(at+1));}
      const selectedJob=labels.get("ir.launchlane.job"),selectedHash=labels.get("ir.launchlane.source");assert.ok(selectedJob&&selectedHash);jobId=selectedJob;hash=selectedHash;
      const record=f.store.db.prepare("SELECT data_json FROM code_repair_jobs WHERE id=?").get(jobId);assert.ok(record);
      assert.equal(JSON.parse(String(record.data_json)).job.postgresExecutionStarted,true,"durable marker precedes both creates");
      for(const key of sandboxProxyKeys)assert.ok(a.some((value,index)=>value==="--env"&&a[index+1]===`${key}=`));
      if(a.includes(postgresTestImage)){pg=true;events.push("pg.create");return result(pgId);}
      assert.equal(a[a.indexOf("--network")+1],`container:${pgId}`);assert.equal(pgRunning,true);node=true;events.push("node.create");return result(nodeId);
    }
    if(a[0]==="inspect"){
      const ref=a.at(-1),isPg=ref===pgId||ref===`launchlane-postgres-${jobId}`,exists=isPg?pg:ref===nodeId&&node;
      if(!exists)return result(`Error: No such container: ${ref}`,1);
      if(a.includes("{{json .State}}"))return result(JSON.stringify({Running:true,OOMKilled:false}));
      const base={id:isPg?pgId:nodeId,name:isPg?`/launchlane-postgres-${jobId}`:`/launchlane-build-${jobId}`,image:isPg?postgresTestImage:projectBuildImage,
        labels:{"ir.launchlane.worker":isPg?"postgres-fixture-v1":"locked-build-v1","ir.launchlane.job":jobId,"ir.launchlane.source":hash},env:sandboxProxyKeys.map(key=>`${key}=`),network:`container:${pgId}`,ports:null};
      return result(JSON.stringify(isPg?{...base,actualImage:"sha256:392c708576858a9a583a1b937503a99df57ca5dae63890748f4d0f2fc848abc6",running:pgRunning,oom:false,user:"999:999",mounts:[],networks:pgRunning?{none:{}}:{},host:{ReadonlyRootfs:true,Privileged:false,NetworkMode:"none",PublishAllPorts:false,PortBindings:null,Binds:null,Mounts:[],Devices:[],CapAdd:null,CapDrop:["ALL"],SecurityOpt:["no-new-privileges"],Memory:536870912,MemorySwap:536870912,NanoCpus:250000000,PidsLimit:128,PidMode:"",IpcMode:"private",RestartPolicy:{Name:"no"},LogConfig:{Type:"none"},Tmpfs:{"/var/lib/postgresql/data":"rw,nosuid,nodev,noexec,size=268435456,uid=999,gid=999,mode=0700","/var/run/postgresql":"rw,nosuid,nodev,noexec,size=16777216,uid=999,gid=999,mode=0700"}}}:base));
    }
    if(a[0]==="start"){
      const record=f.store.db.prepare("SELECT data_json FROM code_repair_jobs WHERE id=?").get(jobId);assert.ok(record);
      if(a[1]===pgId){assert.equal(JSON.parse(String(record.data_json)).job.postgresFixtureId,pgId);pgRunning=true;events.push("pg.start");}
      return result(a[1]);
    }
    if(a[0]==="exec"){
      if(a.includes("pg_isready"))return result();
      if(a.includes("/proc/self/mountinfo"))return result(["/var/lib/postgresql/data","/var/run/postgresql"].map(path=>`1 0 0:2 / ${path} rw,nosuid,nodev,noexec - tmpfs tmpfs rw`).join("\n"));
      assert.ok(input);const payload=JSON.parse(input.toString());assert.deepEqual(payload.environment,[]);
      assert.equal(input.includes(Buffer.from(f.config.modelKey)),false);assert.equal(input.includes(Buffer.from("private-local-fixture-value")),false);
      const program=a[a.indexOf("-e")+1];assert.ok(program);await runFixedWorker(program,JSON.parse(a.at(-1)??"null"),payload,events);return result("synthetic command transport; fixed worker driver executed");
    }
    if(a[0]==="rm"){if(a.at(-1)===nodeId){if(cleanupFails)return result("cleanup unavailable",1);node=false;events.push("node.remove");}else{pg=false;events.push("pg.remove");}return result(a.at(-1));}
    throw Error(`unexpected controlled engine operation ${a[0]}`);
  };
  return{command,events,calls};
}

test("CodeRepair runs the real Node driver in the same disposable namespace and cannot publish synthetic test success",async()=>{
  const f=await sourceFixture();
  try{
    const transport=engine(f),adapter=new CodeRepairAdapter(f.config,f.store,undefined,undefined,{command:transport.command,endpoint});
    const scope={projectId:f.flow.id,expectedSourceHash:f.flow.profile.sourceHash,goal:"Controlled compatibility test with disposable data",allowedPaths:preparationPaths(f.captured.files,f.preparation),testFiles:[],execution:"container" as const,build:f.build,preparation:f.preparation};
    const oracle=await readFile(join(f.project,"integration.test.mjs")),queued=await adapter.start(f.session.actorId,{...scope,localWorkConsent:repairConsent(scope)},AbortSignal.timeout(20000));
    const job=await adapter.run(f.session.actorId,queued.id,AbortSignal.timeout(20000));
    assert.equal(job.state,"succeeded",JSON.stringify({code:job.errorCode,message:job.message}));assert.equal(job.artifact,null);assert.equal(job.publication,undefined);assert.equal(job.afterTest?.buildOutput,undefined);
    assert.equal(job.postgresExecutionStarted,undefined);assert.equal(job.postgresFixtureId,pgId);assert.deepEqual(job.containerIds,[pgId,nodeId]);
    assert.ok(transport.events.indexOf("cache.release")>transport.events.findIndex(event=>event.startsWith("npm.ci ")));
    assert.ok(transport.events.indexOf("cache.release")<transport.events.indexOf("npm.run build"));
    assert.ok(transport.events.indexOf("pg.schema")<transport.events.indexOf("npm.run test:db"));assert.ok(transport.events.indexOf("node.remove")<transport.events.indexOf("pg.remove"));
    assert.ok((await readFile(join(f.project,"integration.test.mjs"))).equals(oracle));assert.doesNotThrow(()=>assertDockerExecutionSettled(f.store,randomUUID()));
    assert.ok(job.postgresFixtureSourceHash);
    const html=Buffer.from("<main>synthetic test only</main>"),output=validateBuildOutput({version:1,files:[{path:"index.html",type:"file",bytes:html.length,sha256:createHash("sha256").update(html).digest("hex")}]},new Map([["index.html",html]]));
    const receipt=await persistBuildOutput(f.config.stateDir,output,{sourceHash:job.postgresFixtureSourceHash,planHash:fingerprint(f.build)});
    await assert.rejects(assembleFullstackArtifact({stateDir:f.config.stateDir,store:f.store,actorId:f.session.actorId,workspace:f.project,
      sourceHash:job.postgresFixtureSourceHash,plan:f.build,receipt,signal:AbortSignal.timeout(3000),secrets:[]}),{code:"COMPATIBILITY_ARTIFACT_NOT_PUBLISHABLE"});
  }finally{f.close();}
});

test("uncertain Node cleanup preserves the durable queue barrier even when the disposable database was removed",async()=>{
  const f=await sourceFixture();
  try{
    const transport=engine(f,true),adapter=new CodeRepairAdapter(f.config,f.store,undefined,undefined,{command:transport.command,endpoint});
    const scope={projectId:f.flow.id,expectedSourceHash:f.flow.profile.sourceHash,goal:"Controlled uncertain cleanup",allowedPaths:preparationPaths(f.captured.files,f.preparation),testFiles:[],execution:"container" as const,build:f.build,preparation:f.preparation};
    const queued=await adapter.start(f.session.actorId,{...scope,localWorkConsent:repairConsent(scope)},AbortSignal.timeout(20000));
    const job=await adapter.run(f.session.actorId,queued.id,AbortSignal.timeout(20000));
    assert.equal(job.state,"interrupted");assert.equal(job.postgresExecutionStarted,true);assert.equal(job.artifact,null);
    assert.throws(()=>assertDockerExecutionSettled(f.store,randomUUID()),{code:"SANDBOX_RECONCILIATION_REQUIRED"});assert.ok(transport.events.includes("pg.remove"));
    const reopened=new Store(join(f.config.stateDir,"state.sqlite"));
    try{assert.throws(()=>assertDockerExecutionSettled(reopened,randomUUID()),{code:"SANDBOX_RECONCILIATION_REQUIRED"});}finally{reopened.close();}
  }finally{f.close();}
});

test("test database plans reject real environment references, arbitrary images, unsafe relations and foreign namespaces",async()=>{
  const f=await sourceFixture();try{
    for(const patch of [{image:"postgres:latest"},{requiredRelations:["pg_catalog.pg_authid"]},{environmentKeys:["VITE_DATABASE_URL"]}])assert.throws(()=>parseDisposableTestDatabase({...testDatabase,...patch}));
    assert.throws(()=>parseProjectBuildPlan({...f.build,environment:{actionId:randomUUID(),fingerprint:sourceHash,keys:["AUTH_DB_URL"]}}),{code:"TEST_DATABASE_ENVIRONMENT_DENIED"});
    let commands=0;
    await assert.rejects(runContainerBuild(f.project,f.directory,f.build,AbortSignal.timeout(2000),undefined,[],{endpoint,command:async()=>{commands++;return result();},fixture:{jobId:randomUUID(),sourceHash,containerId:pgId,networkMode:`container:${pgId}`,host:"127.0.0.1",port:5432,database:"launchlane_fixture",user:"launchlane_fixture",authentication:"isolated_trust"},expectedJobId:randomUUID(),expectedSourceHash:sourceHash}),{code:"TEST_DATABASE_BINDING_CHANGED"});
    assert.equal(commands,0);
    const {testDatabase:_fixture,...legacy}=f.build;
    assert.equal("testDatabase" in parseProjectBuildPlan(legacy),false);assert.equal(fingerprint(parseProjectBuildPlan(legacy)),fingerprint(legacy),"old v7 canonical bytes are preserved");
  }finally{f.close();}
});
