import assert from "node:assert/strict";
import { mkdtemp, mkdir, writeFile, readFile, rm, symlink, access } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { test } from "node:test";
import { inspectProject } from "../../src/server/workspace/inspect.ts";
import { AppError } from "../../src/server/errors.ts";
import { SOURCE_MAX_FILE_BYTES, SOURCE_MAX_CONFIG_BYTES } from "../../src/contracts/source-limits.ts";
import { containsSourceCredential, redact } from "../../src/server/policy/redaction.ts";

const code = (expected: string) => (error: unknown) =>
  error instanceof AppError && error.code === expected;
async function fixture() {
  const root = await mkdtemp(join(tmpdir(), "launchlane-source-"));
  await mkdir(join(root, "app"));
  await writeFile(
    join(root, "app/package.json"),
    JSON.stringify({ engines: { node: "24.x" }, scripts: { start: "node server.mjs" } }),
  );
  await writeFile(
    join(root, "app/server.mjs"),
    "const port = process.env.PORT || 3000; const key = process.env.SERVICE_TOKEN; server.listen(port);",
  );
  return {
    root,
    async cleanup() {
      assert.ok(root.startsWith(join(tmpdir(), "launchlane-source-")));
      await rm(root, { recursive: true, force: true });
    },
  };
}

test("read-only Node inspection reports names, content hashes and a secret-free manifest", async () => {
  const f = await fixture();
  try {
    await writeFile(join(f.root, "app/.env.local"), "SERVICE_TOKEN=never-publish-this");
    await mkdir(join(f.root, "app/node_modules"));
    await writeFile(join(f.root, "app/node_modules/ignored.txt"), "dependency");
    const result = await inspectProject(f.root, "app");
    assert.equal(result.runtime, "node");
    assert.equal(result.port, 3000);
    assert.equal(result.nodeVersion, "24.x");
    assert.deepEqual(result.envNames, ["PORT", "SERVICE_TOKEN"]);
    assert.deepEqual(
      result.manifest.map((file) => file.path),
      ["package.json", "server.mjs"],
    );
    assert.equal(result.excludedCount, 2);
    assert.ok(!JSON.stringify(result).includes("never-publish-this"));
    const hash = result.sourceHash;
    await writeFile(
      join(f.root, "app/server.mjs"),
      `${await readFile(join(f.root, "app/server.mjs"), "utf8")}\n// new revision`,
    );
    assert.notEqual((await inspectProject(f.root, "app")).sourceHash, hash);
  } finally {
    await f.cleanup();
  }
});

test("missing and contradictory runtime/port facts stay unknown, and scripts never execute", async () => {
  const f = await fixture();
  try {
    await writeFile(
      join(f.root, "app/package.json"),
      JSON.stringify({
        scripts: { start: "node -e \"require('fs').writeFileSync('SHOULD_NOT_EXIST','bad')\"" },
      }),
    );
    await writeFile(join(f.root, "app/second.js"), "server.listen(8080);");
    const result = await inspectProject(f.root, "app");
    assert.equal(result.port, null);
    assert.ok(result.missing.length > 0);
    await assert.rejects(access(join(f.root, "app/SHOULD_NOT_EXIST")));
    await mkdir(join(f.root, "empty"));
    const empty = await inspectProject(f.root, "empty");
    assert.equal(empty.runtime, "unknown");
    assert.equal(empty.start, null);
    assert.equal(empty.port, null);
  } finally {
    await f.cleanup();
  }
});

test("traversal, private paths, symlink/junction escape and oversized files are denied", async () => {
  const f = await fixture();
  try {
    for (const directory of [
      "../app",
      "app/..",
      "/app",
      "C:/app",
      "app\\nested",
      ".local",
      "app/.env.local",
    ])
      await assert.rejects(inspectProject(f.root, directory), code("UNSAFE_PATH"));
    await mkdir(join(f.root, "outside"));
    await symlink(join(f.root, "outside"), join(f.root, "app/link"), "junction");
    await assert.rejects(inspectProject(f.root, "app"), code("UNSAFE_PATH"));
    await rm(join(f.root, "app/link"));
    await writeFile(join(f.root, "app/large.txt"), "x".repeat(SOURCE_MAX_FILE_BYTES + 1));
    await assert.rejects(inspectProject(f.root, "app"), (error: unknown) =>
      code("SOURCE_LIMIT")(error) && String(error).includes("large.txt") && String(error).includes("4096"));
  } finally {
    await f.cleanup();
  }
});

test("source vocabulary is accepted while credential assignments and exact installed secrets remain blocked", () => {
  const benign = 'Motion tokens: subtle animations\n"js-tokens": "^4.0.0"\nRadius tokens: `radius.sm=24px`';
  assert.equal(containsSourceCredential(benign), false);
  // Log redaction stays conservative, independently of the source classifier.
  assert.notEqual(redact(benign), benign);
  for (const key of ["token", "authToken", "api_key", "SERVICE_TOKEN", "password", "clientSecret", "authorization", "tokenValue", "passwordHash"])
    assert.equal(containsSourceCredential(JSON.stringify({ [key]: "do-not-publish" })), true, key);
  for (const value of ['fetch("https://name:private-value@example.com")', '"Bearer private-value"', '-----BEGIN RSA PRIVATE KEY-----\nprivate\n-----END RSA PRIVATE KEY-----'])
    assert.equal(containsSourceCredential(value), true);
  assert.equal(containsSourceCredential(benign, ["subtle animations"]), true);
});

