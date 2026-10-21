import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import {
  mkdtemp,
  mkdir,
  writeFile,
  readFile,
  readdir,
  rm,
  symlink,
  utimes,
} from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { test } from "node:test";
import { gunzipSync } from "node:zlib";
import { extract } from "tar-stream";
import type { ActionSpec, Session } from "../../src/contracts/domain.ts";
import { readConfig } from "../../src/server/config.ts";
import { Store } from "../../src/server/persistence/store.ts";
import { inspectProject } from "../../src/server/workspace/inspect.ts";
import { readArtifact } from "../../src/server/workspace/archive.ts";
import { prepareArchive } from "../../src/server/application/prepare-source.ts";
import { executeApproved } from "../../src/server/application/execute.ts";
import { AppError } from "../../src/server/errors.ts";
import { fingerprint } from "../../src/server/policy/action.ts";

const code = (expected: string) => (error: unknown) =>
  error instanceof AppError && error.code === expected;
const digest = (bytes: Buffer) => createHash("sha256").update(bytes).digest("hex");
const session: Session = {
  id: "archive-session",
  actorId: "operator",
  csrfToken: "csrf",
  expiresAt: Date.now() + 600_000,
};
const scope = { teamId: "a".repeat(24), app: "sample-node" };

async function fixture() {
  const root = await mkdtemp(join(tmpdir(), "launchlane-archive-"));
  await mkdir(join(root, "app"));
  await mkdir(join(root, "state"));
  await writeFile(
    join(root, "app/package.json"),
    JSON.stringify({ scripts: { start: "node server.mjs" } }),
  );
  await writeFile(
    join(root, "app/server.mjs"),
    "server.listen(3000); // controlled source, never executed",
  );
  const path = join(root, "state/state.sqlite");
  const store = new Store(path);
  const input = {
    store,
    stateDir: join(root, "state"),
    workspaceRoot: root,
    actorId: session.actorId,
    directory: "app",
  };
  const config = readConfig({
    LIARA_TEAM_ID: scope.teamId,
    LAUNCHLANE_APP_ALLOWLIST: scope.app,
    LAUNCHLANE_STATE_DIR: input.stateDir,
    LAUNCHLANE_ENABLE_MUTATIONS: "true",
  });
  return {
    root,
    path,
    store,
    input,
    config,
    async cleanup() {
      store.close();
      assert.ok(root.startsWith(join(tmpdir(), "launchlane-archive-")));
      await rm(root, { recursive: true, force: true });
    },
  };
}

test("the gzip archive contains exactly the inspected bytes, including Unicode and long paths; metadata is deterministic", async () => {
  const f = await fixture();
  try {
    const longFolder = `folder-${"x".repeat(140)}`;
    await mkdir(join(f.root, "app", longFolder, longFolder), {
      recursive: true,
    });
    await mkdir(join(f.root, "app/مستندات"));
    await writeFile(join(f.root, "app/مستندات/راهنما.md"), "راهنمای نمونه");
    await writeFile(join(f.root, "app", longFolder, longFolder, "entry.txt"), "long-path-payload");
    await writeFile(join(f.root, "app/.env.local"), "PRIVATE_TOKEN=not-in-archive");
    await mkdir(join(f.root, "app/node_modules"));
    await writeFile(join(f.root, "app/node_modules/hidden.txt"), "not-in-archive");
    const profile = await inspectProject(f.root, "app");
    const artifact = await prepareArchive({
      ...f.input,
      sourceHash: profile.sourceHash,
    });
    const bytes = await readArtifact(f.input.stateDir, artifact);
    assert.equal(digest(bytes), artifact.archiveHash);
    assert.equal(bytes.length, artifact.bytes);
    const unpack = extract();
    const reading = (async () => {
      const contents = new Map<string, Buffer>();
      for await (const entry of unpack) {
        assert.equal(entry.header.type, "file");
        assert.equal(entry.header.uid, 0);
        assert.equal(entry.header.mode, 0o644);
        assert.equal(entry.header.mtime.getTime(), 0);
        const chunks: Buffer[] = [];
        for await (const raw of entry) {
          const chunk: unknown = raw;
          assert.ok(Buffer.isBuffer(chunk));
          chunks.push(chunk);
        }
        assert.equal(contents.has(entry.header.name), false, "no duplicate archive entries");
        contents.set(entry.header.name, Buffer.concat(chunks));
      }
      return contents;
    })();
    unpack.end(gunzipSync(bytes));
    const contents = await reading;
    assert.deepEqual(
      [...contents.keys()],
      profile.manifest.map((file) => file.path),
    );
    for (const file of profile.manifest) {
      const content = contents.get(file.path);
      assert.ok(content);
      assert.equal(content.length, file.bytes);
      assert.equal(digest(content), file.sha256);
      assert.deepEqual(content, await readFile(join(f.root, "app", file.path)));
    }
    assert.equal(gunzipSync(bytes).includes(Buffer.from("not-in-archive")), false);
    await utimes(join(f.root, "app/server.mjs"), new Date(), new Date());
    const repeated = await prepareArchive({
      ...f.input,
      sourceHash: profile.sourceHash,
    });
    assert.deepEqual(
      repeated,
      artifact,
      "file timestamps do not change the content-addressed artifact",
    );
    assert.deepEqual(await readdir(join(f.input.stateDir, "source-artifacts")), [
      `${artifact.archiveHash}.tar.gz`,
    ]);
    assert.throws(
      () => f.store.getArtifact("another-actor", artifact.archiveHash),
      code("ARTIFACT_NOT_FOUND"),
    );
    const reopened = new Store(f.path);
    try {
      assert.deepEqual(reopened.getArtifact(session.actorId, artifact.archiveHash), artifact);
      assert.deepEqual(
        await readArtifact(
          f.input.stateDir,
          reopened.getArtifact(session.actorId, artifact.archiveHash),
        ),
        bytes,
      );
    } finally {
      reopened.close();
    }
  } finally {
    await f.cleanup();
  }
});

