import { createHmac, timingSafeEqual } from "node:crypto";
import { constants, closeSync, fstatSync, lstatSync, openSync, readFileSync, realpathSync } from "node:fs";
import { join, resolve } from "node:path";
import { publicTestFixturePath, type SourceFixtureReviewEvidence } from "../../contracts/source-fixture-review.ts";
import { exactKeys, hash, integer, object, string } from "../../contracts/validation.ts";
import { AppError, ensure } from "../errors.ts";
import { canonical } from "./action.ts";

export const sourceReviewFilename = "source-fixture-reviews.json";
export type PublicFixtureReview = Readonly<{ version: 1; id: string; reviewedAt: number; expiresAt: number; files: readonly Readonly<{ path: string; sha256: string }>[]; signature: string }>;
function reviewFields(value: unknown): Omit<PublicFixtureReview, "signature"> {
  const row = object(value);
  const id = string(row.id, 36), reviewedAt = integer(row.reviewedAt, 0, Number.MAX_SAFE_INTEGER), expiresAt = integer(row.expiresAt, 0, Number.MAX_SAFE_INTEGER);
  ensure(row.version === 1 && /^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/.test(id) && expiresAt > reviewedAt && expiresAt - reviewedAt <= 7 * 86400000 && Array.isArray(row.files) && row.files.length > 0 && row.files.length <= 64,
    "SOURCE_REVIEW_INVALID", "محدوده و مهلت بازبینی معتبر نیست.", 409);
  const files = row.files.map(input => { const file = object(input); exactKeys(file, ["path", "sha256"]); return { path: publicTestFixturePath(file.path), sha256: hash(file.sha256) }; });
  ensure(new Set(files.map(file => file.path)).size === files.length, "SOURCE_REVIEW_INVALID", "فایل بازبینی تکراری است.", 409);
  return { version: 1, id, reviewedAt, expiresAt, files };
}
export function signFixtureReview(secret: string, value: Omit<PublicFixtureReview, "signature">): PublicFixtureReview {
  ensure(secret.length >= 32, "SOURCE_REVIEW_UNAVAILABLE", "کلید نصب برای ثبت بازبینی لازم است.", 503);
  const unsigned = reviewFields(value), signature = createHmac("sha256", secret).update("Launchlane public test fixture review v1\0").update(canonical(unsigned)).digest("hex");
  return { ...unsigned, signature };
}
export function parseFixtureReview(value: unknown, secret: string): PublicFixtureReview {
  const row = object(value); exactKeys(row, ["version", "id", "reviewedAt", "expiresAt", "files", "signature"]);
  const signed = signFixtureReview(secret, reviewFields(row)), signature = hash(row.signature);
  ensure(timingSafeEqual(Buffer.from(signature, "hex"), Buffer.from(signed.signature, "hex")), "SOURCE_REVIEW_INVALID", "امضای بازبینی نصب معتبر نیست.", 409);
  return signed;
}
export function readFixtureReviewRegistry(stateDir: string, secret: string): readonly PublicFixtureReview[] {
  const path = join(resolve(stateDir), sourceReviewFilename);
  try {
    const before = lstatSync(path);
    ensure(before.isFile() && !before.isSymbolicLink() && before.nlink === 1 && before.size <= 64 * 1024 && realpathSync(path) === path,
      "SOURCE_REVIEW_INVALID", "فایل بازبینی نصب امن و محدود نیست.", 503);
    const handle = openSync(path, constants.O_RDONLY | (constants.O_NOFOLLOW || 0));
    try {
      const opened = fstatSync(handle);
      ensure(opened.ino === before.ino && opened.dev === before.dev && opened.size === before.size, "SOURCE_REVIEW_INVALID", "بازبینی هنگام خواندن تغییر کرده است.", 409);
      const bytes = readFileSync(handle); const after = fstatSync(handle);
      ensure(bytes.length === before.size && after.mtimeMs === opened.mtimeMs && after.ctimeMs === opened.ctimeMs && realpathSync(path) === path,
        "SOURCE_REVIEW_INVALID", "بازبینی هنگام خواندن تغییر کرده است.", 409);
      const row = object(JSON.parse(new TextDecoder("utf-8", { fatal: true }).decode(bytes))); exactKeys(row, ["version", "reviews"]);
      ensure(row.version === 1 && Array.isArray(row.reviews) && row.reviews.length <= 32, "SOURCE_REVIEW_INVALID", "دفتر بازبینی نصب معتبر نیست.", 409);
      const reviews = row.reviews.map(value => parseFixtureReview(value, secret));
      ensure(reviews.reduce((total, review) => total + review.files.length, 0) <= 256, "SOURCE_REVIEW_INVALID", "تعداد فایل‌های بازبینی بیش از سقف است.", 413);
      return reviews;
    } finally { closeSync(handle); }
  } catch (error) {
    if (error && typeof error === "object" && "code" in error && error.code === "ENOENT") return [];
    if (error instanceof AppError) throw error;
    throw new AppError("SOURCE_REVIEW_INVALID", "دفتر بازبینی source قابل تأیید نیست؛ استثنای تازه اعمال نشد.", 503);
  }
}
/** Operator configuration, never a model option or authority to modify cloud resources. */
export function configuredFixtureReviews(now = Date.now()): readonly SourceFixtureReviewEvidence[] {
  const secret = process.env.LAUNCHLANE_SESSION_SECRET;
  // An unconfigured inspector has no authority to use this installation's exemptions.
  if (!secret) return [];
  return readFixtureReviewRegistry(process.env.LAUNCHLANE_STATE_DIR || ".data", secret)
    .filter(review => review.reviewedAt <= now && review.expiresAt > now).flatMap(review => review.files.map(file => ({ id: review.id, ...file, expiresAt: review.expiresAt })));
}
export function containsKnownSourceValue(value: string, secrets: readonly string[] = []): boolean {
  return secrets.some(secret => secret.length >= 4 && [secret, JSON.stringify(secret).slice(1, -1), encodeURIComponent(secret.toWellFormed())].some(part => value.includes(part)));
}
