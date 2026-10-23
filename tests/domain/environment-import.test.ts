import assert from "node:assert/strict";
import { test } from "node:test";
import { join } from "node:path";
import { readFileSync } from "node:fs";
import { agentFixture } from "../helpers/agent-fixture.ts";
import { parseEnvironmentFiles, saveImportedEnvironment, importedEnvironment, importedSecretValues } from "../../src/server/environment/import.ts";
import { prepareProjectFlow } from "../../src/server/application/project-flows.ts";
import { readFolderUpload } from "../../src/server/workspace/upload.ts";
import { AppError } from "../../src/server/errors.ts";
const code = (value: string) => (error: unknown) => error instanceof AppError && error.code === value;

test("environment import uses documented production overlay order and literal parsing without shell evaluation", () => {
  assert.deepEqual(parseEnvironmentFiles([
    { name: ".env.production.local", content: "KEY=final-value\nLITERAL='$(must-not-run)'" },
    { name: ".env", content: "KEY=base-value\nexport MESSAGE=\"hello # world\"" },
    { name: ".env.local", content: "KEY=local-value" },
    { name: ".env.production", content: "KEY=production-value" },
  ]), [{ key: "KEY", value: "final-value" }, { key: "LITERAL", value: "$(must-not-run)" }, { key: "MESSAGE", value: "hello # world" }]);
  assert.throws(() => parseEnvironmentFiles([{ name: "../.env", content: "KEY=value" }]), code("INVALID_ENV_FILE"));
  assert.throws(() => parseEnvironmentFiles([{ name: ".env", content: "KEY=value" }, { name: ".env", content: "KEY=other" }]), code("INVALID_ENV_FILE"));
});
test("multipart secret inputs remain separate from source and are validated independently", async () => {
  const form = new FormData();
  form.set("manifest", JSON.stringify({ name: "app", paths: ["server.mjs"], environmentFiles: [".env"] }));
  form.set("file-0", new Blob(["console.log(process.env.KEY)"]), "server.mjs");
  form.set("environment-0", new Blob(["KEY=private-input-marker"]), ".env");
  const uploaded = await readFolderUpload(new Request("http://localhost", { method: "POST", body: form }));
  assert.deepEqual(uploaded.files.map(file => file.path), ["server.mjs"]);
  assert.deepEqual(uploaded.environment, [{ key: "KEY", value: "private-input-marker" }]);
  form.set("manifest", JSON.stringify({ name: "app", paths: ["server.mjs"], environmentFiles: ["config/.env"] }));
  await assert.rejects(readFolderUpload(new Request("http://localhost", { method: "POST", body: form })), code("INVALID_ENV_FILE"));
  form.set("manifest", JSON.stringify({ name: "app", paths: ["server.mjs"], environmentFiles: [".env"] }));
  form.set("environment-0", new Blob([new Uint8Array([0x4b, 0x3d, 0xff])]), ".env");
  await assert.rejects(readFolderUpload(new Request("http://localhost", { method: "POST", body: form })), code("INVALID_ENV_FILE"));
});
test("source-bound imported environment is encrypted and rejects actor, revision and ciphertext substitution", async () => {
  const f = await agentFixture(), actor = f.session.actorId, value = "private-input-marker";
  try {
    saveImportedEnvironment(f.config, f.store, actor, f.flow, [{ key: "PRIVATE_VALUE", value }]);
    assert.deepEqual(importedEnvironment(f.config, f.store, actor, f.flow.id), [{ key: "PRIVATE_VALUE", value }]);
    assert.deepEqual(importedEnvironment(f.config, f.store, actor, f.flow.id).map(row => row.key), ["PRIVATE_VALUE"]);
    assert.equal(JSON.stringify(f.store.db.prepare("SELECT * FROM environment_inputs").all()).includes(value), false);
    assert.equal(readFileSync(join(f.config.stateDir, "state.sqlite")).includes(Buffer.from(value)), false);
    assert.throws(() => importedEnvironment(f.config, f.store, "foreign-actor", f.flow.id), code("ENV_LINEAGE_UNAVAILABLE"));
    const other = await prepareProjectFlow(f.config, f.store, actor, { kind: "local", directory: "service" }, AbortSignal.timeout(5000));
    assert.deepEqual(importedEnvironment(f.config, f.store, actor, other.id), [{ key: "DO_NOT_EXPORT", value: "private-local-fixture-value" }]);
    f.store.db.prepare("UPDATE environment_inputs SET ciphertext=substr(ciphertext,1,length(ciphertext)-4)||'AAAA'").run();
    assert.throws(() => importedEnvironment(f.config, f.store, actor, f.flow.id), code("ENV_STORAGE_INVALID"));
  } finally { f.close(); }
});
test("failure to save encrypted configuration rolls back source activation and removes an uncommitted upload", async () => {
  const f = await agentFixture();
  try {
    await assert.rejects(prepareProjectFlow(f.config, f.store, f.session.actorId, { kind: "upload", directory: ".", name: "new-project" },
      AbortSignal.timeout(5000), undefined, undefined, [{ path: "package.json", content: Buffer.from('{"engines":{"node":"22"},"scripts":{"start":"node server.mjs"}}') },
        { path: "server.mjs", content: Buffer.from("console.log('ready')") }], () => { throw new AppError("TEST_VAULT_FAILURE", "synthetic vault failure", 503); }), code("TEST_VAULT_FAILURE"));
    assert.equal(f.store.getProjectFlow(f.session.actorId)?.id, f.flow.id);
    assert.equal(f.store.db.prepare("SELECT count(*) n FROM project_flows").get()?.n, 1);
  } finally { f.close(); }
});
test("a public-looking name cannot disable redaction of imported values before classification", async () => {
  const f = await agentFixture();
  try {
    saveImportedEnvironment(f.config, f.store, f.session.actorId, f.flow, [{ key: "NEXT_PUBLIC_TOKEN", value: "private-until-reviewed-fixture" }]);
    assert.ok(importedSecretValues(f.config.sessionSecret, f.store, f.session.actorId).includes("private-until-reviewed-fixture"));
  } finally { f.close(); }
});
