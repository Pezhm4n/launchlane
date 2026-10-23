import { object, string } from "./validation.ts";
export type AgentFailure = { code: string; message: string; nextStep: string };
export function failureNextStep(code: string): string {
  if (["LIARA_AUTH_REQUIRED", "LIARA_ACCESS_DENIED", "AUTH_REQUIRED", "PROVIDER_AUTH"].includes(code)) return "اتصال حساب و مجوز دسترسی را دوباره بررسی کنید؛ کد پروژه به این دلیل تغییر نمی‌کند.";
  if (code === "INSUFFICIENT_CREDIT") return "اعتبار حساب برای هزینهٔ انتخاب‌شده کافی نیست؛ انتشار پس از تأمین اعتبار ادامه می‌یابد.";
  if (code === "PROVIDER_PAYMENT_REQUIRED") return "وضعیت پرداخت و اعتبار همان سرویس را بررسی کنید؛ اصلاح کد این خطا را برطرف نمی‌کند و پرداخت خودکار انجام نمی‌شود.";
  if (code === "PROVIDER_CONFLICT") return "وضعیت همان منبع را دوباره بخوانید تا علت تعارض روشن شود؛ درخواست نوشتن خودکار تکرار نمی‌شود.";
  if (code === "PROVIDER_REQUEST_TOO_LARGE") return "حجم درخواست یا بستهٔ پروژه باید با سقف سرویس تطبیق داده شود؛ اگر بسته تغییر کند، نسخهٔ تازه باید دوباره بررسی و تأیید شود.";
  if (code === "PROVIDER_RATE_LIMIT") return "پس از زمان انتظار سرویس، وضعیت را دوباره بررسی کنید؛ اگر عملیات نوشتن شروع شده، ابتدا نتیجهٔ همان عملیات را بخوانید.";
  if (["PROVIDER_UNAVAILABLE", "PROVIDER_TRANSPORT", "MODEL_TRANSPORT"].includes(code)) return "ارتباط با سرویس کامل نشد؛ کد پروژه به این دلیل تغییر نمی‌کند. برای عملیات نوشتن، ابتدا نتیجهٔ ثبت‌شده بررسی می‌شود.";
  if (["BUILD_RUNTIME_UNSUPPORTED", "SANDBOX_RUNTIME_UNAVAILABLE", "SANDBOX_UNAVAILABLE"].includes(code)) return "محیط اجرای سازگار در Launchlane باید آماده شود؛ تکرار درخواست یا انتخاب حدسی نسخه، این مشکل را حل نمی‌کند.";
  if (["PROJECT_INCOMPLETE", "STATIC_BUILD_REQUIRED"].includes(code)) return "پروژه به آماده‌سازی بیشتری نیاز دارد؛ فایل‌های اصلی حفظ شده‌اند و نسخهٔ ناقص منتشر نمی‌شود.";
  if (["FOLDER_NOT_FOUND", "SOURCE_CHANGED", "PROJECT_CHANGED"].includes(code)) return "پوشه را دوباره انتخاب کنید. سابقه و مدیریت مقصد قبلی از «پروژه‌های من» در دسترس می‌مانند.";
  if (["UPSTREAM_UNCERTAIN", "UNRESOLVED_EFFECT", "CODEX_EXECUTION_UNCERTAIN"].includes(code)) return "پاسخ قطعی عملیات دریافت نشده؛ وضعیت همان عملیات باید بررسی شود تا انتشار یا هزینه تکرار نشود.";
  if (["MODEL_BUDGET", "BUDGET_EXHAUSTED", "AGENT_BUDGET"].includes(code)) return "سقف ثبت‌شدهٔ همین مأموریت تمام شده است؛ پیشرفت حفظ شد و مصرف تازه خودکار ایجاد نمی‌شود.";
  if (code === "AGENT_NO_PROGRESS") return "این اقدام بدون تغییر شواهد نتیجهٔ تازه‌ای نمی‌دهد؛ علت ثبت‌شده باید برطرف شود و همان مرحله تکرار نمی‌شود.";
  return "علت این مرحله ثبت شد؛ ادامه باید پس از بررسی همین علت باشد. نسخهٔ سالم تا اینجا تأیید نشده است.";
}
export function parseAgentFailure(value: unknown): AgentFailure {
  const row = object(value); return { code: string(row.code, 100), message: string(row.message, 6000), nextStep: string(row.nextStep, 1000) };
}
