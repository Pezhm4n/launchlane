import assert from "node:assert/strict";
import { test } from "node:test";
import { sourcePorts } from "../../src/server/workspace/ports.ts";

test("JavaScript port inspection resolves numeric constants, aliases and explicit env defaults without executing source", () => {
  for (const [source, expected] of [
    ["export const port=6067; server.listen(port,'0.0.0.0');", 6067],
    ["const port=6068, selected=port; server.listen(selected);", 6068],
    ["const port=process.env.PORT||3000;server.listen(port);", 3000],
    ["const port=Number(process.env.PORT||3000);server.listen(port);", 3000],
    ["const fallback=3001;const port=process.env['PORT']??fallback;server['listen'](port);", 3001],
    ["const port=6067;function start(){server.listen(port)}", 6067],
    ["const port=6067;{const port=7070;server.listen(port)}", 7070],
    ["#!/usr/bin/env node\nserver.listen(3_000);", 3000],
  ] as const) assert.deepEqual(sourcePorts(source), { ports: [expected], unresolved: false }, source);
  assert.deepEqual(sourcePorts("throw new Error('must not execute'); server.listen(4040);"), { ports: [4040], unresolved: false });
  assert.deepEqual(sourcePorts("server.listen(0);"), { ports: [], unresolved: false });
});

test("shadowing, mutable or reassigned bindings, imports, TDZ and unsupported expressions remain unknown", () => {
  for (const source of [
    "const port=6067;function start(port){server.listen(port)}",
    "const port=6067;{let port=7070;server.listen(port)}",
    "let port=6067;server.listen(port);",
    "const port=6067;port=7070;server.listen(port);",
    "const port=6067;({value:port}=config);server.listen(port);",
    "import {port} from './config.mjs';server.listen(port);",
    "server.listen(port);const port=6067;",
    "const port=calculatePort();server.listen(port);",
    "const port=process.env.PORT;server.listen(port);",
    "const process={env:{PORT:9000}};const port=process.env.PORT||3000;server.listen(port);",
    "const options={port:6067};options.port=7070;server.listen(options);",
    "const Number=()=>9000;const port=Number(process.env.PORT||3000);server.listen(port);",
    "Number=()=>9000;const port=Number(3000);server.listen(port);",
    "globalThis.Number=()=>9000;const port=Number(3000);server.listen(port);",
    "process.env.PORT=9000;const port=Number(process.env.PORT||3000);server.listen(port);",
    "const port=6067;try{throw 1}catch(port){server.listen(port)}",
    "const port=6067;with(config){server.listen(port)}",
    "switch(mode){case 0:const port=6067;break;case 1:server.listen(port)}",
  ]) assert.deepEqual(sourcePorts(source), { ports: [], unresolved: true }, source);
});

test("comments and string data do not invent ports, while conflicting actual listeners are preserved", () => {
  assert.deepEqual(sourcePorts("// server.listen(9000)\nconst s='server.listen(8080)';const t=`server.listen(7000)`;server.listen(3000);"),
    { ports: [3000], unresolved: false });
  assert.deepEqual(sourcePorts("const port=3000;server.listen(port);other.listen(8080);"), { ports: [3000, 8080], unresolved: false });
  assert.deepEqual(sourcePorts("const port=3000;server.listen(port);other.listen(dynamicPort);"), { ports: [3000], unresolved: true });
  assert.deepEqual(sourcePorts("const port: number=3000;server.listen(port);"), { ports: [3000], unresolved: false });
});

test("TypeScript listeners and explicit numeric conversion retain their lexical scope without executing source", () => {
  for (const source of [
    "const PORT: number=Number(process.env.PORT||'80');server.listen(PORT,'0.0.0.0' as string);",
    "const fallback='80' as const;const port=Number(process.env.PORT??fallback);server.listen(port);",
    "const port=+(process.env.PORT||'80');server.listen(port satisfies number);",
    "const port=80 as number;server.listen(port!);",
    "type Server={listen(port:number):void};declare const server:Server;const port=80;server.listen(port);",
    "throw Error('must not execute');const port=Number('80');server.listen(port);",
  ]) assert.deepEqual(sourcePorts(source), { ports: [80], unresolved: false }, source);
});

test("string sockets, ambient globals, typed shadowing and coercion outside an explicit conversion remain unknown", () => {
  for (const source of [
    "const port='80';server.listen(port);",
    "const port=process.env.PORT||'80';server.listen(port);",
    "server.listen('80');",
    "declare const Number:(value:unknown)=>number;const port=Number('80');server.listen(port);",
    "declare const process:{env:{PORT:string}};const port=Number(process.env.PORT||'80');server.listen(port);",
    "import Number=require('./number');const port=Number('80');server.listen(port);",
    "const Number=(value:string)=>8080;const port=Number('80');server.listen(port);",
    "class Test{constructor(private Number:(v:string)=>number){server.listen(Number('80'))}}",
    "namespace Number{export const x=1;}server.listen(Number('80'));",
    "function start(process:{env:{PORT:string}}){server.listen(Number(process.env.PORT||'80'));}",
    "const port=Number('65536');server.listen(port);",
    "const port=Number('80/path');server.listen(port);",
    "const port=Number('');server.listen(port);",
    "const port=Number('80');port=8080;server.listen(port);",
    "const port=Number('80');(port as number)=8080;server.listen(port);",
    "(Number as unknown)=()=>8080;server.listen(Number('80'));",
    "(globalThis as unknown).Number=()=>8080;server.listen(Number('80'));",
    "(process as unknown).env.PORT='8080';server.listen(Number(process.env.PORT||'80'));",
    "type Port=ReturnType<typeof server.listen>;server.listen(dynamic);",
  ]) assert.deepEqual(sourcePorts(source), { ports: [], unresolved: true }, source);
});
