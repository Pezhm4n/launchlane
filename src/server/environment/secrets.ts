import { createCipheriv, createDecipheriv, createHash, createHmac, randomBytes } from "node:crypto";
import type { EnvironmentSpec, EnvironmentVariable, EnvironmentReference } from "../../contracts/environment.ts";
import { environmentVariables, isApplicationEnvironmentKey, isPublicClientEnvironmentKey, validateEnvironmentVisibility } from "../../contracts/environment.ts";
import { object, string } from "../../contracts/validation.ts";
import { parseEnvironmentSpec } from "../../contracts/environment.ts";
import { AppError, ensure } from "../errors.ts";
import { canonical, fingerprint } from "../policy/action.ts";
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
export function environmentProjectIds(store: Store, actorId: string, projectId: string): Set<string> {
  const projects = new Set<string>(); let flow = store.getProjectFlow(actorId, projectId), complete = false;
  for (let depth = 0; flow && depth < 8 && !projects.has(flow.id); depth++) {
    projects.add(flow.id);
    if (flow.selection.kind !== "repair") { complete = true; break; }
    const record = store.db.prepare("SELECT data_json FROM code_repair_jobs WHERE actor_id=? AND id=?").get(actorId, flow.selection.jobId);
    if (!record) break;
    const job = object(object(JSON.parse(string(record.data_json, 1024 * 1024))).job);
    flow = store.getProjectFlow(actorId, string(job.projectId, 36));
  }
  ensure(complete, "ENV_LINEAGE_UNAVAILABLE", "تبار نسخه اصلاح‌شده قابل تأیید نیست؛ اطلاعات پروژه دیگری استفاده نمی‌شود.", 409);
  return projects;
}
export function currentEnvironment(store: Store, secret: string, actorId: string, projectId: string): EnvironmentReference | null {
  const connection = store.getConnection(actorId, "liara")?.view, target = connection?.apps.find(row => row.name === connection.selectedApp);
  if (!connection || !target) return null;
  const projects = environmentProjectIds(store, actorId, projectId);
  const rows = store.db.prepare("SELECT id FROM actions WHERE actor_id=? AND state='succeeded' AND json_extract(spec,'$.version')=9 ORDER BY rowid DESC LIMIT 128").all(actorId);
  for (const row of rows) {
    const action = store.getAction(string(row.id, 36), actorId), spec = action.spec;
    if (spec.version !== 9 || !projects.has(spec.projectFlowId) || spec.accountId !== connection.identityId || spec.scope.teamId !== connection.teamId || spec.targetAppId !== target.id || spec.scope.app !== target.name) continue;
    validateEnvironmentVisibility(spec.secretKeys);
    const values = openEnvironmentInput(store, secret, actorId, spec, true), names = store.getProjectFlow(actorId, projectId)?.profile.envNames ?? [];
    return { actionId: action.id, fingerprint: spec.effectiveFingerprint, keys: values.map(row => row.key).filter(key => names.includes(key) && isApplicationEnvironmentKey(key)) };
  }
  return null;
}
export function projectEnvironmentValues(store: Store, secret: string, actorId: string, projectId: string, reference: EnvironmentReference | null | undefined): EnvironmentVariable[] {
  ensure(fingerprint(reference ?? null) === fingerprint(currentEnvironment(store, secret, actorId, projectId)), "ENV_REFERENCE_CHANGED", "اطلاعات برنامه تغییر کرده است؛ ساخت و تصمیم تازه لازم است.", 409);
  if (!reference) return [];
  const action = store.getAction(reference.actionId, actorId);
  ensure(action.spec.version === 9 && action.state === "succeeded", "ENV_REFERENCE_UNVERIFIED", "ذخیره اطلاعات برنامه هنوز تأیید نشده است.", 409);
  return openEnvironmentInput(store, secret, actorId, action.spec, true).filter(row => reference.keys.includes(row.key));
}
export function projectSecretValues(store: Store, secret: string, actorId: string): string[] {
  const rows = store.db.prepare("SELECT spec FROM actions WHERE actor_id=? AND json_extract(spec,'$.version')=9 ORDER BY rowid DESC LIMIT 128").all(actorId);
  return [...new Set(rows.flatMap(row => {
    const spec = parseEnvironmentSpec(JSON.parse(string(row.spec, 16384)));
    const publicKeys = new Set(spec.keys.filter(key => !spec.secretKeys.includes(key)));
    // Merging a new key must not leave inherited credential-like values exposed in later evidence.
    return openEnvironmentInput(store, secret, actorId, spec, true).filter(value => spec.secretKeys.includes(value.key) ||
      (!publicKeys.has(value.key) && !isPublicClientEnvironmentKey(value.key) && value.value.length >= 8 && /(?:^|_)(?:PRIVATE|TOKEN|SECRET|PASSWORD|API_KEY|ACCESS|AUTH|CREDENTIALS?)(?:_|$)/i.test(value.key)))
      .map(row => row.value).filter(value => value.length >= 4);
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
