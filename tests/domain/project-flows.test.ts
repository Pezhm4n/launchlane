import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { mkdtemp, mkdir, writeFile, rm, readdir, symlink, access } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { test } from "node:test";
import { gzipSync } from "node:zlib";
import { pack } from "tar-stream";
import { readConfig } from "../../src/server/config.ts";
import {
  prepareProjectFlow,
  proposeProjectFlow,
  restoreProjectFlow,
  validateProjectAction,
} from "../../src/server/application/project-flows.ts";
import { discardGitHubSource, unpackGitHubArchive } from "../../src/server/github/import.ts";
import { GitHubClient } from "../../src/server/github/client.ts";
import { Store } from "../../src/server/persistence/store.ts";
import { AppError } from "../../src/server/errors.ts";
import type { ProjectFlow, ProjectSelection } from "../../src/contracts/project-flow.ts";
import { sealCredential } from "../../src/server/connections/credentials.ts";
import { connectLiara } from "../../src/server/connections/liara.ts";
import { SOURCE_MAX_FILE_BYTES, SOURCE_MAX_CONFIG_BYTES } from "../../src/contracts/source-limits.ts";
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

function importedClient(archive: Buffer, revision: string) {
  return new GitHubClient(async (path) => ({
    status: 200, hasNext: false, rateLimited: false,
    body: path.includes("tarball") ? archive : Buffer.from(JSON.stringify(
      path.includes("branches") ? { name: "feature/ui", commit: { sha: revision } } : {
        id: 17, name: "fresh-node", owner: { login: "synthetic-owner" },
        full_name: "synthetic-owner/fresh-node", private: true, default_branch: "feature/ui",
      },
    )),
  }));
}

test("GitHub imports keep bounded data assets and reject individual, aggregate and config excess", async () => {
  const f = await fixture(), revision = "e".repeat(40), data = JSON.stringify({ rows: "x".repeat(3_949_880) });
  const selection: ProjectSelection = { kind: "github", owner: "synthetic-owner", name: "fresh-node", repositoryId: 17, branch: "feature/ui", revision, directory: "." };
  try {
    const flow = await prepareProjectFlow(f.config, f.store, "alice", selection, signal(), importedClient(await tar([
      { name: "repo/package.json", content: packageText },
      { name: "repo/server.mjs", content: "app.listen(3000)" },
      { name: "repo/data.json", content: data },
      { name: "repo/package-lock.json", content: '{"dependencies":{"js-tokens":"^4.0.0"}}' },
      { name: "repo/DESIGN.md", content: "Motion tokens: subtle animations" },
    ]), revision));
    assert.equal(flow.status, "ready");
    assert.equal(flow.profile.manifest.find((file) => file.path === "data.json")?.bytes, Buffer.byteLength(data));
    assert.equal((await restoreProjectFlow(f.config, f.store, "alice", signal(), flow.id))?.profile.sourceHash, flow.profile.sourceHash);
    for (const [path, limit] of [["large.json", SOURCE_MAX_FILE_BYTES], ["package.json", SOURCE_MAX_CONFIG_BYTES]] as const) {
      await assert.rejects(unpackGitHubArchive(await tar([{ name: `repo/${path}`, content: "x".repeat(limit + 1) }]), ".", signal()),
        (error: unknown) => code("GITHUB_DOWNLOAD_LIMIT")(error) && String(error).includes(path));
    }
    await assert.rejects(unpackGitHubArchive(await tar(Array.from({ length: 6 }, (_, index) => ({ name: `repo/${index}.txt`, content: "x".repeat(SOURCE_MAX_FILE_BYTES) }))), ".", signal()), code("GITHUB_DOWNLOAD_LIMIT"));
  } finally { f.store.close(); await f.cleanup(); }
});

