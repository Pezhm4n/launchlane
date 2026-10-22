import { createCipheriv, createDecipheriv, createHash, createHmac, randomBytes } from "node:crypto";
import type { EnvironmentSpec, EnvironmentVariable } from "../../contracts/environment.ts";
import { environmentVariables } from "../../contracts/environment.ts";
import { string } from "../../contracts/validation.ts";
import { parseEnvironmentSpec } from "../../contracts/environment.ts";
import { AppError, ensure } from "../errors.ts";
import { canonical } from "../policy/action.ts";
import type { Store } from "../persistence/store.ts";

function key(secret: string): Buffer {
  ensure(secret.length >= 32, "ENV_STORAGE_UNAVAILABLE", "راه‌اندازی امن نصب را تکمیل کنید.", 503);
  return createHash("sha256").update("Launchlane project environment v1\0").update(secret).digest();
}
export function environmentFingerprint(secret: string, values: readonly EnvironmentVariable[]): string {
  const bytes = key(secret);
  try { return createHmac("sha256", bytes).update(canonical([...values].sort((a, b) => a.key.localeCompare(b.key, "en")))).digest("hex"); }
  finally { bytes.fill(0); }
}
function binding(actorId: string, spec: EnvironmentSpec) { return canonical({ actorId, spec }); }
export function projectSecretValues(store: Store, secret: string, actorId: string): string[] {
  const rows = store.db.prepare("SELECT spec FROM actions WHERE actor_id=? AND json_extract(spec,'$.version')=9 ORDER BY rowid DESC LIMIT 128").all(actorId);
  return [...new Set(rows.flatMap(row => {
    const spec = parseEnvironmentSpec(JSON.parse(string(row.spec, 16384)));
    return openEnvironmentInput(store, secret, actorId, spec, true).filter(value => spec.secretKeys.includes(value.key)).map(row => row.value).filter(value => value.length >= 4);
  }))];
}
export function saveEnvironmentInput(store: Store, secret: string, actorId: string, spec: EnvironmentSpec,
  values: readonly EnvironmentVariable[], expiresAt: number): void {
  const bytes = key(secret), nonce = randomBytes(12);
  try {
    const cipher = createCipheriv("aes-256-gcm", bytes, nonce); cipher.setAAD(Buffer.from(binding(actorId, spec)));
    const ciphertext = Buffer.concat([cipher.update(JSON.stringify(environmentVariables(values)), "utf8"), cipher.final()]);
    store.db.prepare("INSERT INTO environment_inputs(id,actor_id,binding_json,ciphertext,expires_at) VALUES (?,?,?,?,?)")
      .run(spec.secretRef, actorId, binding(actorId, spec), ["v1", nonce.toString("base64url"), cipher.getAuthTag().toString("base64url"), ciphertext.toString("base64url")].join("."), expiresAt);
  } finally { bytes.fill(0); }
}
export function openEnvironmentInput(store: Store, secret: string, actorId: string, spec: EnvironmentSpec, allowExpired = false): EnvironmentVariable[] {
  const row = store.db.prepare("SELECT * FROM environment_inputs WHERE id=? AND actor_id=?").get(spec.secretRef, actorId);
  ensure(row && row.binding_json === binding(actorId, spec) && (allowExpired || Number(row.expires_at) > Date.now()),
    "ENV_INPUT_EXPIRED", "اعتبار اطلاعات امن تمام شده یا محدوده تغییر کرده است؛ مقدار قبلی بازنمایی نمی‌شود.", 409);
  const bytes = key(secret);
  try {
    const parts = string(row.ciphertext, 800000).split(".");
    ensure(parts.length === 4 && parts[0] === "v1", "ENV_STORAGE_INVALID", "اطلاعات امن قابل بازیابی نیست.", 503);
    const nonce = Buffer.from(parts[1] ?? "", "base64url"), tag = Buffer.from(parts[2] ?? "", "base64url");
    ensure(nonce.length === 12 && tag.length === 16, "ENV_STORAGE_INVALID", "اطلاعات امن قابل بازیابی نیست.", 503);
    const cipher = createDecipheriv("aes-256-gcm", bytes, nonce); cipher.setAAD(Buffer.from(binding(actorId, spec))); cipher.setAuthTag(tag);
    const values = environmentVariables(JSON.parse(Buffer.concat([cipher.update(Buffer.from(parts[3] ?? "", "base64url")), cipher.final()]).toString("utf8")));
    ensure(environmentFingerprint(secret, values) === spec.effectiveFingerprint, "ENV_STORAGE_INVALID", "اطلاعات امن تغییر کرده است.", 503);
    return values;
  } catch { throw new AppError("ENV_STORAGE_INVALID", "اطلاعات امن قابل بازیابی نیست.", 503); }
  finally { bytes.fill(0); }
}
