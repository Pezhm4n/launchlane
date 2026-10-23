import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { test } from "node:test";
import { agentFixture } from "../helpers/agent-fixture.ts";
import { prepareMcpConnection, listMcpConnections, revokeMcpConnection } from "../../src/server/mcp/connections.ts";
import { parseMcpConnection } from "../../src/contracts/mcp-connection.ts";

test("local MCP setup stores scoped capabilities privately, is idempotent, never claims handshake and revokes authority", async () => {
  const f = await agentFixture();
  try {
    for (const host of ["codex", "claude", "opencode"]) {
      const key = randomUUID(), prepared = prepareMcpConnection(f.config, f.store, f.session, key, host, false);
      assert.deepEqual(parseMcpConnection(prepared), prepared); assert.equal(prepared.state, "prepared"); assert.equal(prepared.executableReadiness, "not_verified");
      assert.equal(prepareMcpConnection(f.config, f.store, f.session, key, host, false).id, prepared.id);
      assert.throws(() => prepareMcpConnection(f.config, f.store, f.session, key, host, true));
      const path = join(f.config.stateDir, "mcp-access", `${prepared.id}.json`), access = JSON.parse(readFileSync(path, "utf8"));
      assert.equal(typeof access.accessToken, "string"); assert.equal(JSON.stringify(prepared).includes(access.accessToken), false);
      assert.equal(prepared.configuration.includes(path.replaceAll("\\", "\\\\")), true);
      assert.equal(listMcpConnections(f.config, f.store, f.session).some(row => row.id === prepared.id), true);
      assert.throws(() => revokeMcpConnection(f.config, f.store, { ...f.session, actorId: "other" }, prepared.id));
      assert.equal(revokeMcpConnection(f.config, f.store, f.session, prepared.id).connection.state, "revoked"); assert.equal(existsSync(path), false);
      assert.equal(f.store.sessionExists(prepared.id, f.session.actorId, Date.now()), false);
    }
  } finally { f.close(); }
});
