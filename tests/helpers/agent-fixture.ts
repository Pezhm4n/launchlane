import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { readConfig } from "../../src/server/config.ts";
import { Store } from "../../src/server/persistence/store.ts";
import { prepareProjectFlow } from "../../src/server/application/project-flows.ts";
import type { Session } from "../../src/contracts/domain.ts";

export const repairBrokenSource =
  "export function invoiceTotal(lines) { return lines.reduce((sum, line) => sum + line.price, 0); }\n";
export const repairCorrectSource =
  "export function invoiceTotal(lines) { return lines.reduce((sum, line) => sum + line.price * line.quantity, 0); }\n";
export async function agentFixture(incomplete = false) {
  const directory = mkdtempSync(join(tmpdir(), "launchlane-agent-")),
    workspace = join(directory, "workspace"),
    project = join(workspace, "service"),
    state = join(directory, "state");
  let store: Store | undefined;
  const close = () => {
    if (!directory.startsWith(join(tmpdir(), "launchlane-agent-")))
      throw new Error("Unsafe test cleanup");
    try {
      if (store?.db.isOpen) store.close();
    } finally {
      rmSync(directory, { recursive: true, force: true });
    }
  };
  try {
    mkdirSync(project, { recursive: true });
    mkdirSync(state);
    writeFileSync(
      join(project, "package.json"),
      JSON.stringify({
        name: "invoice-service",
        type: "module",
        engines: { node: ">=22" },
        scripts: { ...(incomplete ? {} : { start: "node server.mjs" }), test: "node --test" },
      }),
    );
    writeFileSync(
      join(project, "server.mjs"),
      "import http from 'node:http'; http.createServer((_req,res)=>res.end('invoice service')).listen(3000);\n",
    );
    writeFileSync(join(project, "invoice.mjs"), repairBrokenSource);
    writeFileSync(
      join(project, "invoice.test.mjs"),
      "import assert from 'node:assert/strict'; import {test} from 'node:test'; import {invoiceTotal} from './invoice.mjs'; test('quantity is applied to each line without dropping zero quantities',()=>{assert.equal(invoiceTotal([{price:17,quantity:3},{price:8,quantity:0},{price:11,quantity:2}]),73);assert.equal(invoiceTotal([]),0);assert.equal(invoiceTotal([{price:2.5,quantity:4}]),10);});\n",
    );
    writeFileSync(join(project, ".env"), "DO_NOT_EXPORT=private-local-fixture-value\n");
    const config = readConfig({
      LAUNCHLANE_STATE_DIR: state,
      LAUNCHLANE_WORKSPACE_ROOT: workspace,
      LAUNCHLANE_OPERATOR_TOKEN: "operator-test-value-".repeat(3),
      LAUNCHLANE_SESSION_SECRET: "session-test-value-".repeat(3),
      MODEL_API_KEY: "model-test-value-".repeat(3),
      MODEL_ID: "gpt-6-luna",
      LAUNCHLANE_ENABLE_LIVE_MODEL: "true",
    });
    store = new Store(join(state, "state.sqlite"));
    const session: Session = {
      id: "agent-session",
      actorId: "agent-actor",
      csrfToken: "test-csrf",
      expiresAt: Date.now() + 600000,
    };
    store.saveSession(session);
    const flow = await prepareProjectFlow(
      config,
      store,
      session.actorId,
      { kind: "local", directory: "service" },
      AbortSignal.timeout(3000),
    );
    return {
      directory,
      project,
      workspace,
      config,
      store,
      session,
      flow,
      close,
    };
  } catch (error) {
    close();
    throw error;
  }
}
