import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import assert from "node:assert/strict";
import { test } from "node:test";
import { readConfig } from "../../src/server/config.ts";
import { liaraActor, liaraSignIn } from "../../src/server/connections/liara-login.ts";
import { actorConfig } from "../../src/server/connections/actor-config.ts";
import { liaraTeams, selectLiaraTeam } from "../../src/server/connections/liara-teams.ts";
import { connectedLiaraAccountConfig } from "../../src/server/connections/liara.ts";
import { openCredential } from "../../src/server/connections/credentials.ts";
import { checkRequest, issueSession, login, requireSession } from "../../src/server/policy/session.ts";
import { Store } from "../../src/server/persistence/store.ts";
import { AppError } from "../../src/server/errors.ts";
import type { Transport } from "../../src/server/providers/http.ts";
import { githubEnvironment } from "../../src/server/github/cli.ts";

const config = readConfig({ LAUNCHLANE_AUTH_MODE: "liara", LAUNCHLANE_ORIGIN: "https://launchlane.example.test", LAUNCHLANE_SESSION_SECRET: "synthetic-session-secret-".repeat(3),
  LAUNCHLANE_OPERATOR_TOKEN: "install-owner-token-".repeat(3), LIARA_API_TOKEN: "install-owner-liara-token", LIARA_TEAM_ID: "a".repeat(24),
  LAUNCHLANE_APP_ALLOWLIST: "owner-app", LAUNCHLANE_WORKSPACE_ROOT: ".", LAUNCHLANE_GITHUB_CLI_PATH: "owner-gh" });
const teamA = "1".repeat(24), teamB = "2".repeat(24), idA = "3".repeat(24), idB = "4".repeat(24), password = "synthetic-login-password", tokenA = "synthetic-verified-liara-token-a", tokenB = "synthetic-verified-liara-token-b";
const code = (value: string) => (error: unknown) => error instanceof AppError && error.code === value;
function fixture(options: { twoFactor?: boolean; malformed?: boolean; status?: number; mismatchTeam?: boolean; failTeam?: boolean } = {}, calls: string[] = []): Transport {
  return async (address, init) => {
    const url = new URL(address); calls.push(`${init.method} ${url.pathname}`);
    assert.equal(url.origin, "https://api.liara.ir"); assert.equal(init.redirect, "error"); assert.equal(init.cache, "no-store");
    if (options.status) return Response.json({ private: password }, { status: options.status });
    if (url.pathname === "/v1/login/check-if-exists") return Response.json(options.malformed ? { exists: "yes" } : { exists: true, socialCompleted: true, twoFAEnabled: options.twoFactor ?? false });
    if (url.pathname === "/v1/login") { const body: unknown = JSON.parse(String(init.body)); assert.ok(body && typeof body === "object" && "password" in body && body.password === password);
      if (options.twoFactor) assert.ok("twoFAType" in body && body.twoFAType === "totp" && "totp" in body && body.totp === "123456");
      return Response.json({ api_token: "email" in body && body.email === "bob@example.test" ? tokenB : tokenA, password: "must-discard-provider-extra" }); }
    const bob = new Headers(init.headers).get("authorization") === `Bearer ${tokenB}`, id = bob ? idB : idA, team = bob ? teamB : teamA;
    if (url.pathname === "/v2/teams") return Response.json({ totalTeams: 1, teams: [{ _id: team, name: bob ? "تیم باب" : "تیم آلیس", private: "discard" }] });
    if (url.pathname === "/v1/projects") return Response.json({ projects: [] });
    if (url.pathname === "/v1/me") {
      if (options.failTeam && url.searchParams.has("teamID")) return Response.json({}, { status: 403 });
      return Response.json({ user: { _id: id, fullname: bob ? "باب" : "آلیس", email: bob ? "bob@example.test" : "alice@example.test", private: password },
        ...(url.searchParams.has("teamID") ? { team: { _id: options.mismatchTeam ? teamB : team, teamName: "فضای کاری" } } : {}) });
    }
    throw Error("Unexpected provider call");
  };
}
const signIn = (store: Store, email = "alice@example.test", send = fixture()) => liaraSignIn(config, store, { operation: "login", email, password }, AbortSignal.timeout(2000), send);

