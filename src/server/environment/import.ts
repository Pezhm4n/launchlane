import { createCipheriv, createDecipheriv, createHash, randomBytes, randomUUID } from "node:crypto";
import { parseEnv } from "node:util";
import { lstat } from "node:fs/promises";
import { join } from "node:path";
import { environmentFileNames, environmentFileMaxBytes, isEnvironmentFile } from "../../contracts/environment-files.ts";
import { environmentVariables, isApplicationEnvironmentKey, isPublicClientEnvironmentKey, type EnvironmentVariable } from "../../contracts/environment.ts";
import type { ProjectFlow } from "../../contracts/project-flow.ts";
import type { Config } from "../config.ts";
import type { Store } from "../persistence/store.ts";
import { environmentProjectIds } from "./secrets.ts";
import { AppError, ensure } from "../errors.ts";
import { workspaceDirectory } from "../workspace/paths.ts";
import { readSafeFile } from "../workspace/inspect.ts";

export type EnvironmentFile = { name: string; content: string };
export async function localEnvironmentFiles(root: string, directory: string, signal: AbortSignal): Promise<EnvironmentVariable[]> {
  const { target } = await workspaceDirectory(root, directory), files: EnvironmentFile[] = [];
  for (const name of environmentFileNames) {
    ensure(!signal.aborted, "CANCELLED", "دریافت تنظیمات متوقف شد.", 409);
    const path = join(target, name);
    try { await lstat(path); }
    catch (cause) { if (cause instanceof Error && "code" in cause && cause.code === "ENOENT") continue; throw new AppError("ENV_FILE_UNAVAILABLE", "فایل تنظیمات قابل خواندن نیست.", 409); }
    const bytes = await readSafeFile(target, path, environmentFileMaxBytes);
    let content: string;
    try { content = new TextDecoder("utf-8", { fatal: true }).decode(bytes); }
    catch { throw new AppError("INVALID_ENV_FILE", "فایل تنظیمات باید متن UTF-8 معتبر باشد؛ مقدارها تغییر داده نمی‌شوند."); }
    files.push({ name, content });
  }
  return parseEnvironmentFiles(files);
}
export function parseEnvironmentFiles(files: readonly EnvironmentFile[]): EnvironmentVariable[] {
  ensure(files.length <= 4 && new Set(files.map(file => file.name)).size === files.length, "INVALID_ENV_FILE", "فایل تنظیمات تکراری یا بیش از حد مجاز است.");
  const merged = new Map<string, string>();
  for (const name of environmentFileNames) {
    const file = files.find(candidate => candidate.name === name);
    if (!file) continue;
    ensure(Buffer.byteLength(file.content) <= environmentFileMaxBytes && !file.content.includes("\0"), "INVALID_ENV_FILE", "فایل تنظیمات بیش از حد بزرگ یا نامعتبر است.");
    // Node's parser reads literals only; interpolation is never executed or guessed.
    for (const [key, value] of Object.entries(parseEnv(file.content))) {
      ensure(typeof value === "string", "INVALID_ENV_FILE", "مقدار تنظیمات معتبر نیست."); merged.set(key, value);
    }
  }
  ensure(files.every(file => isEnvironmentFile(file.name)), "INVALID_ENV_FILE", "فقط فایل تنظیمات ریشهٔ همین برنامه پذیرفته می‌شود.");
  return environmentVariables([...merged].map(([key, value]) => ({ key, value })));
}
function binding(actorId: string, flow: ProjectFlow): string {
  return JSON.stringify({ version: 1, kind: "source_environment", actorId, projectId: flow.id, sourceHash: flow.profile.sourceHash });
}
function encryptionKey(secret: string): Buffer {
  ensure(secret.length >= 32, "ENV_STORAGE_UNAVAILABLE", "نگهداری امن تنظیمات آماده نیست.", 503);
  return createHash("sha256").update("Launchlane source environment v1\0").update(secret).digest();
}
export function saveImportedEnvironment(config: Config, store: Store, actorId: string, flow: ProjectFlow, values: readonly EnvironmentVariable[]): void {
  if (!values.length) return;
  const credentials = [config.operatorToken, config.sessionSecret, config.modelKey, config.liaraToken].filter(Boolean);
  ensure(values.every(row => credentials.every(secret => !row.value.includes(secret))), "ENV_INFRASTRUCTURE_CREDENTIAL", "کلیدهای زیرساخت این نصب نمی‌توانند تنظیمات پروژه باشند.", 409);
  const key = encryptionKey(config.sessionSecret), nonce = randomBytes(12), aad = binding(actorId, flow);
  try {
    const cipher = createCipheriv("aes-256-gcm", key, nonce); cipher.setAAD(Buffer.from(aad));
    const encrypted = Buffer.concat([cipher.update(JSON.stringify(environmentVariables(values))), cipher.final()]);
    // The existing private vault also holds pre-decision source inputs, with a distinct authenticated binding.
    store.db.prepare("INSERT INTO environment_inputs(id,actor_id,binding_json,ciphertext,expires_at) VALUES (?,?,?,?,?)")
      .run(randomUUID(), actorId, aad, ["source-v1", nonce.toString("base64url"), cipher.getAuthTag().toString("base64url"), encrypted.toString("base64url")].join("."), Date.now() + 30 * 86400000);
  } finally { key.fill(0); }
}
export function importedEnvironment(config: Pick<Config, "sessionSecret">, store: Store, actorId: string, projectId: string, allowExpired = false): EnvironmentVariable[] {
  const projects = environmentProjectIds(store, actorId, projectId);
  for (const id of projects) {
    const flow = store.getProjectFlow(actorId, id);
    if (!flow) continue;
    const aad = binding(actorId, flow), row = store.db.prepare("SELECT ciphertext,expires_at FROM environment_inputs WHERE actor_id=? AND binding_json=? ORDER BY rowid DESC LIMIT 1").get(actorId, aad);
    if (!row) continue;
    ensure(allowExpired || Number(row.expires_at) > Date.now(), "ENV_INPUT_EXPIRED", "مهلت استفاده از تنظیمات پوشه تمام شده؛ فایل تنظیمات را دوباره وارد کنید.", 409);
    const key = encryptionKey(config.sessionSecret);
    try {
      ensure(typeof row.ciphertext === "string", "ENV_STORAGE_INVALID", "تنظیمات امن قابل بازیابی نیست.", 503);
      const [version, nonce, tag, content] = row.ciphertext.split(".");
      ensure(version === "source-v1" && nonce && tag && content, "ENV_STORAGE_INVALID", "تنظیمات امن قابل بازیابی نیست.", 503);
      const decipher = createDecipheriv("aes-256-gcm", key, Buffer.from(nonce, "base64url"));
      decipher.setAAD(Buffer.from(aad)); decipher.setAuthTag(Buffer.from(tag, "base64url"));
      return environmentVariables(JSON.parse(Buffer.concat([decipher.update(Buffer.from(content, "base64url")), decipher.final()]).toString("utf8")));
    } catch { throw new AppError("ENV_STORAGE_INVALID", "تنظیمات امن قابل بازیابی نیست؛ فایل تنظیمات را دوباره وارد کنید.", 503); }
    finally { key.fill(0); }
  }
  return [];
}
export function importedEnvironmentReview(config: Pick<Config, "sessionSecret">, store: Store, actorId: string, flow: ProjectFlow) {
  const values = importedEnvironment(config, store, actorId, flow.id).filter(row => flow.profile.envNames.includes(row.key) && isApplicationEnvironmentKey(row.key));
  const localOrTemplate = (value: string) => value.length < 4 || /(?:localhost|127\.0\.0\.1|\[::1\]|\$\{|\$\()/i.test(value);
  return { available: values.filter(row => !localOrTemplate(row.value)).map(row => row.key),
    needsReview: values.filter(row => localOrTemplate(row.value)).map(row => row.key),
    publicKeys: values.filter(row => isPublicClientEnvironmentKey(row.key)).map(row => row.key) };
}
export function importedSecretValues(secret: string, store: Store, actorId: string): string[] {
  const rows = store.db.prepare("SELECT DISTINCT json_extract(binding_json,'$.projectId') AS project_id FROM environment_inputs WHERE actor_id=? AND json_extract(binding_json,'$.kind')='source_environment' ORDER BY rowid DESC LIMIT 128").all(actorId);
  return [...new Set(rows.flatMap(row => typeof row.project_id === "string"
    ? importedEnvironment({ sessionSecret: secret }, store, actorId, row.project_id, true).filter(value => value.value.length >= 4).map(value => value.value) : []))];
}