test("JavaScript environment/member references are source expressions while literal defaults, typed credentials and known installed values remain blocked", () => {
  for (const source of ["const env = {TELEGRAM_BOT_TOKEN: process.env.TELEGRAM_BOT_TOKEN,};", "const token = config.TELEGRAM_BOT_TOKEN?.trim();", "dispatch({ type: 'beginProductResults', token: expectedResultsRequest });", "const token = pendingRequestId;"])
    assert.equal(containsSourceCredential(source, [], "app/actions.ts"), false);
  for (const source of ["const token = process.env.TOKEN || 'do-not-publish';", "const token = process.env.TOKEN\n ?? 'do-not-publish';", "const SERVICE_TOKEN: string = 'do-not-publish';", '{"token":"process.env.TOKEN"}'])
    assert.equal(containsSourceCredential(source, [], "app/actions.ts"), true);
  assert.equal(containsSourceCredential("const token = config.TELEGRAM_BOT_TOKEN;", ["TELEGRAM_BOT_TOKEN"], "app/actions.ts"), true);
  assert.equal(containsSourceCredential("token: process.env.TOKEN", [], "settings.json"), true);
  assert.equal(containsSourceCredential("dispatch({ token: expectedResultsRequest });", ["expectedResultsRequest"], "hooks.ts"), true);
  for (const value of ["page2", "new-search", "request-123", "stale-result", "assistant-first", "manual-later"]) {
    const source = `dispatch({ type: 'beginResults', token: '${value}' });`;
    assert.equal(containsSourceCredential(source, [], "unit/pagination.test.mjs"), false);
    assert.equal(containsSourceCredential(source, [], "src/service.js"), true);
    assert.equal(containsSourceCredential(source, [value], "unit/pagination.test.mjs"), true);
    assert.equal(containsSourceCredential(`const authToken = '${value}';`, [], "unit/auth.test.mjs"), true);
  }
  assert.equal(containsSourceCredential("const token='do-not-publish';", [], "unit/auth.test.mjs"), true);
  const example = "const rejectedInput = 'https://user:password@example.com/path';";
  assert.equal(containsSourceCredential(example, [], "unit/input.test.mjs"), false);
  assert.equal(containsSourceCredential(example, [], "src/service.js"), true);
  assert.equal(containsSourceCredential(example, ["password"], "unit/input.test.mjs"), true);
  assert.equal(containsSourceCredential("const input='https://name:private-value@example.com';", [], "unit/input.test.mjs"), true);
  assert.equal(containsSourceCredential("const input='https://user:password@actual-service.com';", [], "unit/input.test.mjs"), true);
  assert.notEqual(redact(example), example);
  for (const value of ["fake-voice-key-should-not-leak", "bad key"]) {
    const source = `with patch.dict('os.environ', {'SERVICE_API_KEY': '${value}'}): pass`;
    assert.equal(containsSourceCredential(source, [], "tests/test_voice.py"), false);
    assert.equal(containsSourceCredential(source, [], "service.py"), true);
    assert.equal(containsSourceCredential(source, [value], "tests/test_voice.py"), true);
  }
  assert.equal(containsSourceCredential("env={'SERVICE_API_KEY': 'sample-123abc-private'}", [], "tests/test_voice.py"), true);
});

test("a bounded data asset and normal lockfile/design vocabulary survive inspection; config stays smaller", async () => {
  const f = await fixture();
  try {
    await writeFile(join(f.root, "app/data.json"), JSON.stringify({ rows: "x".repeat(3_949_880) }));
    await writeFile(join(f.root, "app/package-lock.json"), '{"dependencies":{"js-tokens":"^4.0.0"}}');
    await writeFile(join(f.root, "app/DESIGN.md"), "Motion tokens: subtle animations");
    const profile = await inspectProject(f.root, "app");
    assert.equal(profile.manifest.find((file) => file.path === "data.json")?.bytes, 3_949_891);
    await writeFile(join(f.root, "app/package.json"), " ".repeat(SOURCE_MAX_CONFIG_BYTES + 1));
    await assert.rejects(inspectProject(f.root, "app"), (error: unknown) => code("SOURCE_LIMIT")(error) && String(error).includes("package.json"));
  } finally { await f.cleanup(); }
});

test("credential-bearing source is rejected without returning its content; cancellation is explicit", async () => {
  const f = await fixture();
  try {
    await writeFile(join(f.root, "app/settings.json"), '{"password":"do-not-echo-value"}');
    await assert.rejects(
      inspectProject(f.root, "app"),
      (error: unknown) =>
        code("SENSITIVE_SOURCE")(error) && !String(error).includes("do-not-echo-value"),
    );
    const controller = new AbortController();
    controller.abort();
    await assert.rejects(
      inspectProject(f.root, "app", { signal: controller.signal }),
      code("CANCELLED"),
    );
  } finally {
    await f.cleanup();
  }
});
