import { createHash } from "node:crypto";
import type { PostgresBootstrap } from "../../contracts/postgres-bootstrap.ts";
import type { SourceFile } from "../workspace/inspect.ts";
import { ensure } from "../errors.ts";
import { migrationStatements } from "./postgres-migration-test.ts";

/** Baseline source has already passed the source credential fence. Only schema DDL reaches this adapter. */
export function baselineSource(files: readonly SourceFile[], setup: PostgresBootstrap): string {
  let bytes = 0;
  const imported = (setup.imports ?? []).map(row => ({ path: `baseline-${row.id}.sql`, content: Buffer.from(row.sql), sha256: row.sha256 }));
  const available = [...files, ...imported], expectedFiles = [...setup.files, ...imported.map(row => ({ path: row.path, sha256: row.sha256 }))];
  return expectedFiles.map(expected => {
    const file = available.find(file => file.path === expected.path);
    ensure(file && file.content.length <= 262144 && createHash("sha256").update(file.content).digest("hex") === expected.sha256,
      "DATABASE_BASELINE_CHANGED", "فایل baseline با source و تصمیم همین ساخت برابر نیست.", 409);
    bytes += file.content.length;
    ensure(bytes <= 524288, "DATABASE_BASELINE_LIMIT", "baseline از سقف بررسی بیشتر است.", 409);
    const source = file.content.toString("utf8"), statements = migrationStatements(source);
    ensure(statements.every(statement => /^(?:CREATE TABLE |CREATE (?:UNIQUE )?INDEX |CREATE SEQUENCE |ALTER TABLE .* ADD CONSTRAINT )/.test(statement) &&
      !/\b(?:SELECT|INSERT|UPDATE|DELETE|COPY|DO|CALL|EXECUTE|GRANT|REVOKE|ROLE|PROGRAM|SERVER|EXTENSION|TABLESPACE|AS|INHERITS)\b/.test(statement)),
      "DATABASE_BASELINE_DATA_DENIED", "baseline فقط ساختار محدود دارد؛ داده، کد اجرایی و دسترسی وارد نمی‌شود.", 409);
    return source;
  }).join("\n");
}