test("stale inspection, secrets, cancellation and overlapping preparation cannot publish an authorized artifact", async () => {
  const f = await fixture();
  try {
    const profile = await inspectProject(f.root, "app");
    await writeFile(join(f.root, "app/server.mjs"), "server.listen(3000); // changed");
    await assert.rejects(
      prepareArchive({ ...f.input, sourceHash: profile.sourceHash }),
      code("SOURCE_CHANGED"),
    );
    const sourceHash = (await inspectProject(f.root, "app")).sourceHash;
    await writeFile(join(f.root, "app/config.json"), '{"password":"sensitive-value-for-fixture"}');
    await assert.rejects(prepareArchive({ ...f.input, sourceHash }), code("SENSITIVE_SOURCE"));
    await rm(join(f.root, "app/config.json"));
    const signal = AbortSignal.abort();
    await assert.rejects(prepareArchive({ ...f.input, sourceHash, signal }), code("CANCELLED"));
    assert.equal(f.store.db.prepare("SELECT count(*) AS n FROM source_artifacts").get()?.n, 0);
    const first = prepareArchive({ ...f.input, sourceHash });
    await assert.rejects(prepareArchive({ ...f.input, sourceHash }), code("SOURCE_BUSY"));
    await first;
    const controller = new AbortController();
    const cancelled = prepareArchive({
      ...f.input,
      sourceHash,
      signal: controller.signal,
    });
    controller.abort();
    await assert.rejects(cancelled, code("CANCELLED"));
    assert.equal(f.store.db.prepare("SELECT count(*) AS n FROM source_artifacts").get()?.n, 1);
  } finally {
    await f.cleanup();
  }
});

test("approval binds the artifact; tampered or missing bytes fail before an attempt; the adapter receives only the approved snapshot", async () => {
  const f = await fixture();
  try {
    const sourceHash = (await inspectProject(f.root, "app")).sourceHash;
    const artifact = await prepareArchive({ ...f.input, sourceHash });
    const original = await readArtifact(f.input.stateDir, artifact);
    const spec: ActionSpec = {
      version: 2,
      scope,
      operation: "deploy",
      sourceHash,
      artifactHash: artifact.archiveHash,
      args: { port: 3000, planId: null },
    };
    const action = f.store.createAction(session.actorId, spec);
    f.store.decide(action.id, session.actorId, session.id, action.hash, "approve");
    const file = join(f.input.stateDir, "source-artifacts", `${artifact.archiveHash}.tar.gz`);
    await writeFile(file, Buffer.alloc(original.length));
    let writes = 0;
    const execute = () =>
      executeApproved({
        store: f.store,
        config: f.config,
        session,
        id: action.id,
        currentSpec: spec,
        signal: new AbortController().signal,
        adapter: {
          async execute(claimed, _signal, bytes) {
            assert.equal(claimed.state, "executing");
            assert.deepEqual(bytes, original);
            writes++;
            return { remoteId: "release-fixture" };
          },
        },
      });
    await assert.rejects(execute(), code("ARTIFACT_MISMATCH"));
    await rm(file);
    await assert.rejects(execute(), code("ARTIFACT_UNAVAILABLE"));
    assert.equal(writes, 0);
    assert.equal(f.store.getAction(action.id, session.actorId).attemptId, null);
    await writeFile(file, original);
    assert.throws(
      () =>
        f.store.claim(action.id, session.actorId, session.id, {
          ...spec,
          artifactHash: "c".repeat(64),
        }),
      code("STALE_ACTION"),
    );
    await writeFile(
      join(f.root, "app/server.mjs"),
      "new local contents are not the approved artifact",
    );
    assert.equal(
      (await execute()).state,
      "observing",
      "accepted receipt is not a healthy workload",
    );
    assert.equal(writes, 1);
    await assert.rejects(execute(), code("ACTION_CONFLICT"));
    assert.equal(writes, 1);
  } finally {
    await f.cleanup();
  }
});