test("hosted config accepts HTTPS without operator key and removes every install-owner source/cloud fallback", async () => {
  assert.equal(config.authConfigured, true); assert.equal(config.authMode, "liara");
  assert.equal(config.operatorToken, ""); assert.equal(config.liaraToken, ""); assert.equal(config.teamId, ""); assert.deepEqual(config.apps, []); assert.equal(config.workspaceRoot, null); assert.equal(config.githubCliPath, "");
  assert.throws(() => readConfig({ LAUNCHLANE_ORIGIN: config.origin }), code("CONFIG_INVALID"));
  assert.throws(() => readConfig({ LAUNCHLANE_AUTH_MODE: "liara", LAUNCHLANE_ORIGIN: "http://public.example.test" }), code("CONFIG_INVALID"));
  await assert.rejects(githubEnvironment(config, "actor", "cli_system"), code("GITHUB_SCOPE_DENIED"));
});
test("verified provider identity creates stable actor, encrypted connection and revocable secure session without saving password", async () => {
  const store = new Store(":memory:"); try {
    const result = await signIn(store); assert.ok("session" in result);
    const actor = liaraActor(idA), saved = store.getConnection(actor, "liara"); assert.ok(saved?.ciphertext);
    assert.equal(result.session.actorId, actor); assert.equal(saved.view.teamId, null);
    assert.equal(openCredential(saved.ciphertext, config.sessionSecret, actor, "liara"), tokenA);
    const data = JSON.stringify(store.db.prepare("SELECT * FROM account_connections").all());
    for (const secret of [password, tokenA, "must-discard-provider-extra"]) assert.equal(data.includes(secret), false);
    assert.match(result.cookie, /HttpOnly; SameSite=Strict/); assert.match(result.cookie, /; Secure$/);
    const request = new Request(config.origin, { headers: { host: "launchlane.example.test", cookie: result.cookie.split(";")[0] ?? "" } });
    assert.equal(requireSession(request, config, store).actorId, actor);
    store.revokeSession(result.session.id); assert.throws(() => requireSession(request, config, store), code("AUTH_REQUIRED"));
    assert.throws(() => login("", config, store), code("AUTH_METHOD_DENIED"));
  } finally { store.close(); }
});
test("two-factor challenge performs no login/session until six digit code and successful provider response", async () => {
  const store = new Store(":memory:"), calls: string[] = []; try {
    const send = fixture({ twoFactor: true }, calls);
    assert.deepEqual(await liaraSignIn(config, store, { operation: "check", email: "alice@example.test" }, AbortSignal.timeout(1000), send), { twoFactorRequired: true });
    await assert.rejects(signIn(store, "alice@example.test", send), code("LIARA_TOTP_REQUIRED"));
    assert.equal(calls.includes("POST /v1/login"), false); assert.equal(store.db.prepare("SELECT count(*) n FROM sessions").get()?.n, 0);
    const result = await liaraSignIn(config, store, { operation: "login", email: "alice@example.test", password, totp: "123456" }, AbortSignal.timeout(1000), send);
    assert.ok("session" in result);
  } finally { store.close(); }
});
test("two users select only provider-verified own teams and tokens; arbitrary and mismatched scopes are rejected", async () => {
  const store = new Store(":memory:"); try {
    await signIn(store); await signIn(store, "bob@example.test"); const alice = liaraActor(idA), bob = liaraActor(idB), send = fixture();
    assert.deepEqual(await liaraTeams(config, store, alice, AbortSignal.timeout(1000), send), [{ id: teamA, name: "تیم آلیس" }]);
    await assert.rejects(selectLiaraTeam(config, store, alice, teamB, AbortSignal.timeout(1000), send), code("LIARA_TEAM_DENIED"));
    await assert.rejects(selectLiaraTeam(config, store, alice, teamA, AbortSignal.timeout(1000), fixture({ mismatchTeam: true })), code("LIARA_TEAM_MISMATCH"));
    await selectLiaraTeam(config, store, alice, teamA, AbortSignal.timeout(1000), send);
    await selectLiaraTeam(config, store, bob, teamB, AbortSignal.timeout(1000), send);
    assert.equal(actorConfig(config, store, alice).teamId, teamA); assert.equal(actorConfig(config, store, bob).teamId, teamB);
    assert.equal(connectedLiaraAccountConfig(actorConfig(config, store, alice), store, alice).liaraToken, tokenA);
    assert.equal(connectedLiaraAccountConfig(actorConfig(config, store, bob), store, bob).liaraToken, tokenB);
    assert.throws(() => connectedLiaraAccountConfig(actorConfig(config, store, alice), store, bob), code("LIARA_AUTH_REQUIRED"));
    await signIn(store); assert.equal(store.getConnection(alice, "liara")?.view.teamId, teamA);
    assert.equal(store.listActions(bob).length, 0);
  } finally { store.close(); }
});
for (const status of [400, 401, 403, 429, 500]) test(`upstream ${status} cannot create session/connection or expose upstream body`, async () => {
  const store = new Store(":memory:"); try {
    await assert.rejects(signIn(store, "alice@example.test", fixture({ status })), error => error instanceof AppError && !error.message.includes(password));
    assert.equal(store.db.prepare("SELECT count(*) n FROM sessions").get()?.n, 0); assert.equal(store.getConnection(liaraActor(idA), "liara"), null);
  } finally { store.close(); }
});
test("malformed identity/check, unexpected fields and cancelled transport fail closed", async () => {
  const store = new Store(":memory:"); try {
    await assert.rejects(signIn(store, "alice@example.test", fixture({ malformed: true })), code("LIARA_RESPONSE_INVALID"));
    await assert.rejects(liaraSignIn(config, store, { operation: "check", email: "alice@example.test", actorId: idA }, AbortSignal.timeout(1000), fixture()), code("INVALID_INPUT"));
    const controller = new AbortController(); setTimeout(() => controller.abort(), 5);
    await assert.rejects(liaraSignIn(config, store, { operation: "check", email: "alice@example.test" }, controller.signal, async () => new Promise<Response>(() => undefined)), code("CANCELLED"));
    assert.equal(store.db.prepare("SELECT count(*) n FROM sessions").get()?.n, 0);
  } finally { store.close(); }
});
test("durable account login limit precedes upstream call; forged Origin/Host are rejected", async () => {
  const store = new Store(":memory:"), calls: string[] = []; try {
    for (let i = 0; i < 10; i++) await liaraSignIn(config, store, { operation: "check", email: "alice@example.test" }, AbortSignal.timeout(1000), fixture({}, calls));
    await assert.rejects(signIn(store), code("RATE_LIMITED")); assert.equal(calls.length, 10);
    for (const headers of [{ host: "attacker.test", origin: config.origin }, { host: "launchlane.example.test", origin: "https://attacker.test" }])
      assert.throws(() => checkRequest(new Request(config.origin, { headers }), config, true));
  } finally { store.close(); }
});


