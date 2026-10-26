import { exactKeys, object } from "./validation.ts";
import { ensure } from "../server/errors.ts";
import { isPublicClientEnvironmentKey } from "./environment.ts";

export const postgresTestImage = "postgres:16-bookworm@sha256:e92e17ca202da4bb205f6f4a6c8cb30539edfbaa04987b506630f5d5851ff3c8";
export type DisposableTestDatabase = Readonly<{
  version: 1; kind: "postgresql"; purpose: "compatibility_test";
  image: typeof postgresTestImage; environmentKeys: readonly string[]; requiredRelations: readonly string[];
}>;
export function parseDisposableTestDatabase(value: unknown): DisposableTestDatabase {
  const row = object(value); exactKeys(row,["version","kind","purpose","image","environmentKeys","requiredRelations"]);
  ensure(row.version === 1 && row.kind === "postgresql" && row.purpose === "compatibility_test" && row.image === postgresTestImage &&
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
  return {version:1,kind:"postgresql",purpose:"compatibility_test",image:postgresTestImage,environmentKeys:[...keys].sort(),requiredRelations:[...row.requiredRelations].sort()};
}
