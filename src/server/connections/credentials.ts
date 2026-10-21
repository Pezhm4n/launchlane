import { createCipheriv, createDecipheriv, createHash, randomBytes } from "node:crypto";
import type { ConnectionProvider } from "../../contracts/connections.ts";
import { AppError, ensure } from "../errors.ts";

function key(secret: string): Buffer {
  ensure(
    secret.length >= 32,
    "CREDENTIAL_STORAGE_UNAVAILABLE",
    "نگهداری امن اطلاعات اتصال آماده نیست. راه‌اندازی محلی را تکمیل کنید.",
    503,
  );
  return createHash("sha256").update("Launchlane credentials v1\0").update(secret).digest();
}
export function sealCredential(
  value: string,
  secret: string,
  actorId: string,
  provider: ConnectionProvider,
): string {
  ensure(
    value.length > 0 && Buffer.byteLength(value) <= 8192,
    "CREDENTIAL_INVALID",
    "کلید دسترسی معتبر نیست.",
  );
  const nonce = randomBytes(12),
    cipherKey = key(secret);
  try {
    const cipher = createCipheriv("aes-256-gcm", cipherKey, nonce);
    cipher.setAAD(Buffer.from(JSON.stringify({ version: 1, actorId, provider })));
    const encrypted = Buffer.concat([cipher.update(value, "utf8"), cipher.final()]);
    return [
      "v1",
      nonce.toString("base64url"),
      cipher.getAuthTag().toString("base64url"),
      encrypted.toString("base64url"),
    ].join(".");
  } finally {
    cipherKey.fill(0);
  }
}
export function openCredential(
  sealed: string,
  secret: string,
  actorId: string,
  provider: ConnectionProvider,
): string {
  const cipherKey = key(secret);
  try {
    const parts = sealed.split(".");
    ensure(
      parts.length === 4 && parts[0] === "v1" && sealed.length <= 12000,
      "CREDENTIAL_STORAGE_INVALID",
      "اطلاعات اتصال قابل بازیابی نیست. دوباره متصل شوید.",
      503,
    );
    const nonce = Buffer.from(parts[1] || "", "base64url"),
      tag = Buffer.from(parts[2] || "", "base64url");
    ensure(
      nonce.length === 12 && tag.length === 16,
      "CREDENTIAL_STORAGE_INVALID",
      "اطلاعات اتصال قابل بازیابی نیست.",
      503,
    );
    const decipher = createDecipheriv("aes-256-gcm", cipherKey, nonce);
    decipher.setAAD(Buffer.from(JSON.stringify({ version: 1, actorId, provider })));
    decipher.setAuthTag(tag);
    return Buffer.concat([
      decipher.update(Buffer.from(parts[3] || "", "base64url")),
      decipher.final(),
    ]).toString("utf8");
  } catch {
    throw new AppError(
      "CREDENTIAL_STORAGE_INVALID",
      "اطلاعات اتصال قابل بازیابی نیست. دوباره متصل شوید.",
      503,
    );
  } finally {
    cipherKey.fill(0);
  }
}
