import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { test } from "node:test";
import { setTimeout as pause } from "node:timers/promises";
import { startTestServer } from "../../scripts/test-server.mjs";

test("guided HTTP registration, scoped replay, context locks and read-only questions", async t => {
  const server = await startTestServer({ agentFixture: true });
  let cookie = "", csrf = "";
  const request = (path, body) => fetch(server.origin + path, {
    method: body === undefined ? "GET" : "POST", signal: AbortSignal.timeout(10000),
    headers: { origin: server.origin, ...(cookie ? { cookie } : {}), ...(body === undefined ? {} : { "content-type": "application/json", "x-csrf-token": csrf }) },
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
  });
  async function expect(response, status, code) { assert.equal(response.status, status); const value = await response.json(); if (code) assert.equal(value.error.code, code); return value; }
  async function settled(id) {
    for (let i = 0; i < 100; i++) {
      const value = await expect(await request(`/api/agent/runs/${id}`), 200);
      if (!["queued", "working"].includes(value.run.state)) return value.run;
      await pause(100);
    }
    throw Error("Bounded synthetic run did not settle");
  }
  try {
    await t.test("the structured route and scoped history require operator authentication", async () => {
      await expect(await request("/api/agent/runs?project=none&kind=publication"), 401, "AUTH_REQUIRED");
      await expect(await request("/api/agent/runs", { operation: "publish", requestKey: randomUUID(), publication: {} }), 401, "AUTH_REQUIRED");
    });
    const login = await request("/api/session", { token: server.token }); assert.equal(login.status, 200); cookie = login.headers.get("set-cookie").split(";")[0];
    csrf = (await expect(await request("/api/workspace"), 200)).session.csrfToken;
    const prepared = await expect(await request("/api/project-flows", { operation: "prepare", selection: { kind: "sample", directory: "examples/node-service" } }), 201);
    const publication = { projectId: prepared.flow.id, sourceHash: prepared.flow.profile.sourceHash, path: "/", expectedText: null };
    await t.test("unknown fields, invalid paths, stale source and invalid history filters fail before model work", async () => {
      await expect(await request("/api/agent/runs", { operation: "publish", requestKey: randomUUID(), publication: { ...publication, approved: true } }), 400, "INVALID_INPUT");
      await expect(await request("/api/agent/runs", { operation: "publish", requestKey: randomUUID(), publication: { ...publication, path: "//other.test" } }), 400, "INVALID_INPUT");
      await expect(await request("/api/agent/runs", { operation: "publish", requestKey: randomUUID(), publication: { ...publication, sourceHash: "0".repeat(64) } }), 409, "PROJECT_CHANGED");
      await expect(await request("/api/agent/runs?project=none&kind=unknown"), 400, "INVALID_INPUT");
    });
    const registrations = await Promise.all([randomUUID(), randomUUID()].map(requestKey => request("/api/agent/runs", { operation: "publish", requestKey, publication })));
    const values = await Promise.all(registrations.map(response => response.json()));
    await t.test("two browser registrations join one persisted mission and scoped GET performs replay only", async () => {
      assert.deepEqual(registrations.map(response => response.status).sort(), [200,201]);
      assert.equal(values[0].run.id, values[1].run.id);
      const run = await settled(values[0].run.id);
      assert.equal(run.mission.projectId, publication.projectId); assert.equal(run.effect, "no_remote_changes");
      const saved = await expect(await request(`/api/agent/runs?project=${publication.projectId}&kind=publication`), 200);
      assert.equal(saved.run.id, run.id);
      assert.equal((await expect(await request(`/api/agent/runs?project=${publication.projectId}&kind=conversation`),200)).run,null);
    });
    await t.test("structured continuation preserves the run and concurrent keys join without accepting a new goal", async () => {
      const before = await settled(values[0].run.id);
      await expect(await request(`/api/agent/runs/${before.id}`, { operation: "resume-publication", revision: before.revision, requestKey: randomUUID(), goal: "override" }), 400, "INVALID_INPUT");
      const responses = await Promise.all([randomUUID(), randomUUID()].map(requestKey => request(`/api/agent/runs/${before.id}`, { operation: "resume-publication", revision: before.revision, requestKey })));
      for (const response of responses) {
        const value = await expect(response, 200); assert.equal(value.run.id, before.id); assert.deepEqual(value.run.mission, before.mission);
      }
      assert.equal((await settled(before.id)).id, before.id);
    });
    const question = await expect(await request("/api/agent/runs", { operation: "question", requestKey: randomUUID(), goal: "آزمون توقف", projectId: publication.projectId }), 201);
    await t.test("an active optional question cannot start parallel source selection, account changes or a technical write", async () => {
      await expect(await request("/api/project-flows", { operation: "prepare", selection: { kind: "sample", directory: "examples/node-service" } }), 409, "AGENT_BUSY");
      await expect(await request("/api/connections/liara", { operation: "select", app: server.app }), 409, "AGENT_BUSY");
      await expect(await request("/api/actions/restart", { incidentRunId: randomUUID() }), 409, "AGENT_BUSY");
      assert.equal((await expect(await request(`/api/agent/runs?project=${publication.projectId}&kind=publication`),200)).run.id, values[0].run.id);
    });
    const active = await expect(await request(`/api/agent/runs/${question.run.id}`),200);
    const cancelled = await request(`/api/agent/runs/${question.run.id}`, { operation: "cancel", revision: active.run.revision });
    assert.equal(cancelled.status,200);
    assert.equal((await settled(question.run.id)).state,"cancelled");
    await expect(await request(`/api/agent/runs/${question.run.id}`, { operation: "resume-publication", revision: active.run.revision, requestKey: randomUUID() }), 409, "AGENT_CONFLICT");
  } finally { await server.close(); }
});