test("failed GitHub inspections do not consume snapshot slots or replace the last valid project", async () => {
  const f = await fixture(), revision = "e".repeat(40);
  const selection: ProjectSelection = { kind: "github", owner: "synthetic-owner", name: "fresh-node", repositoryId: 17, branch: "feature/ui", revision, directory: "apps/web" };
  const client = importedClient(await tar([{ name: "repo/apps/web/package.json", content: "{ invalid JSON" }]), revision);
  try {
    const previous = await prepareProjectFlow(f.config, f.store, "alice", { kind: "local", directory: "app" }, signal());
    for (let attempt = 0; attempt < 18; attempt++) {
      await assert.rejects(prepareProjectFlow(f.config, f.store, "alice", selection, signal(), client), code("INVALID_PROJECT"));
      assert.equal(f.store.getProjectFlow("alice")?.id, previous.id);
      assert.deepEqual(await readdir(join(f.config.stateDir, "github-sources")), []);
    }
    assert.equal(f.store.listActions("alice").length, 0);
  } finally { f.store.close(); await f.cleanup(); }
});

test("a pinned Node subproject preserves safe bracket filenames without executing retrieved code", async () => {
  const f = await fixture(), revision = "e".repeat(40);
  const selection: ProjectSelection = { kind: "github", owner: "synthetic-owner", name: "fresh-node", repositoryId: 17, branch: "feature/ui", revision, directory: "apps/web" };
  const client = importedClient(await tar([
    { name: "repo/apps/web/package.json", content: packageText },
    { name: "repo/apps/web/server.mjs", content: "throw new Error('never execute retrieved code'); app.listen(3000)" },
    { name: "repo/apps/web/src/routes/[slug].ts", content: "export const route = '[slug]';" },
    { name: "repo/apps/web/.env.local", content: "PRIVATE=excluded" },
    { name: "repo/other/package.json", content: "{ invalid" },
  ]), revision);
  try {
    const flow = await prepareProjectFlow(f.config, f.store, "alice", selection, signal(), client);
    assert.equal(flow.status, "ready");
    assert.deepEqual(flow.profile.manifest.map((row) => row.path), ["package.json", "server.mjs", "src/routes/[slug].ts"]);
    assert.equal((await restoreProjectFlow(f.config, f.store, "alice", signal(), flow.id))?.profile.sourceHash, flow.profile.sourceHash);
    assert.ok(flow.artifact);
  } finally { f.store.close(); await f.cleanup(); }
});

test("a committed GitHub flow retains its snapshot when a local response is lost after the commit", async (t) => {
  const f = await fixture(), revision = "e".repeat(40);
  const selection: ProjectSelection = { kind: "github", owner: "synthetic-owner", name: "fresh-node", repositoryId: 17, branch: "feature/ui", revision, directory: "." };
  const client = importedClient(await tar([
    { name: "repo/package.json", content: packageText },
    { name: "repo/server.mjs", content: "app.listen(3000)" },
  ]), revision);
  const save = f.store.saveProjectFlow.bind(f.store);
  t.mock.method(f.store, "saveProjectFlow", (actor: string, flow: ProjectFlow) => {
    save(actor, flow);
    throw new AppError("SYNTHETIC_RESPONSE_LOST", "Synthetic local response lost", 503);
  });
  try {
    await assert.rejects(prepareProjectFlow(f.config, f.store, "alice", selection, signal(), client), code("SYNTHETIC_RESPONSE_LOST"));
    const saved = f.store.getProjectFlow("alice");
    assert.ok(saved);
    assert.deepEqual(await readdir(join(f.config.stateDir, "github-sources")), [saved.id]);
    assert.equal((await restoreProjectFlow(f.config, f.store, "alice", signal(), saved.id))?.status, "ready");
  } finally { f.store.close(); await f.cleanup(); }
});

test("snapshot cleanup refuses a junction at either the storage base or the snapshot", async () => {
  for (const linkedBase of [true, false]) {
    const f = await fixture(), id = randomUUID(), outside = join(f.root, "outside");
    try {
      await mkdir(outside);
      await writeFile(join(outside, "retained.txt"), "must remain");
      const base = join(f.config.stateDir, "github-sources");
      if (!linkedBase) await mkdir(base);
      await symlink(outside, linkedBase ? base : join(base, id), "junction");
      await assert.rejects(discardGitHubSource(f.config.stateDir, id), code("UNSAFE_PATH"));
      await access(join(outside, "retained.txt"));
    } finally { f.store.close(); await f.cleanup(); }
  }
});
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

