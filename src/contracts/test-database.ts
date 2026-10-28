import { exactKeys, object } from "./validation.ts";
import { ensure } from "../server/errors.ts";
import { isPublicClientEnvironmentKey } from "./environment.ts";
import { parsePostgresMigrationTest, type PostgresMigrationTest } from "./postgres-migration-test.ts";

export const postgresTestImage = "postgres:16-bookworm@sha256:e92e17ca202da4bb205f6f4a6c8cb30539edfbaa04987b506630f5d5851ff3c8";
type LegacyTestDatabase = Readonly<{
  version: 1; kind: "postgresql"; purpose: "compatibility_test";
  image: typeof postgresTestImage; environmentKeys: readonly string[]; requiredRelations: readonly string[];
}>;
export type DisposableTestDatabase = LegacyTestDatabase | (Omit<LegacyTestDatabase, "version"> & Readonly<{ version: 2; migration: PostgresMigrationTest }>);
export function parseDisposableTestDatabase(value: unknown): DisposableTestDatabase {
  const row = object(value); exactKeys(row,["version","kind","purpose","image","environmentKeys","requiredRelations", ...(row.version === 2 ? ["migration"] : [])]);
  ensure((row.version === 1 || row.version === 2) && row.kind === "postgresql" && row.purpose === "compatibility_test" && row.image === postgresTestImage &&
    Array.isArray(row.environmentKeys) && row.environmentKeys.length > 0 && row.environmentKeys.length <= 8,
    "TEST_DATABASE_INVALID", "محیط داده باید PostgreSQL موقت و صرفاً برای آزمون سازگاری باشد.",409);
  const keys = row.environmentKeys.map(value => {
    ensure(typeof value === "string" && value.length <= 128 && !isPublicClientEnvironmentKey(value) && /^(?:DATABASE_URL|[A-Z][A-Z0-9_]*_(?:DB|DATABASE)_(?:URL|URI))$/.test(value),
      "TEST_DATABASE_INVALID", "فقط نام ورودی اتصال دیتابیس، بدون مقدار واقعی، مجاز است.",409);
    return value;
  });
  ensure(new Set(keys).size === keys.length,"TEST_DATABASE_INVALID","نام اتصال دیتابیس تکراری است.",409);
  ensure(Array.isArray(row.requiredRelations) && row.requiredRelations.length > 0 && row.requiredRelations.length <= 16 &&
    row.requiredRelations.every(value => typeof value === "string" && /^public\.[a-z_][a-z0-9_]{0,62}$/.test(value)) && new Set(row.requiredRelations).size === row.requiredRelations.length,
    "TEST_DATABASE_INVALID","جدول‌های لازم برای شروع آزمون باید مشخص، محدود و در schema عمومی دادهٔ ساختگی باشند.",409);
  const base = {kind:"postgresql",purpose:"compatibility_test",image:postgresTestImage,environmentKeys:[...keys].sort(),requiredRelations:[...row.requiredRelations].sort()} as const;
  if (row.version === 1) return {version:1,...base};
  const migration = parsePostgresMigrationTest(row.migration);
  ensure(migration.columns.every(column => base.requiredRelations.includes(column.relation)), "MIGRATION_ORACLE_INVALID", "ستون‌ها باید متعلق به جدول‌های مصوب آزمون باشند.", 409);
  return {version:2,...base,migration};
}