test("artifact directory junctions and full local storage fail closed", async () => {
  const f = await fixture();
  try {
    const sourceHash = (await inspectProject(f.root, "app")).sourceHash;
    await mkdir(join(f.root, "outside"));
    const directory = join(f.input.stateDir, "source-artifacts");
    await symlink(join(f.root, "outside"), directory, "junction");
    await assert.rejects(prepareArchive({ ...f.input, sourceHash }), code("UNSAFE_ARTIFACT_PATH"));
    assert.deepEqual(await readdir(join(f.root, "outside")), []);
    await rm(directory);
    await mkdir(directory);
    for (let index = 0; index < 32; index++)
      await writeFile(join(directory, `${index}.pending`), "orphan");
    await assert.rejects(
      prepareArchive({ ...f.input, sourceHash }),
      code("ARTIFACT_STORAGE_LIMIT"),
    );
    assert.equal(f.store.db.prepare("SELECT count(*) AS n FROM source_artifacts").get()?.n, 0);
  } finally {
    await f.cleanup();
  }
});

test("a blob left by a failed durable receipt cannot authorize a proposal and can be registered after recovery", async () => {
  const f = await fixture();
  try {
    const sourceHash = (await inspectProject(f.root, "app")).sourceHash;
    const unavailable = new Store(f.path);
    unavailable.close();
    await assert.rejects(prepareArchive({ ...f.input, store: unavailable, sourceHash }));
    const names = await readdir(join(f.input.stateDir, "source-artifacts"));
    assert.equal(names.length, 1);
    const archiveHash = names[0]?.replace(/\.tar\.gz$/, "");
    assert.ok(archiveHash);
    const spec: ActionSpec = {
      version: 2,
      scope,
      operation: "deploy",
      sourceHash,
      artifactHash: archiveHash,
      args: { port: 3000, planId: null },
    };
    assert.throws(() => f.store.createAction(session.actorId, spec), code("ARTIFACT_NOT_FOUND"));
    const registered = await prepareArchive({ ...f.input, sourceHash });
    assert.equal(registered.archiveHash, archiveHash);
    assert.equal(f.store.createAction(session.actorId, spec).state, "awaiting_approval");
  } finally {
    await f.cleanup();
  }
});

test("v1 state upgrades without rehashing legacy approvals; legacy deployment cannot enter a provider", async () => {
  const f = await fixture();
  const legacy: ActionSpec = {
    version: 1,
    scope,
    operation: "deploy",
    sourceHash: "b".repeat(64),
    args: { port: 3000, planId: null },
  };
  const action = f.store.createAction(session.actorId, legacy);
  f.store.decide(action.id, session.actorId, session.id, action.hash, "approve");
  // Reproduce an existing v1 database, then exercise only the appended migration on reopen.
  f.store.db.exec("DROP TABLE source_artifacts; DELETE FROM schema_migrations WHERE version=2;");
  f.store.close();
  const upgraded = new Store(f.path);
  try {
    assert.deepEqual(upgraded.getAction(action.id, session.actorId).spec, legacy);
    assert.equal(
      upgraded.getAction(action.id, session.actorId).hash,
      fingerprint({ actorId: session.actorId, spec: legacy }),
    );
    assert.equal(upgraded.db.prepare("SELECT count(*) AS n FROM schema_migrations").get()?.n, 2);
    let writes = 0;
    await assert.rejects(
      executeApproved({
        store: upgraded,
        config: f.config,
        session,
        id: action.id,
        currentSpec: legacy,
        signal: new AbortController().signal,
        adapter: {
          async execute() {
            writes++;
            return { remoteId: "not-called" };
          },
        },
      }),
      code("ARTIFACT_REQUIRED"),
    );
    assert.equal(writes, 0);
    assert.equal(upgraded.getAction(action.id, session.actorId).attemptId, null);
  } finally {
    upgraded.close();
    assert.ok(f.root.startsWith(join(tmpdir(), "launchlane-archive-")));
    await rm(f.root, { recursive: true, force: true });
  }
});
