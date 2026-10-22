import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { join } from "node:path";
import { test } from "node:test";
import { agentFixture } from "../helpers/agent-fixture.ts";
import { prepareProjectFlow } from "../../src/server/application/project-flows.ts";
import { CodeRepairAdapter, repairConsent } from "../../src/server/agent/code-repair.ts";
import { GoalModelClient } from "../../src/server/agent/model.ts";
import { nodePreparation } from "../../src/contracts/preparation.ts";
import { object, string, text } from "../../src/contracts/validation.ts";
import { executeAgentTool, currentAgentContext, toolsForAgent } from "../../src/server/agent/tools.ts";
import { RunBudget } from "../../src/server/policy/budget.ts";
import { AppError } from "../../src/server/errors.ts";

const targetPort = 6067;
function source(port: number) {
  return `import http from 'node:http';import {pathToFileURL} from 'node:url';export const port=${port};export function makeServer(){return http.createServer((_req,res)=>res.end('schedule ready'));}if(process.argv[1]&&pathToFileURL(process.argv[1]).href===import.meta.url)makeServer().listen(${port},'0.0.0.0');\n`;
}
async function fixture(kind: "missing_start" | "ports" | "leaf" = "missing_start") {
  const f = await agentFixture(), project = kind === "leaf" ? join(f.project, "apps/web") : f.project;
  if (kind === "leaf") {
    mkdirSync(project, { recursive: true });
    writeFileSync(join(f.project, "package.json"), JSON.stringify({ workspaces: ["apps/*"], scripts: { start: "do-not-run-monorepo-orchestrator" } }));
  }
  const pkg = { name: "schedule-service", type: "module", engines: { node: ">=22" },
    scripts: { ...(kind === "missing_start" ? {} : { start: "node old-server.mjs" }), test: "node --test" } };
  writeFileSync(join(project, "package.json"), JSON.stringify(pkg, null, 2));
  writeFileSync(join(project, "server.mjs"), source(kind === "ports" ? 5111 : targetPort));
  if (kind === "ports") writeFileSync(join(project, "liara.json"), JSON.stringify({ node: { version: "22" }, port: 7799, custom: { keep: true } }));
  writeFileSync(join(project, "configuration.test.mjs"), `import {test} from 'node:test';import assert from 'node:assert/strict';import {readFileSync,existsSync} from 'node:fs';import {once} from 'node:events';import {makeServer,port} from './server.mjs';test('approved entry, matching port and real HTTP response',async()=>{const pkg=JSON.parse(readFileSync(new URL('package.json',import.meta.url)));assert.equal(pkg.scripts.start,'node server.mjs');assert.equal(port,6067);if(existsSync(new URL('liara.json',import.meta.url)))assert.equal(JSON.parse(readFileSync(new URL('liara.json',import.meta.url))).port,6067);const server=makeServer();server.listen(0,'127.0.0.1');await once(server,'listening');try{const response=await fetch('http://127.0.0.1:'+server.address().port);assert.equal(response.status,200);assert.equal(await response.text(),'schedule ready');}finally{server.closeAllConnections();await new Promise(resolve=>server.close(resolve));}});\n`);
  const flow = await prepareProjectFlow(f.config, f.store, f.session.actorId,
    { kind: "local", directory: kind === "leaf" ? "service/apps/web" : "service" }, AbortSignal.timeout(3000));
  const plan = nodePreparation("server.mjs", targetPort), scope = { projectId: flow.id, expectedSourceHash: flow.profile.sourceHash,
    goal: "فرمان start باید server.mjs را اجرا کند و پورت برنامه و تنظیمات با 6067 برابر باشند؛ تست و سایر تنظیمات حفظ شوند.",
    allowedPaths: ["package.json", "server.mjs", ...(kind === "ports" ? ["liara.json"] : [])], testFiles: ["configuration.test.mjs"], preparation: plan };
  return { ...f, project, flow, scope, input: { ...scope, localWorkConsent: repairConsent(scope) } };
}
function model(f: Awaited<ReturnType<typeof fixture>>, mode = "correct") {
  return new GoalModelClient(f.config, async (_url, init) => {
    const request = object(JSON.parse(String(init.body))); assert.ok(Array.isArray(request.messages));
    const packet = object(JSON.parse(string(object(request.messages[1]).content, 100000)));
    assert.ok(Array.isArray(packet.files));
    const files = packet.files.map(object), changed = [];
    for (const file of files) {
      const path = string(file.path, 512); let content = text(file.content, 24000);
      if (!f.scope.allowedPaths.includes(path)) continue;
      if (path === "package.json") {
        const pkg = object(JSON.parse(content)), scripts = object(pkg.scripts);
        scripts.start = mode === "command" ? "node --eval unsafe" : "node server.mjs";
        if (mode === "script") scripts.postinstall = "unexpected-command";
        if (mode === "dependency") pkg.dependencies = { unexpected: "1.0.0" };
        if (mode === "engine") pkg.engines = { node: "24.x" };
        content = JSON.stringify(pkg, null, 2);
      } else if (path === "liara.json") {
        const cfg = object(JSON.parse(content)); cfg.port = targetPort;
        if (mode === "config") cfg.custom = { keep: false };
        content = JSON.stringify(cfg);
      } else if (path === "server.mjs") content = mode === "constant" ? source(targetPort).replace(`.listen(${targetPort},`, ".listen(port,") : source(targetPort);
      if (content !== file.content) changed.push({ path, beforeHash: file.sha256, content });
    }
    return Response.json({ choices: [{ finish_reason: "tool_calls", message: { role: "assistant", tool_calls: [{ id: randomUUID(), type: "function",
      function: { name: "submit_patch", arguments: JSON.stringify({ baseRevision: packet.baseRevision, files: changed }) } }] } }], usage: { total_tokens: 80 } });
  });
}

