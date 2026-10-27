export type BuildFailureSignal = { code: string; message: string; nextCheck: string; entry: number };
const rules: readonly { code: string; pattern: RegExp; message: string; nextCheck: string }[] = [
  { code: "missing_start", pattern: /\bMissing script:\s*["']start["']/i, message: "فرمان شروع در گزارش پیدا نشده است.", nextCheck: "ریشهٔ انتخاب‌شده و scripts.start در package.json را بررسی کنید؛ فرمان درست باید از فایل اجرایی همان پروژه به دست آید." },
  { code: "lock_mismatch", pattern: /npm ci.*(?:package-lock\.json|npm-shrinkwrap\.json).*in sync/i, message: "گزارش از ناهماهنگی فایل قفل و تعریف وابستگی‌ها خبر می‌دهد.", nextCheck: "package.json و فایل قفل همان نسخه را با هم بررسی کنید؛ حذف فایل قفل یا نصب بدون قفل راه‌حل تأییدشده نیست." },
  { code: "dependency_resolution", pattern: /\bERESOLVE\b|unable to resolve dependency tree/i, message: "حل نسخه‌های وابستگی با تعارض روبه‌رو شده است.", nextCheck: "نسخه‌ها و peer dependency اعلام‌شده را بررسی کنید؛ استفادهٔ حدسی از force یا نادیده‌گرفتن تعارض، سازگاری را اثبات نمی‌کند." },
  { code: "python_distribution", pattern: /ERROR:\s*(?:No matching distribution found for|Could not find a version that satisfies the requirement)/i, message: "توزیع سازگار یکی از وابستگی‌های Python در گزارش پیدا نشده است.", nextCheck: "نام و نسخهٔ قفل‌شده، نسخهٔ Python و سازگاری wheel را بررسی کنید؛ نسخهٔ وابستگی خودکار تغییر نمی‌کند." },
  { code: "missing_module", pattern: /Cannot find (?:module|package)\s+["']|ModuleNotFoundError:\s*No module named/i, message: "گزارش، ماژول یا بسته‌ای را در محیط اجرا پیدا نکرده است.", nextCheck: "مسیر import، وابستگی‌های همان فایل قفل و محتوای نسخهٔ ساخته‌شده را بررسی کنید؛ این پیام به‌تنهایی مجوز افزودن بسته نیست." },
  { code: "typescript_error", pattern: /\berror TS\d{4}:/, message: "کامپایلر TypeScript خطا گزارش کرده است.", nextCheck: "فایل و شمارهٔ خط گزارش‌شده را در همان نسخه بررسی کنید؛ معیار آزمون یا بررسی نوع برای عبور از خطا حذف نمی‌شود." },
  { code: "registry_error", pattern: /\bnpm (?:ERR!|error)\s+(?:code\s+)?E(?:404|401|403)\b/i, message: "دریافت بسته از registry پذیرفته نشده است.", nextCheck: "نام و نسخهٔ دقیق بسته، نشانی registry و دسترسی همان منبع را بررسی کنید؛ از این پیام به‌تنهایی نبودن بسته یا خرابی کد نتیجه نمی‌شود." },
  { code: "offline_cache", pattern: /\bnpm (?:ERR!|error)\s+(?:code\s+)?ENOTCACHED\b/i, message: "بستهٔ لازم در کش آفلاین پیدا نشده است.", nextCheck: "کامل‌بودن کش همان فایل قفل را بررسی کنید؛ این شکست به‌تنهایی دلیل اصلاح سورس نیست." },
  { code: "network_error", pattern: /\bnpm (?:ERR!|error)\s+(?:code\s+)?(?:EAI_AGAIN|ENOTFOUND|ETIMEDOUT|ECONNRESET)\b/i, message: "گزارش از کامل‌نشدن ارتباط دریافت وابستگی خبر می‌دهد.", nextCheck: "ارتباط با registry و وضعیت محیط ساخت را بررسی کنید؛ کد پروژه و عملیات ابری به این دلیل خودکار تغییر یا تکرار نمی‌شوند." },
];
const ansi = new RegExp(`${String.fromCharCode(27)}\\[[0-?]*[ -/]*[@-~]`, "g");

/** Signature observations in supplied evidence; never a root-cause verdict or execution authority. */
export function buildFailureSignals(entries: readonly string[]): BuildFailureSignal[] {
  const found = new Map<string, BuildFailureSignal>();
  entries.forEach((entry, index) => {
    const clean = entry.replace(ansi, "");
    for (const rule of rules) if (!found.has(rule.code) && rule.pattern.test(clean))
      found.set(rule.code, { code: rule.code, message: rule.message, nextCheck: rule.nextCheck, entry: index + 1 });
  });
  return [...found.values()].slice(0, 3);
}