test("a workspace orchestrator is not a single deployable root; selecting its Node leaf resolves the ambiguity without executing scripts", async () => {
  const f = await fixture();
  try {
    await writeFile(join(f.root, "app/package.json"), JSON.stringify({ private: true, workspaces: ["apps/*"], scripts: { start: "npm run start --workspaces" } }));
    await mkdir(join(f.root, "app/apps/web"), { recursive: true });
    await writeFile(join(f.root, "app/apps/web/package.json"), packageText);
    await writeFile(join(f.root, "app/apps/web/server.mjs"), "app.listen(8080); // not executed");
    const ambiguous = await prepareProjectFlow(f.config, f.store, "alice", { kind: "local", directory: "app" }, signal());
    assert.equal(ambiguous.status, "incomplete");
    assert.equal(ambiguous.artifact, null);
    assert.equal(ambiguous.profile.start, null);
    assert.ok(ambiguous.profile.missing.some((message) => message.includes("زیرپوشه")));
    // A saved profile from the older inspector must not inherit deployment readiness.
    const legacy = f.store.saveProjectFlow("alice", { ...ambiguous, id: randomUUID(), status: "ready", profile: { ...ambiguous.profile, start: "npm run start --workspaces" } });
    assert.equal((await restoreProjectFlow(f.config, f.store, "alice", signal(), legacy.id))?.status, "stale");
    const selected = await prepareProjectFlow(f.config, f.store, "alice", { kind: "local", directory: "app/apps/web" }, signal());
    assert.equal(selected.status, "ready");
    assert.equal(selected.profile.port, 8080);
    assert.equal(selected.profile.start, "node server.mjs");
    assert.ok(selected.artifact);
  } finally { f.store.close(); await f.cleanup(); }
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
test("a recreated Liara app cannot inherit approval or the previous site's read target", async () => {
  const f = await fixture();
  try {
    const saved = f.store.getConnection("alice", "liara");
    assert.ok(saved);
    f.store.saveConnection("alice", {
      ...saved,
      view: { ...saved.view, identityId: "c".repeat(24) },
    });
    const flow = await prepareProjectFlow(
      f.config,
      f.store,
      "alice",
      { kind: "local", directory: "app" },
      signal(),
    );
    const action = await proposeProjectFlow(
      f.config,
      f.store,
      "alice",
      flow.id,
      scope.app,
      null,
      signal(),
    );
    f.store.decide(action.id, "alice", "session", action.hash, "approve");
    f.store.setProbeOrigin("alice", scope, "https://previous.example.com");
    let appId = "synthetic-app";
    const send = async (url: string) =>
      Response.json(
        url.includes("/projects")
          ? {
              projects: [{ _id: appId, project_id: scope.app, type: "node" }],
            }
          : url.includes("teamID")
            ? { team: { _id: scope.teamId, teamName: "تیم آزمون" } }
            : {
                user: {
                  _id: "c".repeat(24),
                  fullname: "حساب آزمون",
                  email: "synthetic@example.test",
                },
              },
      );
    const refresh = () =>
      connectLiara(f.config, f.store, "alice", "synthetic-valid-refresh-key", signal(), send);
    assert.equal((await refresh()).selectedApp, scope.app);
    assert.equal(f.store.getAction(action.id, "alice").state, "approved");
    appId = "recreated-app-with-same-name";
    assert.equal((await refresh()).selectedApp, null);
    assert.equal(f.store.getAction(action.id, "alice").state, "cancelled");
    assert.equal(f.store.getProbeOrigin("alice", scope.teamId, scope.app), null);
    assert.throws(
      () => f.store.claim(action.id, "alice", "session", action.spec),
      code("PROJECT_ACCESS_CHANGED"),
    );
    assert.equal(
      f.store.db.prepare("SELECT COUNT(*) AS count FROM attempts WHERE action_id=?").get(action.id)
        ?.count,
      0,
    );
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
    [{ name: "repo/huge.js", content: "x".repeat(SOURCE_MAX_FILE_BYTES + 1) }],
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
