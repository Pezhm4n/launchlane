import assert from "node:assert/strict";
import { test } from "node:test";
import { containsSourceCredential, redact } from "../../src/server/policy/redaction.ts";
import { writeFile } from "node:fs/promises";
import { join } from "node:path";
import { agentFixture } from "../helpers/agent-fixture.ts";
import { captureProject } from "../../src/server/workspace/inspect.ts";
import { createSourceArchive } from "../../src/server/workspace/archive.ts";

test("Python compound runtime references are not hardcoded credentials; static fragments and installed values remain blocked", () => {
  for (const source of ['composite_secret = f"{secret}:{password_hash}"', 'token = f"Bearer {account.token}"', "secret = f'{config.secret}:{user.password_hash}'"])
    assert.equal(containsSourceCredential(source, [], "app/tokens.py"), false, source);
  for (const source of ['secret = f"actual-private-value:{user_id}"', 'secret = f"{user_id}:{\'actual-private-value\'}"', 'secret = f"{{private}}"', 'secret = "actual-private-value"'])
    assert.equal(containsSourceCredential(source, [], "app/tokens.py"), true, source);
  assert.equal(containsSourceCredential('secret = f"{account.secret}:{password_hash}"', ["password_hash"], "app/tokens.py"), true);
});

test("a Python comment names the Bearer header without exempting real headers or weakening log redaction", () => {
  assert.equal(containsSourceCredential("# Bearer header takes precedence over cookies", [], "api/auth.py"), false);
  assert.equal(containsSourceCredential('authorization = "Bearer actual-private-value"', [], "api/auth.py"), true);
  assert.equal(containsSourceCredential('authorization = "Bearer header"', [], "api/auth.py"), true);
  assert.equal(redact("Bearer header"), "Bearer [REDACTED]");
});

test("exact documentation omissions are accepted while appended real bytes, runtime defaults and known values stay blocked", () => {
  for (const value of ["...", "sk-...", "sk-or-...", "sk-ant-..."])
    assert.equal(containsSourceCredential(`LLM_API_KEY=${value}`, [], "README.md"), false, value);
  for (const value of ["sk-...actual-private-value", "sk-or-real-private-value", "sk-ant-...extra"])
    assert.equal(containsSourceCredential(`LLM_API_KEY=${value}`, [], "README.md"), true, value);
  assert.equal(containsSourceCredential('api_key = "sk-..."', [], "config.py"), true);
  assert.equal(containsSourceCredential("LLM_API_KEY=sk-...", ["sk-..."], "README.md"), true);
});

test("DOM input reads use actual unshadowed query syntax and a locally proven selector alias", () => {
  for (const source of [
    'const password=document.querySelector("#login-password").value;',
    'const token=document.getElementById("reset-token").value.trim();',
    'const $=s=>document.querySelector(s);const new_password=$("#reset-new-password").value;',
    'input.type=isPassword ? "password" : "text";',
  ]) assert.equal(containsSourceCredential(source, [], "ui/app.js"), false, source);
  for (const source of [
    'const $=s=>"actual-private-value";const password=$("#login-password").value;',
    'const $=s=>document.querySelector(s);$=decode;const password=$("#login-password").value;',
    'const $=s=>document.querySelector(s);function other($){const password=$("#login-password").value}',
    'const $=s=>document.querySelector(s);function other({$}){const password=$("#login-password").value}',
    'function other({document}){const token=document.getElementById("reset-token").value}',
    'const document=customStore;const token=document.getElementById("reset-token").value;',
    'document.querySelector=decode;const password=document.querySelector("#login-password").value;',
    'Object.defineProperty(document,"querySelector",{value:decode});const password=document.querySelector("#login-password").value;',
    'window.document.querySelector=decode;const password=document.querySelector("#login-password").value;',
    'const $=s=>document.querySelector(s);[$]=replacement;const password=$("#login-password").value;',
    'const password=document.querySelector("#login-password").value || "actual-private-value";',
    'const password={password:"text"};',
    'input.type=isPassword ? "password" : "actual-private-value";',
  ]) assert.equal(containsSourceCredential(source, [], "ui/app.js"), true, source);
  assert.equal(containsSourceCredential('const password=document.querySelector("#known-secret-id").value;', ["known-secret-id"], "ui/app.js"), true);
});

test("source intake and archive keep runtime-expression bytes while an adjacent real credential still blocks capture", async () => {
  const f = await agentFixture();try {
    const browser = 'const $=s=>document.querySelector(s);const password=$("#login-password").value;';
    const python = 'composite_secret = f"{secret}:{password_hash}"\n# Bearer header metadata\n';
    await writeFile(join(f.project, "browser.js"), browser);await writeFile(join(f.project, "tokens.py"), python);
    const capture = await captureProject(f.workspace, "service");
    assert.equal(capture.files.find(file => file.path === "browser.js")?.content.toString(), browser);
    assert.equal(capture.files.find(file => file.path === "tokens.py")?.content.toString(), python);
    const archive = await createSourceArchive({ workspaceRoot: f.workspace, directory: "service", sourceHash: capture.profile.sourceHash });
    assert.equal(archive.artifact.sourceHash, capture.profile.sourceHash);assert.ok(archive.artifact.fileCount > 0);
    await writeFile(join(f.project, "browser.js"), browser + '\nconst apiKey="actual-private-value";');
    await assert.rejects(captureProject(f.workspace, "service"), { code: "SENSITIVE_SOURCE" });
    await assert.rejects(createSourceArchive({ workspaceRoot: f.workspace, directory: "service", sourceHash: capture.profile.sourceHash }), { code: "SENSITIVE_SOURCE" });
  } finally { f.close(); }
});
