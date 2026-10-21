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
    await t.test(
      "privileged reads require a session; host and cross-origin are rejected",
      async () => {
        await expects(await request("/api/workspace"), 401, "AUTH_REQUIRED");
        await expects(
          await request("/api/session", { token: "wrong" }, { origin: "https://evil.test" }),
          403,
          "ORIGIN_DENIED",
        );
        // Node fetch overwrites Host. Send the actual hostile wire header with node:http.
        const hostileHost = await new Promise((resolve, reject) => {
          const outgoing = httpRequest(`${server.origin}/api/session`, { method: "POST", headers: { host: "evil.test", origin: server.origin, "content-type": "application/json" } }, (incoming) => {
            let body = "";
            incoming.setEncoding("utf8"); incoming.on("data", (part) => { body += part; });
            incoming.on("end", () => resolve(new Response(body, { status: incoming.statusCode })));
          });
          outgoing.on("error", reject); outgoing.end(JSON.stringify({ token: server.token }));
        });
        await expects(
          hostileHost,
          403,
          "HOST_DENIED",
        );
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
        const workspace = await expects(await request("/api/workspace"), 200);
        assert.equal(workspace.capabilities.model.state, "unavailable");
        assert.equal(workspace.capabilities.mutations.state, "unavailable");
        assert.ok(!JSON.stringify(workspace).includes(server.token));
      },
    );
    let profile;
    await t.test(
      "inspection stays local, detects the sample, excludes traversal and never uploads",
      async () => {
        const payload = await expects(
          await request("/api/projects/inspect", { directory: "examples/node-service" }),
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
    await t.test("target mismatch and changed source cannot receive approval", async () => {
      const body = {
        directory: profile.directory,
        sourceHash: profile.sourceHash,
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
        await expects(await request("/api/projects/inspect", { directory: profile.directory }), 200)
      ).profile;
    });
    await t.test(
      "approved/rejected actions persist and execution remains disabled on the server",
      async () => {
        const propose = async () =>
          (
            await expects(
              await request("/api/actions", {
                directory: profile.directory,
                sourceHash: profile.sourceHash,
                app: server.app,
                port: 3000,
              }),
              201,
            )
          ).action;
        const approved = await propose();
        const decisionPath = `/api/actions/${approved.id}/decision`;
        await expects(
          await request(decisionPath, { hash: "b".repeat(64), decision: "approve" }),
          409,
          "STALE_ACTION",
        );
        await expects(
          await request(decisionPath, { hash: approved.hash, decision: "approve" }),
          200,
        );
        await expects(
          await request(decisionPath, { hash: approved.hash, decision: "approve" }),
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
          await request("/api/projects/inspect", { directory: "x".repeat(9000) }),
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
