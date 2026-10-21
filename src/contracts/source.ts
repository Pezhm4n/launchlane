import type { SourceArtifact } from "./domain.ts";
import { hash, integer, object } from "./validation.ts";
import { ensure } from "../server/errors.ts";

export const MAX_ARCHIVE_BYTES = 24 * 1024 * 1024;

export function parseArtifact(value: unknown): SourceArtifact {
  const raw = object(value);
  ensure(raw.format === "tar.gz", "INVALID_ARTIFACT", "فرمت بسته source معتبر نیست.");
  return {
    format: "tar.gz",
    archiveHash: hash(raw.archiveHash),
    sourceHash: hash(raw.sourceHash),
    bytes: integer(raw.bytes, 1, MAX_ARCHIVE_BYTES),
    fileCount: integer(raw.fileCount, 1, 1000),
    createdAt: integer(raw.createdAt, 0, Number.MAX_SAFE_INTEGER),
  };
}
