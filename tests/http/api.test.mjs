import assert from "node:assert/strict";
import { appendFile } from "node:fs/promises";
import { join } from "node:path";
import { request as httpRequest } from "node:http";
import { test } from "node:test";
import { startTestServer } from "../../scripts/test-server.mjs";

test("production HTTP boundary: authentication, scope, immutable source, decision/replay and disabled execution", async (t) => {
  const server = await startTestServer();
  let cookie = "",
    csrf = "";
  const request = (path, body, extra = {}) =>
    fetch(`${server.origin}${path}`, {
      method: body === undefined ? "GET" : "POST",
      signal: AbortSignal.timeout(10_000),
      headers: {
        origin: server.origin,
        ...(cookie ? { cookie } : {}),
        ...(body === undefined ? {} : { "content-type": "application/json", "x-csrf-token": csrf }),
        ...extra,
      },
      ...(body === undefined ? {} : { body: JSON.stringify(body) }),
    });
  async function expects(response, status, code) {
    assert.equal(response.status, status);
    const payload = await response.json();
    if (code) assert.equal(payload.error.code, code);
    return payload;
  }
  try {
    await t.test("the Persian root renders the same RTL marker expected during hydration", async () => {
      const response = await request("/");
      assert.equal(response.status, 200);
      const html = await response.text();
      assert.match(html, /<html[^>]*lang="fa"[^>]*dir="rtl"[^>]*class="rtl-enabled"/);
      assert.ok(!html.includes("suppressHydrationWarning"));
    });
    await t.test(
      "privileged reads require a session; host and cross-origin are rejected",
      async () => {
        await expects(await request("/api/workspace"), 401, "AUTH_REQUIRED");
        await expects(await request("/api/connections/github"), 401, "AUTH_REQUIRED");
        await expects(await request("/api/connections/liara"), 401, "AUTH_REQUIRED");
        await expects(await request("/api/domains/guide", { hostname: "example.ir", dns: "existing", target: null }), 401, "AUTH_REQUIRED");
        await expects(await request("/api/project-flows"), 401, "AUTH_REQUIRED");
        await expects(await request("/api/incidents/runs"), 401, "AUTH_REQUIRED");
        await expects(await request(`/api/incidents/handoff?id=${"a".repeat(36)}`), 401, "AUTH_REQUIRED");
        await expects(await request("/api/actions/restart", { incidentRunId: "a".repeat(36) }), 401, "AUTH_REQUIRED");
        await expects(
          await request(`/api/actions/${"a".repeat(36)}/observe`, {}),
          401,
          "AUTH_REQUIRED",
        );
        await expects(
          await request("/api/incidents/practice", {
            scenario: "configuration",
          }),
          401,
          "AUTH_REQUIRED",
        );
        await expects(
          await request("/api/projects/archive", {
            directory: "examples/node-service",
            sourceHash: "a".repeat(64),
          }),
          401,
          "AUTH_REQUIRED",
        );
        await expects(
          await request("/api/session", { token: "wrong" }, { origin: "https://evil.test" }),
          403,
          "ORIGIN_DENIED",
        );
        // Node fetch overwrites Host. Send the actual hostile wire header with node:http.
        const hostileHost = await new Promise((resolve, reject) => {
          const outgoing = httpRequest(
            `${server.origin}/api/session`,
            {
              method: "POST",
              headers: {
                host: "evil.test",
                origin: server.origin,
                "content-type": "application/json",
              },
            },
            (incoming) => {
              let body = "";
              incoming.setEncoding("utf8");
              incoming.on("data", (part) => {
                body += part;
              });
              incoming.on("end", () =>
                resolve(new Response(body, { status: incoming.statusCode })),
              );
            },
          );
          outgoing.on("error", reject);
          outgoing.end(JSON.stringify({ token: server.token }));
        });
        await expects(hostileHost, 403, "HOST_DENIED");
      },
    );
    await t.test(
      "login issues an HttpOnly Strict cookie; missing/forged CSRF is denied",
      async () => {
        const response = await request("/api/session", { token: server.token });
        assert.equal(response.status, 200);
        assert.match(response.headers.get("set-cookie"), /HttpOnly/);
        assert.match(response.headers.get("set-cookie"), /SameSite=Strict/);
        cookie = response.headers.get("set-cookie").split(";")[0];
        csrf = (await response.json()).session.csrfToken;
        await expects(
          await request(
            "/api/projects/inspect",
            { directory: "examples/node-service" },
            { "x-csrf-token": "forged" },
          ),
          403,
          "CSRF_DENIED",
        );
        await expects(
          await request(
            "/api/projects/archive",
            { directory: "examples/node-service", sourceHash: "a".repeat(64) },
            { "x-csrf-token": "forged" },
          ),
          403,
          "CSRF_DENIED",
        );
        const workspace = await expects(await request("/api/workspace"), 200);
        assert.equal(workspace.capabilities.model.state, "unavailable");
        assert.equal(workspace.capabilities.mutations.state, "unavailable");
        assert.ok(!JSON.stringify(workspace).includes(server.token));
      },
    );
    await t.test(
      "restart is authenticated, CSRF protected, narrowly validated and disabled without contacting a real account",
      async () => {
        await expects(await request("/api/actions/restart", { incidentRunId: "a".repeat(36) }, { "x-csrf-token": "forged" }), 403, "CSRF_DENIED");
        await expects(await request("/api/actions/restart", { incidentRunId: "a".repeat(36), app: "unauthorized" }), 400, "INVALID_INPUT");
        await expects(await request("/api/actions/restart", { incidentRunId: "a".repeat(36) }), 403, "MUTATIONS_DISABLED");
        const workspace = await expects(await request("/api/workspace"), 200);
        assert.equal(workspace.features.deployment, false);
        assert.equal(workspace.actions.length, 0);
      },
    );
    await t.test("domain guide validates hostnames and remains unverified without credentials; no probe target or approval is created", async () => {
      const input = { hostname: " Shop.Example.IR. ", dns: "existing", target: null };
      await expects(await request("/api/domains/guide", input, { "x-csrf-token": "forged" }), 403, "CSRF_DENIED");
      await expects(await request("/api/domains/guide", input, { origin: "https://evil.test" }), 403, "ORIGIN_DENIED");
      await expects(await request("/api/domains/guide", { ...input, hostname: "https://example.ir/?secret=private" }), 400, "DOMAIN_NAME_INVALID");
      await expects(await request("/api/domains/guide", { ...input, hostname: "site.tk" }), 400, "DOMAIN_TLD_UNSUPPORTED");
      await expects(await request("/api/domains/guide", { ...input, execute: true }), 400, "INVALID_INPUT");
      const response = await request("/api/domains/guide", input);
      assert.equal(response.headers.get("cache-control"), "no-store");
      assert.equal(response.headers.get("x-content-type-options"), "nosniff");
      const { guide } = await expects(response, 200);
      assert.equal(guide.hostname, "shop.example.ir");
      assert.equal(guide.connection, "not_connected");
      assert.equal(guide.target, null);
      assert.equal(guide.verification, "not_checked");
      assert.ok(!("records" in guide));
      const workspace = await expects(await request("/api/workspace"), 200);
      assert.equal(workspace.features.probeOrigin, null);
      assert.deepEqual(workspace.actions, []);
    });
    await t.test(
      "GitHub account metadata is private and connection commands require CSRF without starting login",
      async () => {
        const state = await expects(await request("/api/connections/github"), 200);
        assert.equal(state.connection, null);
        assert.equal(typeof state.toolReady, "boolean");
        await expects(
          await request("/api/connections/github", {
            operation: "repositories",
            query: "x".repeat(101),
            page: 1,
          }),
          400,
          "GITHUB_INPUT_INVALID",
        );
        await expects(
          await request("/api/connections/github", {
            operation: "folders",
            owner: "octocat",
            name: "sample",
            repositoryId: 1,
            revision: "c".repeat(40),
            directory: "../outside",
          }),
          403,
          "UNSAFE_PATH",
        );
        await expects(
          await request(
            "/api/connections/github",
            { operation: "start" },
            { "x-csrf-token": "forged" },
          ),
          403,
          "CSRF_DENIED",
        );
        await expects(
          await request("/api/connections/github", { operation: "shell" }),
          400,
          "INVALID_OPERATION",
        );
        await expects(
          await request("/api/connections/github", {
            operation: "status",
            id: "not-an-active-run",
          }),
          410,
          "GITHUB_LOGIN_EXPIRED",
        );
        await expects(
          await request("/api/connections/github", {
            operation: "repositories",
            query: "",
            page: 1,
          }),
          403,
          "GITHUB_AUTH_REQUIRED",
        );
      },
    );
    await t.test(
      "Liara connection metadata does not validate or adopt a key without an explicit authorized request",
      async () => {
        const state = await expects(await request("/api/connections/liara"), 200);
        assert.equal(state.connection, null);
        assert.equal(state.configuredKey, false);
        assert.equal(state.serviceReadsEnabled, false);
        await expects(
          await request(
            "/api/connections/liara",
            { operation: "connect", key: "synthetic-never-sent" },
            { "x-csrf-token": "forged" },
          ),
          403,
          "CSRF_DENIED",
        );
        await expects(
          await request("/api/connections/liara", { operation: "connect" }),
          400,
          "LIARA_KEY_REQUIRED",
        );
        await expects(
          await request("/api/connections/liara", {
            operation: "select",
            app: "sample-app",
          }),
          403,
          "LIARA_APP_REQUIRED",
        );
        await expects(
          await request("/api/connections/liara", { operation: "execute" }),
          400,
          "INVALID_OPERATION",
        );
      },
    );
    await t.test(
      "project flows prepare and recover a local result without cloud access and preserve it on failed selection",
      async () => {
        await expects(
          await request(
            "/api/project-flows",
            {
              operation: "prepare",
              selection: { kind: "local", directory: "examples/node-service" },
            },
            { "x-csrf-token": "forged" },
          ),
          403,
          "CSRF_DENIED",
        );
        const prepared = await expects(
          await request("/api/project-flows", {
            operation: "prepare",
            selection: { kind: "local", directory: "examples/node-service" },
          }),
          201,
        );
        assert.equal(prepared.flow.status, "ready");
        assert.ok(prepared.flow.artifact.archiveHash);
        assert.equal(prepared.action, null);
        const restored = await expects(
          await request(`/api/project-flows?id=${prepared.flow.id}`),
          200,
        );
        assert.equal(restored.flow.id, prepared.flow.id);
        assert.equal(restored.flow.profile.sourceHash, prepared.flow.profile.sourceHash);
        await expects(
          await request("/api/project-flows", {
            operation: "prepare",
            selection: { kind: "local", directory: "missing-folder" },
          }),
          404,
          "FOLDER_NOT_FOUND",
        );
        assert.equal(
          (await expects(await request("/api/project-flows"), 200)).flow.id,
          prepared.flow.id,
        );
        await expects(
          await request("/api/project-flows", {
            operation: "propose",
            id: prepared.flow.id,
            app: "sample-node",
            port: null,
          }),
          403,
          "LIARA_AUTH_REQUIRED",
        );
        assert.ok(!JSON.stringify(prepared).includes(server.workspace));
      },
    );
    await t.test(
      "incident results persist per actor and sample comparison stays bound to the original observation",
      async () => {
        const empty = await expects(await request("/api/incidents/runs?kind=live"), 200);
        assert.equal(empty.run, null);
        await expects(
          await request(
            "/api/incidents/runs",
            { operation: "sample", scenario: "configuration" },
            { "x-csrf-token": "forged" },
          ),
          403,
          "CSRF_DENIED",
        );
        const sample = await expects(
          await request("/api/incidents/runs", {
            operation: "sample",
            scenario: "configuration",
          }),
          201,
        );
        assert.equal(sample.run.kind, "sample");
        assert.equal(sample.run.analysis, "scripted");
        const saved = await expects(await request(`/api/incidents/runs?id=${sample.run.id}`), 200);
        assert.equal(saved.run.evidence.collectedAt, sample.run.evidence.collectedAt);
        const compared = await expects(
          await request("/api/incidents/runs", {
            operation: "compare",
            id: sample.run.id,
            choice: "related",
          }),
          200,
        );
        assert.equal(compared.run.evidence.collectedAt, sample.run.evidence.collectedAt);
        assert.equal(compared.run.after.entries[0].fact.status, 200);
        const handoffResponse = await request(`/api/incidents/handoff?id=${sample.run.id}`);
        assert.equal(handoffResponse.headers.get("cache-control"), "no-store");
        assert.equal(handoffResponse.headers.get("x-content-type-options"), "nosniff");
        const exported = await expects(handoffResponse, 200);
        assert.equal(exported.handoff.mode, "sample");
        assert.equal(exported.handoff.runId, sample.run.id);
        assert.match(exported.handoff.markdown, /حالت آزمایشی/);
        assert.match(exported.handoff.markdown, /همان صفحه در بررسی تازه پاسخ موفق داد/);
        assert.equal(exported.handoff.markdown.includes(server.token), false);
        await expects(await request(`/api/incidents/handoff?id=${sample.run.id}`, undefined, { origin: "https://evil.test" }), 403, "ORIGIN_DENIED");
        await expects(await request(`/api/incidents/handoff?id=${sample.run.id}&id=${sample.run.id}`), 400, "INVALID_INPUT");
        await expects(await request("/api/incidents/handoff?id=not-a-run"), 400, "INVALID_INPUT");
        await expects(await request("/api/incidents/handoff?id=00000000-0000-0000-0000-000000000000"), 404, "NOT_FOUND");
        await expects(
          await request("/api/incidents/runs", {
            operation: "collect",
            app: server.app,
            symptom: "errors",
            problem: "صفحه خطای سرور دارد",
            path: "/",
          }),
          403,
          "LIVE_LIARA_DISABLED",
        );
        await expects(
          await request("/api/incidents/runs", {
            operation: "analyze",
            id: sample.run.id,
          }),
          403,
          "ANALYSIS_UNAVAILABLE",
        );
        await expects(
          await request("/api/connections/liara", {
            operation: "site",
            origin: "example.com",
          }),
          403,
          "LIARA_APP_REQUIRED",
        );
        await expects(
          await request("/api/incidents/runs", { operation: "shell" }),
          400,
          "INVALID_OPERATION",
        );
      },
    );
    let profile, artifact;
    await t.test(
      "folder picker reads only the allowed server workspace and reports missing folders accurately",
      async () => {
        await expects(
          await request("/api/projects/folders", { directory: "." }, { "x-csrf-token": "forged" }),
          403,
          "CSRF_DENIED",
        );
        const root = await expects(await request("/api/projects/folders", { directory: "." }), 200);
        assert.ok(root.folders.some((item) => item.directory === "examples"));
        assert.ok(!JSON.stringify(root).includes(server.workspace));
        await expects(
          await request("/api/projects/folders", { directory: "../escape" }),
          403,
          "UNSAFE_PATH",
        );
        await expects(
          await request("/api/projects/folders", {
            directory: "missing-folder",
          }),
          404,
          "FOLDER_NOT_FOUND",
        );
        await expects(
          await request("/api/projects/inspect", {
            directory: "missing-folder",
          }),
          404,
          "FOLDER_NOT_FOUND",
        );
      },
    );
    await t.test(
      "incident practice stays explicitly simulated, validates input and cannot enable live reads",
      async () => {
        await expects(
          await request(
            "/api/incidents/practice",
            { scenario: "configuration" },
            { "x-csrf-token": "forged" },
          ),
          403,
          "CSRF_DENIED",
        );
        await expects(
          await request("/api/incidents/practice", { scenario: "unknown" }),
          400,
          "INVALID_INPUT",
        );
        const practice = await expects(
          await request("/api/incidents/practice", {
            scenario: "configuration",
          }),
          200,
        );
        assert.equal(practice.evidence.mode, "simulated");
        assert.equal(practice.analysis, "scripted");
        assert.equal(practice.providerRequests, 0);
        assert.ok(!JSON.stringify(practice).includes(server.token));
        for (const [choice, expected] of [
          ["related", "verified"],
          ["unrelated", "still_failing"],
        ]) {
          const compare = await expects(
            await request("/api/incidents/practice", {
              scenario: "configuration",
              choice,
            }),
            200,
          );
          assert.equal(compare.verification.outcome, expected);
          assert.equal(compare.changedInfrastructure, false);
        }
        const now = Date.now();
        await expects(
          await request("/api/incidents/evidence", {
            app: server.app,
            start: now - 60_000,
            end: now + 10_000,
            since: "documentary-only",
            path: "/",
          }),
          403,
          "LIVE_LIARA_DISABLED",
        );
      },
    );
    await t.test(
      "inspection stays local, detects the sample, excludes traversal and never uploads",
      async () => {
        const payload = await expects(
          await request("/api/projects/inspect", {
            directory: "examples/node-service",
          }),
          200,
        );
        profile = payload.profile;
        assert.equal(payload.uploaded, false);
        assert.equal(payload.modelUsed, false);
        assert.equal(profile.runtime, "node");
        assert.equal(profile.port, 3000);
        assert.ok(profile.envNames.includes("WELCOME_MESSAGE"));
        await expects(
          await request("/api/projects/inspect", { directory: "../escape" }),
          403,
          "UNSAFE_PATH",
        );
        await expects(
          await request("/api/projects/inspect", {
            directory: "examples/node-service",
            execute: true,
          }),
          400,
          "INVALID_INPUT",
        );
      },
    );
    const prepare = async () => {
      const payload = await expects(
        await request("/api/projects/archive", {
          directory: profile.directory,
          sourceHash: profile.sourceHash,
        }),
        201,
      );
      assert.equal(payload.uploaded, false);
      assert.equal(payload.modelUsed, false);
      assert.equal(payload.artifact.sourceHash, profile.sourceHash);
      assert.equal(payload.artifact.fileCount, profile.manifest.length);
      assert.match(payload.artifact.archiveHash, /^[a-f0-9]{64}$/);
      return payload.artifact;
    };
    await t.test(
      "local archive preparation validates the current source and never trusts a supplied archive hash",
      async () => {
        await expects(
          await request("/api/projects/archive", {
            directory: profile.directory,
            sourceHash: "c".repeat(64),
          }),
          409,
          "SOURCE_CHANGED",
        );
        artifact = await prepare();
        await expects(
          await request("/api/actions", {
            directory: profile.directory,
            sourceHash: profile.sourceHash,
            artifactHash: "c".repeat(64),
            app: server.app,
            port: 3000,
          }),
          409,
          "ARTIFACT_NOT_FOUND",
        );
      },
    );
    await t.test("target mismatch and changed source cannot receive approval", async () => {
      const body = {
        directory: profile.directory,
        sourceHash: profile.sourceHash,
        artifactHash: artifact.archiveHash,
        app: server.app,
        port: 3000,
      };
      await expects(
        await request("/api/actions", { ...body, app: "other-app" }),
        403,
        "SCOPE_DENIED",
      );
      await appendFile(
        join(server.workspace, "examples/node-service/server.mjs"),
        "\n// changed after inspection\n",
      );
      await expects(await request("/api/actions", body), 409, "SOURCE_CHANGED");
      profile = (
        await expects(
          await request("/api/projects/inspect", {
            directory: profile.directory,
          }),
          200,
        )
      ).profile;
      await expects(
        await request("/api/actions", {
          ...body,
          sourceHash: profile.sourceHash,
        }),
        409,
        "ARTIFACT_MISMATCH",
      );
      artifact = await prepare();
    });
    await t.test(
      "deployment proposal and observation enforce authentication, CSRF and disabled gates",
      async () => {
        await expects(
          await request(`/api/actions/${"a".repeat(36)}/observe`, {}, { "x-csrf-token": "wrong" }),
          403,
          "CSRF_DENIED",
        );
        await expects(
          await request("/api/project-flows", {
            operation: "propose-deploy",
            id: "a".repeat(36),
            app: server.app,
            port: 3000,
            workload: {
              origin: "https://example.com",
              path: "/",
              status: 200,
              revision: "sample-v1",
            },
          }),
          403,
          "MUTATIONS_DISABLED",
        );
        await expects(
          await request(`/api/actions/${"a".repeat(36)}/observe`, {}),
          404,
          "NOT_FOUND",
        );
      },
    );
    await t.test(
      "approved/rejected actions persist and execution remains disabled on the server",
      async () => {
        const propose = async () =>
          (
            await expects(
              await request("/api/actions", {
                directory: profile.directory,
                sourceHash: profile.sourceHash,
                artifactHash: artifact.archiveHash,
                app: server.app,
                port: 3000,
              }),
              201,
            )
          ).action;
        const approved = await propose();
        assert.equal(approved.spec.version, 2);
        assert.equal(approved.spec.artifactHash, artifact.archiveHash);
        const decisionPath = `/api/actions/${approved.id}/decision`;
        await expects(
          await request(decisionPath, {
            hash: "b".repeat(64),
            decision: "approve",
          }),
          409,
          "STALE_ACTION",
        );
        await expects(
          await request(decisionPath, {
            hash: approved.hash,
            decision: "approve",
          }),
          200,
        );
        await expects(
          await request(decisionPath, {
            hash: approved.hash,
            decision: "approve",
          }),
          409,
          "ACTION_CONFLICT",
        );
        await expects(
          await request(`/api/actions/${approved.id}/execute`, {}),
          403,
          "MUTATIONS_DISABLED",
        );
        const rejected = await propose();
        await expects(
          await request(`/api/actions/${rejected.id}/decision`, {
            hash: rejected.hash,
            decision: "reject",
          }),
          200,
        );
        const workspace = await expects(await request("/api/workspace"), 200);
        assert.equal(workspace.actions.find((a) => a.id === approved.id).state, "approved");
        assert.equal(workspace.actions.find((a) => a.id === rejected.id).state, "cancelled");
        assert.ok(workspace.actions.every((action) => action.attemptId === null));
      },
    );
    await t.test(
      "malformed/oversized inputs and logout have explicit sanitized outcomes",
      async () => {
        await expects(
          await request("/api/projects/inspect", {
            directory: "x".repeat(9000),
          }),
          413,
          "INPUT_LIMIT",
        );
        const response = await fetch(`${server.origin}/api/session`, {
          method: "DELETE",
          headers: { origin: server.origin, cookie, "x-csrf-token": csrf },
        });
        assert.equal(response.status, 200);
        await expects(await request("/api/workspace"), 401, "AUTH_REQUIRED");
      },
    );
  } finally {
    await server.close();
  }
});