test("reviewed Node preparation repairs missing start, mismatched ports and an explicit monorepo leaf with unchanged real HTTP tests", async () => {
  for (const kind of ["missing_start", "ports", "leaf"] as const) {
    const f = await fixture(kind);
    try {
      const original = readFileSync(join(f.project, "package.json"), "utf8"), adapter = new CodeRepairAdapter(f.config, f.store, model(f));
      const proposed = await adapter.propose(f.session.actorId, f.scope, AbortSignal.timeout(3000));
      assert.equal(proposed.state, "proposed"); assert.equal(proposed.beforeTest, null); assert.equal(proposed.preparation?.startCommand, "node server.mjs");
      adapter.approve(f.session.actorId, proposed.id);
      const result = await adapter.run(f.session.actorId, proposed.id, AbortSignal.timeout(15000));
      assert.equal(result.state, "succeeded", JSON.stringify(result));
      assert.equal(result.beforeTest?.passed, false); assert.equal(result.afterTest?.passed, true); assert.ok(result.artifact);
      assert.equal(readFileSync(join(f.project, "package.json"), "utf8"), original);
      assert.ok(!result.changedPaths.includes("configuration.test.mjs"));
      if (kind === "leaf") assert.match(readFileSync(join(f.workspace, "service/package.json"), "utf8"), /do-not-run-monorepo-orchestrator/);
    } finally { f.close(); }
  }
});

test("preparation cannot smuggle another command, script, dependency, engine or unrelated config into the tested artifact", async () => {
  for (const mode of ["command", "script", "dependency", "engine", "config"]) {
    const f = await fixture("ports");
    try {
      const adapter = new CodeRepairAdapter(f.config, f.store, model(f, mode)), job = await adapter.start(f.session.actorId, f.input, AbortSignal.timeout(3000));
      const result = await adapter.run(f.session.actorId, job.id, AbortSignal.timeout(10000));
      assert.equal(result.state, "failed"); assert.equal(result.errorCode, "REPAIR_COMMAND_CHANGED");
      assert.equal(result.artifact, null); assert.equal(result.afterTest, null);
    } finally { f.close(); }
  }
});

