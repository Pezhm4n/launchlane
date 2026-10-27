const signingKeys = new Set(["SESSION_SECRET", "JWT_SECRET", "AUTH_SECRET", "NEXTAUTH_SECRET", "COOKIE_SECRET", "COOKIE_SIGNING_SECRET"]);

/** An explicit convenience for fresh signing values, never credentials or encryption keys. */
export function canGenerateSigningSecret(key: string): boolean { return signingKeys.has(key); }

export function generateSigningSecret(): string {
  const bytes = new Uint8Array(32);
  globalThis.crypto.getRandomValues(bytes);
  return Array.from(bytes, byte => byte.toString(16).padStart(2, "0")).join("");
}
