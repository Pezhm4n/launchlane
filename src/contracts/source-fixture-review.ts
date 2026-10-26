import { exactKeys, hash, integer, object, string } from "./validation.ts";
import { ensure } from "../server/errors.ts";

export function publicTestFixturePath(value: unknown): string {
  const path = string(value, 512);
  ensure(!/[\\:\0]/.test(path) && path.split("/").every(part => part && part !== "." && part !== "..") &&
    /\.(?:py|[cm]?[jt]sx?)$/.test(path) && /(?:^|\/)(?:tests?|testing|unit|__tests__)(?:\/|$)|\.(?:test|spec)\.[cm]?[jt]sx?$/.test(path),
    "SOURCE_REVIEW_SCOPE", "بازبینی دادهٔ ساختگی فقط برای فایل آزمون مشخص و داخل پروژه معتبر است.", 409);
  return path;
}
export type SourceFixtureReviewEvidence = Readonly<{ id: string; path: string; sha256: string; expiresAt: number }>;
export function parseSourceFixtureReviews(value: unknown): readonly SourceFixtureReviewEvidence[] {
  ensure(Array.isArray(value) && value.length <= 256, "SOURCE_REVIEW_INVALID", "شاهد بازبینی source معتبر نیست.", 409);
  return value.map(input => {
    const row = object(input); exactKeys(row, ["id", "path", "sha256", "expiresAt"]);
    const id = string(row.id, 36);
    ensure(/^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/.test(id), "SOURCE_REVIEW_INVALID", "شناسهٔ بازبینی معتبر نیست.", 409);
    return { id, path: publicTestFixturePath(row.path), sha256: hash(row.sha256), expiresAt: integer(row.expiresAt, 0, Number.MAX_SAFE_INTEGER) };
  });
}
