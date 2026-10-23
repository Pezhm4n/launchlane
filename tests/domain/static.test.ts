import assert from "node:assert/strict";
import { test } from "node:test";
import { prepareProjectFlow } from "../../src/server/application/project-flows.ts";
import { validateStaticFiles } from "../../src/server/workspace/static.ts";
import { agentFixture } from "../helpers/agent-fixture.ts";
import { decodeProfile } from "../../src/contracts/client-decode.ts";
const file = (path: string, content: string) => ({ path, content: Buffer.from(content) });
const source = [file("index.html", '<!DOCTYPE html><html><head><title>Real form</title><link rel="stylesheet" href="assets/form.css"></head><body><form><input type="email"><button>Login</button></form><script src="assets/form.js"></script></body></html>'),
  file("assets/form.css", "body {color:navy}"), file("assets/form.js", "document.querySelector('form').addEventListener('submit',e=>e.preventDefault());")];
test("plain HTML and nested assets produce a native Static artifact through source selection without running scripts or adding files", async () => {
  const f = await agentFixture(); try {
    const flow = await prepareProjectFlow(f.config, f.store, f.session.actorId, { kind: "upload", directory: ".", name: "real-form" }, AbortSignal.timeout(3000), undefined, undefined, source);
    assert.equal(flow.status, "ready"); assert.equal(flow.profile.runtime, "static"); assert.equal(flow.profile.nodeRuntime, undefined); assert.equal(flow.profile.port, 80);
    assert.deepEqual(decodeProfile({ profile: flow.profile }), flow.profile);
    assert.deepEqual(flow.profile.manifest.map(row => row.path).sort(), source.map(row => row.path).sort());
    assert.ok(flow.artifact); assert.deepEqual(validateStaticFiles(source).localAssets, ["assets/form.css", "assets/form.js"]);
  } finally { f.close(); }
});
test("a filename alone, missing assets, traversal and server/bundler JavaScript cannot authorize plain static publication", () => {
  assert.throws(() => validateStaticFiles([file("index.html", "not an HTML document")]));
  assert.throws(() => validateStaticFiles(source.filter(row => row.path !== "assets/form.js")), { code: "STATIC_ASSET_MISSING" });
  assert.throws(() => validateStaticFiles([file("index.html", '<html><script src="../private.js"></script></html>')]), { code: "STATIC_ASSET_MISSING" });
  for (const script of ["import React from 'react';", "const http=require('http');", "console.log(process.env.PRIVATE)"])
    assert.throws(() => validateStaticFiles([file("index.html", '<html><script src="main.js"></script></html>'), file("main.js", script)]), { code: "STATIC_BUILD_REQUIRED" });
});
