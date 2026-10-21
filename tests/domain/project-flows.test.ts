import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { mkdtemp, mkdir, writeFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { test } from "node:test";
import { gzipSync } from "node:zlib";
import { pack } from "tar-stream";
import { readConfig } from "../../src/server/config.ts";
import {
  prepareProjectFlow,
  restoreProjectFlow,
  validateProjectAction,
} from "../../src/server/application/project-flows.ts";
import { unpackGitHubArchive } from "../../src/server/github/import.ts";
import { GitHubClient } from "../../src/server/github/client.ts";
import { Store } from "../../src/server/persistence/store.ts";
import { AppError } from "../../src/server/errors.ts";
import type { ProjectSelection } from "../../src/contracts/project-flow.ts";
import { sealCredential } from "../../src/server/connections/credentials.ts";
const code = (expected: string) => (error: unknown) =>
  error instanceof AppError && error.code === expected;
const scope = { teamId: "a".repeat(24), app: "sample-app" },
  signal = () => AbortSignal.timeout(5000);
const packageText = JSON.stringify({ scripts: { start: "node server.mjs" } });
async function tar(
  entries: {
    name: string;
    content?: string;
    type?: "file" | "directory" | "symlink";
    linkname?: string;
  }[],
): Promise<Buffer> {
  const archive = pack(),
    chunks: Buffer[] = [];
  const collect = (async () => {
    for await (const part of archive) {
      assert.ok(Buffer.isBuffer(part));
      chunks.push(Buffer.from(part));
    }
  })();
  for (const entry of entries)
    await new Promise<void>((resolve, reject) =>
      archive.entry(
        {
          name: entry.name,
          type: entry.type ?? "file",
          ...(entry.linkname ? { linkname: entry.linkname } : {}),
          size: Buffer.byteLength(entry.content ?? ""),
        },
        entry.content ?? "",
        (error) => (error ? reject(error) : resolve()),
      ),
    );
  archive.finalize();
  await collect;
  return gzipSync(Buffer.concat(chunks));
}
async function fixture() {
  const root = await mkdtemp(join(tmpdir(), "launchlane-flow-")),
    stateDir = join(root, "state");
  await mkdir(stateDir);
  await mkdir(join(root, "app"));
  await writeFile(join(root, "app/package.json"), packageText);
  await writeFile(join(root, "app/server.mjs"), "app.listen(3000); // never executed");
  const config = readConfig({
      LAUNCHLANE_SESSION_SECRET: "synthetic-project-flow-root-".repeat(3),
      LAUNCHLANE_WORKSPACE_ROOT: root,
      LAUNCHLANE_STATE_DIR: stateDir,
      LIARA_TEAM_ID: scope.teamId,
      LAUNCHLANE_APP_ALLOWLIST: scope.app,
    }),
    path = join(stateDir, "state.sqlite");
  const store = new Store(path);
  store.saveConnection("alice", {
    source: "token",
    ciphertext: sealCredential("synthetic-key-never-real", config.sessionSecret, "alice", "liara"),
    view: {
      provider: "liara",
      status: "connected",
      identityId: "synthetic-user",
      login: "synthetic@example.test",
      displayName: "حساب آزمون",
      teamId: scope.teamId,
      teamName: "تیم آزمون",
      apps: [{ id: "synthetic-app", name: scope.app, platform: "node" }],
      selectedApp: scope.app,
      checkedAt: Date.now(),
    },
  });
  return {
    root,
    config,
    path,
    store,
    async cleanup() {
      assert.ok(root.startsWith(join(tmpdir(), "launchlane-flow-")));
      await rm(root, { recursive: true, force: true });
    },
  };
}
test("project selection automatically prepares local bytes, persists across restart and invalidates approval when content changes", async () => {
  const f = await fixture();
  let store = f.store;
  try {
    const flow = await prepareProjectFlow(
      f.config,
      store,
      "alice",
      { kind: "local", directory: "app" },
      signal(),
    );
    assert.equal(flow.status, "ready");
    assert.ok(flow.artifact);
    assert.equal(flow.profile.port, 3000);
    const action = store.createAction("alice", {
      version: 3,
      projectFlowId: flow.id,
      selectionHash: flow.selectionHash,
      sourceHash: flow.profile.sourceHash,
      artifactHash: flow.artifact.archiveHash,
      scope,
      operation: "deploy",
      args: { port: 3000, planId: null },
    });
    store.decide(action.id, "alice", "session", action.hash, "approve");
    const savedConnection = store.getConnection("alice", "liara");
    assert.ok(savedConnection);
    store.disconnectConnection("alice", "liara");
    assert.throws(
      () => store.claim(action.id, "alice", "session", action.spec),
      code("PROJECT_ACCESS_CHANGED"),
    );
    assert.equal(store.db.prepare("SELECT count(*) AS count FROM attempts").get()?.count, 0);
    store.saveConnection("alice", savedConnection);
    store.close();
    store = new Store(f.path);
    assert.equal(
      (await restoreProjectFlow(f.config, store, "alice", signal()))?.actionId,
      action.id,
    );
    assert.equal(store.getAction(action.id, "alice").state, "approved");
    assert.equal(store.getProjectFlow("bob", flow.id), null);
    await writeFile(join(f.root, "app/server.mjs"), "app.listen(4000); // changed");
    await assert.rejects(
      validateProjectAction(f.config, store, "alice", action.spec, signal()),
      code("PROJECT_CHANGED"),
    );
    assert.equal(store.getAction(action.id, "alice").state, "cancelled");
    assert.equal((await restoreProjectFlow(f.config, store, "alice", signal()))?.status, "stale");
    assert.throws(
      () => store.claim(action.id, "alice", "session", action.spec),
      code("PROJECT_CHANGED"),
    );
  } finally {
    store.close();
    await f.cleanup();
  }
});
test("failed selection preserves a valid project; a new selection invalidates old approval even for identical bytes", async () => {
  const f = await fixture();
  try {
    const flow = await prepareProjectFlow(
      f.config,
      f.store,
      "alice",
      { kind: "local", directory: "app" },
      signal(),
    );
    assert.ok(flow.artifact);
    const action = f.store.createAction("alice", {
      version: 3,
      projectFlowId: flow.id,
      selectionHash: flow.selectionHash,
      sourceHash: flow.profile.sourceHash,
      artifactHash: flow.artifact.archiveHash,
      scope,
      operation: "deploy",
      args: { port: 3000, planId: null },
    });
    await assert.rejects(
      prepareProjectFlow(
        f.config,
        f.store,
        "alice",
        { kind: "local", directory: "missing" },
        signal(),
      ),
      code("FOLDER_NOT_FOUND"),
    );
    assert.equal(f.store.getProjectFlow("alice")?.id, flow.id);
    const next = await prepareProjectFlow(
      f.config,
      f.store,
      "alice",
      { kind: "local", directory: "app" },
      signal(),
    );
    assert.equal(next.profile.sourceHash, flow.profile.sourceHash);
    assert.notEqual(next.id, flow.id);
    assert.equal(f.store.getAction(action.id, "alice").state, "cancelled");
    assert.throws(
      () => f.store.decide(action.id, "alice", "session", action.hash, "approve"),
      code("PROJECT_CHANGED"),
    );
    assert.equal(
      (await restoreProjectFlow(f.config, f.store, "alice", signal(), flow.id))?.status,
      "stale",
    );
  } finally {
    f.store.close();
    await f.cleanup();
  }
});
test("GitHub import pins a selected commit and subfolder, omits private files and never executes source", async () => {
  const f = await fixture(),
    revision = "c".repeat(40),
    selection: ProjectSelection = {
      kind: "github",
      repositoryId: 7,
      owner: "octocat",
      name: "sample",
      branch: "main",
      revision,
      directory: "apps/web",
    };
  const archive = await tar([
    { name: "repo-c/apps/web/package.json", content: packageText },
    {
      name: "repo-c/apps/web/server.mjs",
      content: "throw new Error('must never run'); app.listen(3000)",
    },
    { name: "repo-c/apps/web/.env.local", content: "PRIVATE=never-return" },
    { name: "repo-c/other/private.txt", content: "outside-folder" },
  ]);
  const paths: string[] = [],
    client = new GitHubClient(async (path) => {
      paths.push(path);
      return {
        status: 200,
        hasNext: false,
        rateLimited: false,
        body: path.includes("tarball")
          ? archive
          : Buffer.from(
              JSON.stringify(
                path.includes("branches")
                  ? { name: "main", commit: { sha: revision } }
                  : {
                      id: 7,
                      name: "sample",
                      owner: { login: "octocat" },
                      full_name: "octocat/sample",
                      private: true,
                      default_branch: "main",
                    },
              ),
            ),
      };
    });
  try {
    const flow = await prepareProjectFlow(f.config, f.store, "alice", selection, signal(), client);
    assert.equal(flow.status, "ready");
    assert.equal(flow.selection.kind, "github");
    assert.deepEqual(
      flow.profile.manifest.map((file) => file.path),
      ["package.json", "server.mjs"],
    );
    assert.ok(paths.includes(`/repos/octocat/sample/tarball/${revision}`));
    assert.equal((await restoreProjectFlow(f.config, f.store, "alice", signal()))?.status, "ready");
    await assert.rejects(
      prepareProjectFlow(
        f.config,
        f.store,
        "alice",
        { ...selection, revision: "d".repeat(40) },
        signal(),
        client,
      ),
      code("GITHUB_BRANCH_CHANGED"),
    );
    assert.equal(f.store.getProjectFlow("alice")?.id, flow.id);
  } finally {
    f.store.close();
    await f.cleanup();
  }
});
test("malicious archives reject traversal, symlinks, duplicate Windows names, invalid gzip and oversized files", async () => {
  for (const entries of [
    [{ name: "repo/../escape.mjs", content: "bad" }],
    [{ name: "repo/link", type: "symlink", linkname: "../../outside" }],
    [
      { name: "repo/Case.js", content: "one" },
      { name: "repo/case.js", content: "two" },
    ],
    [{ name: "repo/huge.js", content: "x".repeat(524289) }],
  ] as const)
    await assert.rejects(unpackGitHubArchive(await tar([...entries]), ".", signal()));
  await assert.rejects(
    unpackGitHubArchive(Buffer.from("not gzip"), ".", signal()),
    code("GITHUB_ARCHIVE_INVALID"),
  );
  await assert.rejects(
    unpackGitHubArchive(
      await tar([{ name: "repo/package.json", content: packageText }]),
      "missing",
      signal(),
    ),
    code("GITHUB_FOLDER_NOT_FOUND"),
  );
  const controller = new AbortController();
  controller.abort();
  await assert.rejects(
    unpackGitHubArchive(
      await tar([{ name: `repo/${randomUUID()}.txt`, content: "x" }]),
      ".",
      controller.signal,
    ),
    code("CANCELLED"),
  );
});
