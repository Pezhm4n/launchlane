import { applicationSourcePath } from "./application-requirements.ts";
import { exactKeys, hash, object, string, text } from "./validation.ts";
import { ensure } from "../server/errors.ts";

export type ImportedBaseline = Readonly<{ id: string; sha256: string; sql: string }>;
export type PostgresBootstrap = Readonly<{
  files: readonly Readonly<{ path: string; sha256: string }>[];
  imports?: readonly ImportedBaseline[];
  schemas: readonly string[];
  roles: readonly string[];
}>;
export function parsePostgresBootstrap(value: unknown): PostgresBootstrap {
  const row = object(value); exactKeys(row, ["files", "schemas", "roles", "imports"]);
  ensure(Array.isArray(row.files) && row.files.length <= 8 && Array.isArray(row.schemas) && row.schemas.length <= 8 &&
    Array.isArray(row.roles) && row.roles.length <= 8 && row.files.length + row.schemas.length + row.roles.length + (Array.isArray(row.imports) ? row.imports.length : 0) > 0,
    "DATABASE_BOOTSTRAP_INVALID", "فایل و پیش‌نیازهای baseline باید محدود و مشخص باشند.", 409);
  const names = (values: readonly unknown[]) => values.map(value => {
    const name = string(value, 32);
    ensure(/^[a-z][a-z0-9_]*$/.test(name) && !/^(?:pg_|launchlane|_launchlane|information_schema$|public$)/.test(name),
      "DATABASE_BOOTSTRAP_INVALID", "نام پیش‌نیاز به محیط مستقل همین آزمون محدود است.", 409);
    return name;
  }).sort();
  const files = row.files.map(value => { const file = object(value); exactKeys(file, ["path", "sha256"]);
    const path = applicationSourcePath(file.path); ensure(path.endsWith(".sql"), "DATABASE_BOOTSTRAP_INVALID", "baseline باید فایل SQL بررسی‌شده باشد.", 409);
    return { path, sha256: hash(file.sha256) };
  }), schemas = names(row.schemas), roles = names(row.roles);
  ensure(new Set(files.map(file => file.path)).size === files.length && new Set(schemas).size === schemas.length && new Set(roles).size === roles.length,
    "DATABASE_BOOTSTRAP_INVALID", "پیش‌نیاز تکراری مجاز نیست.", 409);
  const imports = row.imports === undefined ? undefined : (() => {
    ensure(Array.isArray(row.imports) && row.imports.length > 0 && row.imports.length <= 8, "DATABASE_BOOTSTRAP_INVALID", "ساختار واردشده معتبر نیست.", 409);
    let bytes = 0;
    return row.imports.map(value => { const item = object(value); exactKeys(item, ["id", "sha256", "sql"]);
      const id = string(item.id, 36), sql = text(item.sql, 65536); bytes += new TextEncoder().encode(sql).byteLength;
      ensure(/^[a-f0-9]{8}(?:-[a-f0-9]{4}){3}-[a-f0-9]{12}$/.test(id) && bytes <= 65536, "DATABASE_BOOTSTRAP_INVALID", "ساختار واردشده از سقف بررسی بیشتر است.", 409);
      return { id, sql, sha256: hash(item.sha256) };
    });
  })();
  ensure(!imports || new Set(imports.map(row => row.id)).size === imports.length, "DATABASE_BOOTSTRAP_INVALID", "ساختار واردشده تکراری است.", 409);
  return { files, schemas, roles, ...(imports ? { imports } : {}) };
}
