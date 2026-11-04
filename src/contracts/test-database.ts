import { exactKeys, object } from "./validation.ts";
import { ensure } from "../server/errors.ts";
import { isPublicClientEnvironmentKey } from "./environment.ts";
import { parsePostgresMigrationTest, type PostgresMigrationTest } from "./postgres-migration-test.ts";
import { parsePostgresMigrationRunner, parsePostgresRunnerTargets, type PostgresMigrationRunner, type PostgresRunnerTarget } from "./postgres-runner-test.ts";

export const postgresTestImage = "postgres:16-bookworm@sha256:e92e17ca202da4bb205f6f4a6c8cb30539edfbaa04987b506630f5d5851ff3c8";
type LegacyTestDatabase = Readonly<{
  version: 1; kind: "postgresql"; purpose: "compatibility_test";
  image: typeof postgresTestImage; environmentKeys: readonly string[]; requiredRelations: readonly string[];
}>;
type RunnerDatabase = Omit<LegacyTestDatabase, "version"> & Readonly<{ version: 3; runner: PostgresMigrationRunner; targets: readonly PostgresRunnerTarget[] }>;
export type DisposableTestDatabase = LegacyTestDatabase | (Omit<LegacyTestDatabase, "version"> & Readonly<{ version: 2; migration: PostgresMigrationTest }>) |
  RunnerDatabase | (Omit<RunnerDatabase, "version" | "purpose"> & Readonly<{ version: 4; purpose: "prepare_artifact" }>);
export function preparesDatabaseArtifact(plan: DisposableTestDatabase | undefined): boolean { return plan?.version === 4; }
export function isRunnerTestDatabase(plan: DisposableTestDatabase | undefined): plan is Extract<DisposableTestDatabase, { version: 3 | 4 }> { return plan?.version === 3 || plan?.version === 4; }
export function parseDisposableTestDatabase(value: unknown): DisposableTestDatabase {
  const row = object(value), runnerMode = row.version === 3 || row.version === 4;
  exactKeys(row,["version","kind","purpose","image","environmentKeys","requiredRelations", ...(row.version === 2 ? ["migration"] : runnerMode ? ["runner", "targets"] : [])]);
  ensure((row.version === 1 || row.version === 2 || runnerMode) && row.kind === "postgresql" && row.purpose === (row.version === 4 ? "prepare_artifact" : "compatibility_test") && row.image === postgresTestImage &&
    Array.isArray(row.environmentKeys) && row.environmentKeys.length > 0 && row.environmentKeys.length <= (runnerMode ? 16 : 8),
    "TEST_DATABASE_INVALID", "محیط داده باید PostgreSQL موقت و صرفاً برای آزمون سازگاری باشد.",409);
  const keys = row.environmentKeys.map(value => {
    ensure(typeof value === "string" && value.length <= 128 && !isPublicClientEnvironmentKey(value) && /^(?:DATABASE_URL|[A-Z][A-Z0-9_]*_(?:DB|DATABASE)_(?:URL|URI))$/.test(value),
      "TEST_DATABASE_INVALID", "فقط نام ورودی اتصال دیتابیس، بدون مقدار واقعی، مجاز است.",409);
    return value;
  });
  ensure(new Set(keys).size === keys.length,"TEST_DATABASE_INVALID","نام اتصال دیتابیس تکراری است.",409);
  ensure(Array.isArray(row.requiredRelations) && row.requiredRelations.length > 0 && row.requiredRelations.length <= (runnerMode ? 64 : 16) &&
    row.requiredRelations.every(value => typeof value === "string" && (runnerMode ? /^public\.[A-Za-z_][A-Za-z0-9_]{0,62}$/ : /^public\.[a-z_][a-z0-9_]{0,62}$/).test(value)) && new Set(row.requiredRelations).size === row.requiredRelations.length,
    "TEST_DATABASE_INVALID","جدول‌های لازم برای شروع آزمون باید مشخص، محدود و در schema عمومی دادهٔ ساختگی باشند.",409);
  const base = {kind:"postgresql",purpose:"compatibility_test",image:postgresTestImage,environmentKeys:[...keys].sort(),requiredRelations:[...row.requiredRelations].sort()} as const;
  if (row.version === 1) return {version:1,...base};
  if (runnerMode) {
    const targets = parsePostgresRunnerTargets(row.targets), runner = parsePostgresMigrationRunner(row.runner);
    ensure(JSON.stringify(base.environmentKeys) === JSON.stringify(targets.flatMap(target => target.environmentKeys).sort()) &&
      JSON.stringify(base.requiredRelations) === JSON.stringify([...new Set(targets.flatMap(target => target.requiredRelations))].sort()), "MIGRATION_TARGETS_INVALID", "خلاصهٔ اتصال و جدول‌ها باید دقیقاً از دیتابیس‌های مصوب بیاید.", 409);
    return row.version === 4 ? { ...base, version: 4, purpose: "prepare_artifact", runner, targets } : { version: 3, ...base, runner, targets };
  }
  const migration = parsePostgresMigrationTest(row.migration);
  ensure(migration.columns.every(column => base.requiredRelations.includes(column.relation)), "MIGRATION_ORACLE_INVALID", "ستون‌ها باید متعلق به جدول‌های مصوب آزمون باشند.", 409);
  return {version:2,...base,migration};
}
