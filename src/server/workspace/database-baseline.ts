import { createHash } from "node:crypto";
import { ensure } from "../errors.ts";
import { baselineSource } from "../agent/postgres-baseline.ts";

/** Split top-level SQL without treating COPY payload, strings or function bodies as schema. */
function dumpStatements(input: string): string[] {
  ensure(Buffer.byteLength(input) <= 8 * 1024 * 1024 && !input.includes("\0"), "DATABASE_DUMP_LIMIT", "فایل ساختار از سقف بررسی بیشتر است.", 413);
  const result: string[] = []; let i = 0, statement = "";
  while (i < input.length) {
    if (input.startsWith("--", i)) { const end = input.indexOf("\n", i + 2); i = end < 0 ? input.length : end + 1; statement += " "; continue; }
    if (input.startsWith("/*", i)) {
      let depth = 1; i += 2;
      while (i < input.length && depth) { if (input.startsWith("/*", i)) { depth++; i += 2; } else if (input.startsWith("*/", i)) { depth--; i += 2; } else i++; ensure(depth <= 16, "DATABASE_DUMP_INVALID", "عمق comment معتبر نیست.", 409); }
      ensure(depth === 0, "DATABASE_DUMP_INVALID", "comment فایل کامل نیست.", 409); statement += " "; continue;
    }
    if (input[i] === "\\" && !statement.trim()) {
      const end = input.indexOf("\n", i), line = input.slice(i, end < 0 ? input.length : end).trim();
      ensure(/^\\(?:un)?restrict [a-zA-Z0-9]+$/.test(line), "DATABASE_DUMP_COMMAND_DENIED", "فرمان اتصال یا اجرای psql وارد baseline نمی‌شود.", 409);
      i = end < 0 ? input.length : end + 1; continue;
    }
    const quote = input[i];
    if (quote === "'" || quote === '"') {
      const start = i++, escaped = quote === "'" && /(?:^|[^\w])E$/i.test(statement); let closed = false;
      while (i < input.length) { if (escaped && input[i] === "\\") i += 2; else if (input[i] === quote) { i++; if (input[i] === quote) i++; else { closed = true; break; } } else i++; }
      ensure(closed, "DATABASE_DUMP_INVALID", "رشتهٔ فایل کامل نیست.", 409); statement += input.slice(start, i); continue;
    }
    const dollar = input[i] === "$" ? /^\$(?:[a-zA-Z_][a-zA-Z0-9_]*)?\$/.exec(input.slice(i))?.[0] : undefined;
    if (dollar) { const end = input.indexOf(dollar, i + dollar.length); ensure(end >= 0, "DATABASE_DUMP_INVALID", "بدنهٔ تابع کامل نیست.", 409); statement += input.slice(i, end + dollar.length); i = end + dollar.length; continue; }
    if (input[i] === ";") {
      const sql = statement.trim(); statement = ""; i++;
      ensure(result.length < 10000 && sql.length <= 1024 * 1024, "DATABASE_DUMP_LIMIT", "فایل به بررسی بخش‌بندی‌شده نیاز دارد.", 413);
      if (/^COPY\s+[\s\S]+\sFROM\s+stdin$/i.test(sql)) {
        const end = /(?:^|\n)\\\.\r?(?:\n|$)/g; end.lastIndex = i; const marker = end.exec(input);
        ensure(marker, "DATABASE_DUMP_INVALID", "دادهٔ COPY کامل نیست.", 409); i = marker.index + marker[0].length;
      } else if (sql) result.push(sql);
      continue;
    }
    statement += input[i++];
    ensure(statement.length <= 1024 * 1024, "DATABASE_DUMP_LIMIT", "یک عبارت فایل از سقف بررسی بیشتر است.", 413);
  }
  ensure(!statement.trim(), "DATABASE_DUMP_INVALID", "آخرین عبارت SQL کامل نیست.", 409);
  return result;
}
export function extractDatabaseBaseline(input: string, tables: readonly string[]) {
  ensure(tables.length > 0 && tables.length <= 8 && new Set(tables).size === tables.length && tables.every(table => /^public\.[a-z_][a-z0-9_]{0,62}$/.test(table)),
    "DATABASE_BASELINE_TABLES_INVALID", "جدول‌های ساختار اولیه را مشخص کنید.", 409);
  const found = new Set<string>(), selected: string[] = [];
  for (const statement of dumpStatements(input)) {
    const create = /^CREATE TABLE(?: IF NOT EXISTS)?\s+(public\.[a-z_][a-z0-9_]*)\s*\(/i.exec(statement);
    const constraint = /^ALTER TABLE(?: ONLY)?\s+(public\.[a-z_][a-z0-9_]*)\s+ADD CONSTRAINT\s/i.exec(statement);
    const alter = /^ALTER TABLE(?: ONLY)?\s+(public\.[a-z_][a-z0-9_]*)\s+([\s\S]+)$/i.exec(statement);
    const index = /^CREATE(?: UNIQUE)? INDEX(?: IF NOT EXISTS)?\s+[a-z_][a-z0-9_.]*\s+ON\s+(?:ONLY\s+)?(public\.[a-z_][a-z0-9_]*)\b/i.exec(statement);
    const dependent = /\b(?:OWNED BY|ON|TO)\s+(public\.[a-z_][a-z0-9_]*)\b/i.exec(statement)?.[1]?.toLowerCase();
    if (dependent && tables.includes(dependent) && /^(?:ALTER SEQUENCE|CREATE(?: OR REPLACE)? (?:(?:CONSTRAINT )?TRIGGER|POLICY|RULE)|ALTER POLICY)\b/i.test(statement))
      ensure(false, "DATABASE_BASELINE_UNSUPPORTED", "وابستگی sequence، trigger یا policy به adapter صریح نیاز دارد؛ ساختار ناقص ذخیره نشد.", 409);
    const relation = (create?.[1] ?? constraint?.[1] ?? alter?.[1] ?? index?.[1])?.toLowerCase();
    if (!relation || !tables.includes(relation)) continue;
    if (alter && !constraint) {
      if (/^OWNER TO [a-z_][a-z0-9_]*$/i.test(alter[2] ?? "")) continue;
      ensure(false, "DATABASE_BASELINE_UNSUPPORTED", "تغییر ستون، default یا امنیت جدول انتخاب‌شده پشتیبانی نشده است؛ ساختار ناقص ذخیره نشد.", 409);
    }
    if (create) { ensure(!found.has(relation), "DATABASE_BASELINE_DUPLICATE", "تعریف تکراری جدول وارد نمی‌شود.", 409); found.add(relation); }
    selected.push(`${statement};`);
  }
  ensure(tables.every(table => found.has(table)), "DATABASE_BASELINE_MISSING", "تعریف کامل همهٔ جدول‌های انتخاب‌شده در فایل پیدا نشد.", 409);
  const sql = selected.join("\n"), content = Buffer.from(sql), sha256 = createHash("sha256").update(content).digest("hex");
  ensure(selected.length <= 256 && content.length <= 65536 && !/['$]/.test(sql), "DATABASE_BASELINE_UNSUPPORTED", "این ساختار به adapter دیگری نیاز دارد؛ مقدار پیش‌فرض یا دادهٔ رشته‌ای وارد نشد.", 409);
  baselineSource([{ path: "baseline.sql", content }], { files: [{ path: "baseline.sql", sha256 }], schemas: [], roles: [] });
  return { sql, sha256, tables: [...tables].sort(), statements: selected.length };
}

export function inspectDatabaseDump(input: string): readonly string[] {
  const tables = dumpStatements(input).flatMap(statement => {
    const match = /^CREATE TABLE(?: IF NOT EXISTS)?\s+(public\.[a-z_][a-z0-9_]*)\s*\(/i.exec(statement);
    return match?.[1] ? [match[1].toLowerCase()] : [];
  });
  ensure(tables.length > 0 && tables.length <= 64 && new Set(tables).size === tables.length, "DATABASE_DUMP_TABLES_INVALID", "فهرست جدول‌ها نامعتبر یا بیش از سقف بررسی است.", 409);
  return tables.sort();
}