test("preparation approval binds command and port; unsupported dependencies, roots and invalid entries are rejected before execution", async () => {
  for (const kind of ["consent", "dependencies", "root", "scope"] as const) {
    const f = await fixture();
    try {
      const adapter = new CodeRepairAdapter(f.config, f.store, model(f));
      if (kind === "consent") {
        await assert.rejects(adapter.start(f.session.actorId, { ...f.input, preparation: nodePreparation("server.mjs", 6111) }, AbortSignal.timeout(3000)),
          (e: unknown) => e instanceof AppError && e.code === "REPAIR_CONSENT_REQUIRED");
      } else if (kind === "scope") {
        const scope = { ...f.scope, allowedPaths: [...f.scope.allowedPaths, "invoice.mjs"] };
        await assert.rejects(adapter.start(f.session.actorId, { ...scope, localWorkConsent: repairConsent(scope) }, AbortSignal.timeout(3000)));
      } else {
        const pkg = object(JSON.parse(readFileSync(join(f.project, "package.json"), "utf8")));
        if (kind === "dependencies") pkg.dependencies = { next: "16.4.2" }; else pkg.workspaces = ["apps/*"];
        writeFileSync(join(f.project, "package.json"), JSON.stringify(pkg));
        const flow = await prepareProjectFlow(f.config, f.store, f.session.actorId, { kind: "local", directory: "service" }, AbortSignal.timeout(3000));
        const scope = { ...f.scope, projectId: flow.id, expectedSourceHash: flow.profile.sourceHash };
        await assert.rejects(adapter.start(f.session.actorId, { ...scope, localWorkConsent: repairConsent(scope) }, AbortSignal.timeout(3000)),
          (e: unknown) => e instanceof AppError && (e.code === "PREPARATION_BUILD_UNSUPPORTED" || e.code === "PREPARATION_LEAF_REQUIRED"));
      }
      assert.equal(f.store.db.prepare("SELECT COUNT(*) n FROM code_repair_jobs").get()?.n, 0);
      for (const entry of ["--eval.js", "x;echo.js", "../server.mjs", "x.test.mjs", "x\\server.mjs"])
        assert.throws(() => nodePreparation(entry, 3000));
    } finally { f.close(); }
  }
});

test("the shared Agent tool derives the exact preparation scope and returns a proposal without executing tests", async () => {
  const f = await fixture("ports");
  try {
    const config = { ...f.config, enableLocalRepair: true }, context = currentAgentContext(config, f.store, f.session.actorId);
    const value = object(await executeAgentTool("propose_project_preparation", { goal: "فرمان اجرا و پورت را آماده کن", entryFile: "server.mjs", port: targetPort,
      testFiles: ["configuration.test.mjs"] }, { config, store: f.store, actorId: f.session.actorId, context, createdAt: Date.now(), budget: new RunBudget(config), signal: AbortSignal.timeout(3000) }));
    const job = object(value.repairProposal);
    assert.equal(job.state, "proposed"); assert.equal(job.beforeTest, null);
    assert.deepEqual(job.allowedPaths, ["package.json", "server.mjs", "liara.json"]);
    assert.ok(!toolsForAgent({ ...config, enableLocalRepair: false }).some((tool) => tool.function.name === "propose_project_preparation"));
  } finally { f.close(); }
});

test("a legacy code-fix consent never gains permission to change package scripts", async () => {
  const f = await fixture();
  try {
    const { preparation: _preparation, ...scope } = f.scope,
      adapter = new CodeRepairAdapter(f.config, f.store, model(f)),
      job = await adapter.start(f.session.actorId, { ...scope, localWorkConsent: repairConsent(scope) }, AbortSignal.timeout(3000));
    const result = await adapter.run(f.session.actorId, job.id, AbortSignal.timeout(10000));
    assert.equal(result.state, "failed"); assert.equal(result.errorCode, "REPAIR_COMMAND_CHANGED");
    assert.equal(result.afterTest, null); assert.equal(result.artifact, null);
  } finally { f.close(); }
});

test("the real-model constant-port failure is preserved: unchanged tests and static readiness must both accept the valid entry", async () => {
  const f = await fixture();
  try {
    const adapter = new CodeRepairAdapter(f.config, f.store, model(f, "constant")),
      job = await adapter.start(f.session.actorId, f.input, AbortSignal.timeout(3000)),
      result = await adapter.run(f.session.actorId, job.id, AbortSignal.timeout(10000));
    assert.equal(result.state, "succeeded", JSON.stringify(result));
    assert.equal(result.afterTest?.passed, true); assert.ok(result.artifact);
    assert.match(result.diff ?? "", /listen\(port,/);
  } finally { f.close(); }
});
