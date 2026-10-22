import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type { Session } from "../../src/contracts/domain.ts";
import type { IncidentRun } from "../../src/contracts/incident-run.ts";
import { sealCredential } from "../../src/server/connections/credentials.ts";
import { readConfig } from "../../src/server/config.ts";
import { LiaraReadClient } from "../../src/server/liara/client.ts";
import { WorkloadProbe } from "../../src/server/liara/probe.ts";
import { LiaraRestartClient } from "../../src/server/liara/restart.ts";
import { Store } from "../../src/server/persistence/store.ts";
import type { Transport } from "../../src/server/providers/http.ts";

export const restartScope = { teamId: "a".repeat(24), app: "test-node" };
export const restartOrigin = "https://test-node.example.com";
export const restartSession: Session = {
  id: "restart-session",
  actorId: "alice",
  csrfToken: "synthetic",
  expiresAt: Date.now() + 600_000,
};
export function restartRun(now = Date.now()): IncidentRun {
  return {
    id: randomUUID(),
    kind: "live",
    appId: "project-exact",
    symptom: "errors",
    problem: "صفحه سفارش‌ها خطای سرور دارد",
    path: "/orders",
    scenario: null,
    evidence: {
      version: 1,
      mode: "provider_contract",
      scope: restartScope,
      window: { start: now - 60_000, end: now },
      collectedAt: now,
      entries: [
        {
          id: "workload-before",
          source: "workload",
          state: "observed",
          at: now,
          summary: "صفحه سفارش‌ها خطای 500 برگرداند.",
          details: [],
          code: null,
          fact: { kind: "http", origin: restartOrigin, path: "/orders", status: 500 },
        },
      ],
    },
    diagnosis: null,
    analysis: "ready",
    analysisMessage: null,
    after: null,
    updatedAt: now,
  };
}
export function restartFixture(write?: Transport) {
  const root = mkdtempSync(join(tmpdir(), "launchlane-restart-")),
    path = join(root, "state.sqlite"),
    config = readConfig({
      LAUNCHLANE_STATE_DIR: root,
      LIARA_TEAM_ID: restartScope.teamId,
      LAUNCHLANE_APP_ALLOWLIST: restartScope.app,
      LAUNCHLANE_SESSION_SECRET: "synthetic-restart-root-".repeat(3),
      LIARA_API_TOKEN: "synthetic-paas-never-real",
      LAUNCHLANE_ENABLE_MUTATIONS: "true",
      LAUNCHLANE_ENABLE_LIVE_LIARA: "true",
      LAUNCHLANE_PROBE_ORIGINS: JSON.stringify({ [restartScope.app]: restartOrigin }),
    });
  let store = new Store(path),
    reads = 0,
    writes = 0,
    probes = 0;
  const connection = {
    source: "token" as const,
    ciphertext: sealCredential(
      config.liaraToken,
      config.sessionSecret,
      restartSession.actorId,
      "liara",
    ),
    view: {
      provider: "liara" as const,
      status: "connected" as const,
      identityId: "synthetic-user",
      displayName: "حساب آزمون",
      login: "synthetic@example.test",
      teamId: restartScope.teamId,
      teamName: "تیم آزمون",
      selectedApp: restartScope.app,
      apps: [{ id: "project-exact", name: restartScope.app, platform: "node" }],
      checkedAt: Date.now(),
    },
  };
  store.saveConnection(restartSession.actorId, connection);
  const run = store.saveIncidentRun(restartSession.actorId, restartRun());
  const state = {
    projectId: "project-exact",
    planId: "plan-exact",
    releaseId: "release-exact",
    releaseState: "READY",
    status: 200,
    changeAfterProbe: false,
    readStatus: 200,
  };
  const deps = {
    read: new LiaraReadClient(config, async (url) => {
      reads++;
      assert.equal(new URL(url).searchParams.get("teamID"), restartScope.teamId);
      if (state.readStatus !== 200) return new Response(null, { status: state.readStatus });
      return Response.json(
        new URL(url).pathname.endsWith("/releases")
          ? {
              currentRelease: state.releaseId,
              total: 1,
              releases: [{ _id: state.releaseId, state: state.releaseState }],
            }
          : {
              project: {
                _id: state.projectId,
                project_id: restartScope.app,
                type: "node",
                planID: state.planId,
                status: "Running",
                envs: [],
              },
            },
      );
    }),
    write: new LiaraRestartClient(config, async (url, init) => {
      writes++;
      assert.equal(new URL(url).origin, "https://api.liara.ir");
      assert.equal(new URL(url).pathname, `/v1/projects/${restartScope.app}/actions/restart`);
      assert.equal(new URL(url).searchParams.get("teamID"), restartScope.teamId);
      assert.equal(init.method, "POST");
      assert.equal(init.redirect, "error");
      assert.equal(init.body, undefined);
      const executing = store
        .listActions(restartSession.actorId)
        .find((action) => action.state === "executing");
      assert.ok(executing?.attemptId);
      assert.equal(executing.restart?.stage, "request_started");
      return write ? write(url, init) : new Response(null, { status: 200 });
    }),
    probe: new WorkloadProbe(
      config,
      async () => [{ address: "93.184.216.34", family: 4 }],
      async (url) => {
        probes++;
        assert.equal(url.pathname, "/orders");
        if (state.changeAfterProbe) state.releaseId = "external-release";
        return { status: state.status, body: "public response", bytes: 15, durationMs: 3 };
      },
    ),
  };
  return {
    config,
    connection,
    run,
    state,
    deps,
    get store() {
      return store;
    },
    get counts() {
      return { reads, writes, probes };
    },
    reopen() {
      store.close();
      store = new Store(path);
      store.recoverInterrupted();
    },
    cleanup() {
      store.close();
      assert.ok(root.startsWith(join(tmpdir(), "launchlane-restart-")));
      rmSync(root, { recursive: true, force: true });
    },
  };
}