test("remembered Liara sessions outlive the default hour, expire after thirty days and remain revocable", async () => {
  const store = new Store(":memory:");
  try {
    const started = Date.now();
    const result = await liaraSignIn(config, store, { operation: "login", email: "alice@example.test", password, remember: true }, AbortSignal.timeout(2000), fixture());
    assert.ok("session" in result);
    assert.ok(result.session.expiresAt >= started + 30 * 86400000);
    assert.match(result.cookie, /Max-Age=2592000; Secure$/);
    const request = new Request(config.origin, { headers: { host: "launchlane.example.test", cookie: result.cookie.split(";")[0] ?? "" } });
    assert.equal(requireSession(request, config, store, false, started + 2 * 86400000).actorId, liaraActor(idA));
    assert.throws(() => requireSession(request, config, store, false, result.session.expiresAt), code("AUTH_REQUIRED"));
    store.revokeSession(result.session.id);
    assert.throws(() => requireSession(request, config, store), code("AUTH_REQUIRED"));
    const ordinary = await signIn(store);
    assert.ok("session" in ordinary);
    assert.match(ordinary.cookie, /Max-Age=3600; Secure$/);
    const oldRequest = new Request(config.origin, { headers: { host: "launchlane.example.test", cookie: ordinary.cookie.split(";")[0] ?? "" } });
    assert.throws(() => requireSession(oldRequest, config, store, false, ordinary.session.expiresAt), code("AUTH_REQUIRED"));
    const operator = readConfig({ LAUNCHLANE_OPERATOR_TOKEN: "operator-test-".repeat(4), LAUNCHLANE_SESSION_SECRET: "session-test-".repeat(4) });
    assert.match(issueSession(liaraActor(idA), operator, store, Date.now(), true).cookie, /Max-Age=3600$/);
  } finally { store.close(); }
});

test("remember choice is a strict login boolean and never reaches Liara", async () => {
  const store = new Store(":memory:"), calls: string[] = [];
  try {
    for (const remember of ["true", 30, {}, null]) {
      await assert.rejects(liaraSignIn(config, store, { operation: "login", email: "alice@example.test", password, remember }, AbortSignal.timeout(1000), fixture({}, calls)), code("INVALID_INPUT"));
    }
    assert.deepEqual(calls, []);
    await assert.rejects(liaraSignIn(config, store, { operation: "check", email: "alice@example.test", remember: true }, AbortSignal.timeout(1000), fixture()), code("INVALID_INPUT"));
    const send: Transport = async (address, init) => {
      if (typeof init.body === "string") assert.equal(Object.hasOwn(JSON.parse(init.body), "remember"), false);
      return fixture()(address, init);
    };
    assert.ok("session" in await liaraSignIn(config, store, { operation: "login", email: "alice@example.test", password, remember: false }, AbortSignal.timeout(1000), send));
  } finally { store.close(); }
});


test("remembered session survives reopening the same durable Store and signing secret", async () => {
  const root = mkdtempSync(join(tmpdir(), "launchlane-login-persistence-")), path = join(root, "state.sqlite");
  let store = new Store(path);
  try {
    const result = await liaraSignIn(config, store, { operation: "login", email: "alice@example.test", password, remember: true }, AbortSignal.timeout(2000), fixture());
    assert.ok("session" in result);
    const request = new Request(config.origin, { headers: { host: "launchlane.example.test", cookie: result.cookie.split(";")[0] ?? "" } });
    store.close(); store = new Store(path);
    assert.equal(requireSession(request, config, store, false, Date.now() + 7 * 86400000).id, result.session.id);
    store.revokeSession(result.session.id);
    store.close(); store = new Store(path);
    assert.throws(() => requireSession(request, config, store), code("AUTH_REQUIRED"));
  } finally { store.close(); rmSync(root, { recursive: true, force: true }); }
});
