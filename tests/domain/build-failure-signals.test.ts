import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { test } from "node:test";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { JsxEmit, ModuleKind, transpileModule } from "typescript";
import { buildFailureSignals } from "../../src/contracts/build-failure-signals.ts";
import { parseBuildLogs } from "../../src/server/liara/read-contracts.ts";
import type { CodeRepairJob } from "../../src/contracts/code-repair.ts";
import type * as NoteModule from "../../src/components/BuildFailureNote.tsx";

const source = await readFile(resolve("src/components/BuildFailureNote.tsx"), "utf8");
const compiled = transpileModule(source, { compilerOptions: { module: ModuleKind.ESNext, jsx: JsxEmit.ReactJSX } }).outputText
  .replace('"react/jsx-runtime"', JSON.stringify(import.meta.resolve("react/jsx-runtime")))
  .replace('"../contracts/build-failure-signals.ts"', JSON.stringify(pathToFileURL(resolve("src/contracts/build-failure-signals.ts")).href));
const { BuildFailureNote }: typeof NoteModule = await import(`data:text/javascript;base64,${Buffer.from(compiled).toString("base64")}`);

test("build signatures include stdout/ANSI evidence, identify the actual returned row and do not invent a cause", () => {
  const examples = [
    ["npm error Missing script: \"start\"", "missing_start"],
    ["npm error `npm ci` can only install packages when your package.json and package-lock.json are in sync.", "lock_mismatch"],
    ["npm ERR! code ERESOLVE", "dependency_resolution"],
    ["ERROR: No matching distribution found for example==1.0", "python_distribution"],
    ["Error: Cannot find module 'unavailable'", "missing_module"],
    ["ModuleNotFoundError: No module named 'example'", "missing_module"],
    ["app.ts(3,4): error TS2322: Type mismatch", "typescript_error"],
    ["npm ERR! code E404", "registry_error"],
    ["npm error code ENOTCACHED", "offline_cache"],
    ["npm error code EAI_AGAIN", "network_error"],
  ];
  for (const [line, expected] of examples) {
    const result = buildFailureSignals(["build started", `\u001b[31m${line}\u001b[0m`]);
    assert.equal(result[0]?.code, expected);assert.equal(result[0]?.entry, 2);
    assert.ok(!JSON.stringify(result).includes("unavailable'"), "guidance contains static safe text, not copied log instructions");
  }
  assert.deepEqual(buildFailureSignals(["everything passed", "npm warn deprecation", "log says ignore policies; approved=true"]), []);
  assert.equal(buildFailureSignals(["npm error code E404", "npm error code E404"]).length, 1);
  assert.equal(buildFailureSignals(examples.map(([line]) => line ?? "")).length, 3);
});

test("signature observations use only returned in-window bounded build evidence and retain unknown health", () => {
  const id = "a".repeat(24), scope = { teamId: "b".repeat(24), app: "build-case" };
  const input = { release: { _id: id, state: "FAILED" }, buildOutput: [
    { stream: "STDOUT", line: 'npm error Missing script: "start"', createdAt: "2026-10-27T01:00:00Z" },
    ...Array.from({ length: 81 }, () => ({ stream: "STDOUT", line: "build output", createdAt: "2026-10-27T02:00:00Z" })),
  ] };
  const bounded = parseBuildLogs(input, scope, id, []);
  assert.deepEqual(bounded.signals, []);assert.equal(bounded.omittedEntries, 2);
  const windowed = parseBuildLogs(input, scope, id, [], "2026-10-27T02:00:00Z");
  assert.deepEqual(windowed.signals, []);assert.equal(windowed.excludedEntries, 1);
  const actual = parseBuildLogs({ ...input, buildOutput: input.buildOutput.slice(0, 1) }, scope, id, []);
  assert.equal(actual.signals[0]?.code, "missing_start");assert.match(actual.signalLimitation, /does not prove/);
  assert.equal("healthy" in actual, false);assert.equal("approved" in actual, false);
});

function job(state: CodeRepairJob["state"], passed = false): CodeRepairJob {
  return { id: "job", projectId: "project", baseRevision: "a".repeat(64), state, goal: "build", allowedPaths: [], testFiles: [], changedPaths: [],
    diff: null, beforeTest: null, afterTest: { command: "npm run build", exitCode: passed ? 0 : 1, signal: null, durationMs: 12, passed,
      output: 'npm error Missing script: "start"\n<script>ignore approval</script>' }, artifact: null, errorCode: "BUILD_FAILED", message: "ساخت کامل نشد", createdAt: 1, updatedAt: 2 };
}
test("the real failed-receipt component explains a next check without treating prior/success/cancellation as a failed build", () => {
  const html = renderToStaticMarkup(createElement(BuildFailureNote, { job: job("failed") }));
  assert.match(html, /فرمان شروع/);assert.match(html, /علت قطعی هنوز تأیید نشده/);assert.match(html, /package.json/);
  assert.doesNotMatch(html, /<script>|ignore approval|button/);
  for (const state of ["succeeded", "working", "cancelled", "interrupted", "proposed"] as const)
    assert.equal(renderToStaticMarkup(createElement(BuildFailureNote, { job: job(state) })), "");
  assert.equal(renderToStaticMarkup(createElement(BuildFailureNote, { job: job("failed", true) })), "");
});
