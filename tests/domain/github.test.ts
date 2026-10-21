import assert from "node:assert/strict";
import { test } from "node:test";
import { readConfig } from "../../src/server/config.ts";
import { AppError } from "../../src/server/errors.ts";
import { Store } from "../../src/server/persistence/store.ts";
import {
  classifyGitHub,
  parseGhResponse,
  type GitHubTransport,
} from "../../src/server/github/cli.ts";
import { GitHubClient, secureGitHubStatus } from "../../src/server/github/client.ts";
import { GitHubLoginService, parseDeviceChallenge } from "../../src/server/github/login.ts";
const code = (expected: string) => (error: unknown) =>
  error instanceof AppError && error.code === expected;
const repo = (id: number, name: string, privateRepo = false) => ({
  id,
  name,
  owner: { login: "octocat" },
  full_name: `octocat/${name}`,
  private: privateRepo,
  default_branch: "main",
  temp_clone_token: "discard-this-fixture-secret",
});
const bytes = (value: unknown) => Buffer.from(JSON.stringify(value));
const signal = () => AbortSignal.timeout(2000);

test("GitHub repository search stays inside authenticated pagination and preserves private identity", async () => {
  const paths: string[] = [];
  const transport: GitHubTransport = async (path) => {
    paths.push(path);
    return {
      status: 200,
      body: bytes(
        path.startsWith("/repos/")
          ? repo(1, "other")
          : path.endsWith("page=1")
            ? [repo(1, "other")]
            : [repo(2, "target-private", true)],
      ),
      hasNext: path.endsWith("page=1"),
      rateLimited: false,
    };
  };
  const page = await new GitHubClient(transport).repositories("TARGET", 1, signal());
  assert.equal(page.scannedPages, 2);
  assert.equal(page.nextPage, null);
  assert.equal(page.repositories[0]?.private, true);
  assert.equal(page.repositories[0]?.id, 2);
  assert.ok(!JSON.stringify(page).includes("discard-this"));
  assert.ok(
    paths.every((path) =>
      path.startsWith(
        "/user/repos?visibility=all&affiliation=owner,collaborator,organization_member",
      ),
    ),
  );
  await assert.rejects(
    new GitHubClient(transport).repository("octocat", "other", 3, signal()),
    code("GITHUB_REPOSITORY_CHANGED"),
  );
});

test("GitHub response boundaries distinguish permissions, rate limit, empty repositories and credentials", () => {
  const parsed = parseGhResponse(
    Buffer.from(
      'HTTP/2.0 200 OK\r\nLink: <https://api.github.com/user/repos?page=2>; rel="next"\r\n\r\n[]',
    ),
  );
  assert.equal(parsed.hasNext, true);
  assert.equal(parsed.body.toString(), "[]");
  for (const [status, rateLimited, expected] of [
    [401, false, "GITHUB_AUTH_REQUIRED"],
    [403, false, "GITHUB_ACCESS_DENIED"],
    [403, true, "GITHUB_RATE_LIMIT"],
    [429, false, "GITHUB_RATE_LIMIT"],
    [404, false, "GITHUB_NOT_FOUND"],
    [409, false, "GITHUB_EMPTY_REPOSITORY"],
    [503, false, "GITHUB_UNAVAILABLE"],
  ] as const)
    assert.throws(
      () =>
        classifyGitHub({
          status,
          rateLimited,
          hasNext: false,
          body: bytes({ message: "private raw provider details" }),
        }),
      code(expected),
    );
  const status = {
    hosts: {
      "github.com": [
        {
          host: "github.com",
          active: true,
          state: "success",
          tokenSource: "keyring",
          login: "octocat",
        },
      ],
    },
  };
  assert.equal(secureGitHubStatus(status), "octocat");
  const active = status.hosts["github.com"][0];
  assert.ok(active);
  active.tokenSource = "C:/private/hosts.yml";
  assert.throws(() => secureGitHubStatus(status), code("GITHUB_STORAGE_UNSAFE"));
  assert.equal(
    parseDeviceChallenge(
      "First copy your one-time code: ABCD-1234\nOpen this URL to continue in your web browser: https://github.com/login/device",
    )?.verificationUrl,
    "https://github.com/login/device",
  );
  assert.throws(
    () =>
      parseDeviceChallenge(
        "one-time code: ABCD-1234\nhttps://github.com/login/device?token=unsafe",
      ),
    code("GITHUB_LOGIN_PROTOCOL"),
  );
  assert.equal(parseDeviceChallenge("network failure"), null);
});

test("GitHub device login requires actual identity and conscious confirmation, rejects account races and cancellation", async () => {
  const store = new Store(":memory:");
  let finish: (() => void) | null = null,
    identity = { id: "7", login: "octocat", name: "Octocat" };
  const service = new GitHubLoginService(readConfig({}), store, {
    driver: () => (signal, challenge) =>
      new Promise((resolve, reject) => {
        challenge({ userCode: "ABCD-1234", verificationUrl: "https://github.com/login/device" });
        finish = resolve;
        signal.addEventListener("abort", () => reject(new Error("cancelled")), { once: true });
      }),
    check: async () => identity,
  });
  try {
    const run = service.start("alice");
    assert.equal(
      service.start("alice").id,
      run.id,
      "a lost start response must resume the same pending login",
    );
    assert.equal(run.state, "awaiting_user");
    assert.equal(store.getConnection("alice", "github"), null);
    assert.throws(() => service.status("bob", run.id), code("GITHUB_LOGIN_EXPIRED"));
    await assert.rejects(
      service.confirm("alice", run.id, signal()),
      code("GITHUB_LOGIN_NOT_READY"),
    );
    const complete = finish as (() => void) | null;
    assert.ok(complete);
    complete();
    await new Promise((resolve) => setImmediate(resolve));
    assert.equal(service.status("alice", run.id).state, "confirm_account");
    assert.equal(store.getConnection("alice", "github"), null);
    identity = { ...identity, id: "8" };
    await assert.rejects(
      service.confirm("alice", run.id, signal()),
      code("GITHUB_ACCOUNT_CHANGED"),
    );
    identity = { ...identity, id: "7" };
    await service.confirm("alice", run.id, signal());
    assert.equal(store.getConnection("alice", "github")?.view.identityId, "7");
    store.disconnectConnection("alice", "github");
    const cancelled = service.start("alice");
    service.cancel("alice", cancelled.id);
    await new Promise((resolve) => setImmediate(resolve));
    assert.equal(service.status("alice", cancelled.id).state, "cancelled");
    assert.equal(store.getConnection("alice", "github"), null);
  } finally {
    store.close();
  }
});
