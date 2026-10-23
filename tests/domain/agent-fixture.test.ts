import assert from "node:assert/strict";
import { existsSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { test } from "node:test";
import { Store } from "../../src/server/persistence/store.ts";
import { agentFixture } from "../helpers/agent-fixture.ts";

test("failed agent fixture setup closes its SQLite owner and removes its temporary files", async (t) => {
  const failure = new Error("Injected fixture persistence failure");
  let failedStore: Store | undefined, directory: string | undefined;
  t.mock.method(Store.prototype, "saveProjectFlow", function (this: Store) {
    failedStore = this;
    const database = this.db.location();
    assert.equal(typeof database, "string");
    assert.ok(database);
    directory = dirname(dirname(database));
    throw failure;
  });
  try {
    await assert.rejects(agentFixture(), (error: unknown) => error === failure);
    assert.ok(failedStore);
    assert.equal(failedStore.db.isOpen, false);
    assert.ok(directory);
    assert.equal(existsSync(directory), false);
  } finally {
    if (failedStore?.db.isOpen) failedStore.close();
    if (directory && existsSync(directory)) {
      assert.ok(directory.startsWith(join(tmpdir(), "launchlane-agent-")));
      rmSync(directory, { recursive: true, force: true });
    }
  }
});
