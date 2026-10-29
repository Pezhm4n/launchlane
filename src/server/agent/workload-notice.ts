import type { AgentContext } from "./store.ts";

function record(value: unknown): value is Record<string, unknown> { return !!value && typeof value === "object" && !Array.isArray(value); }
/** Host-owned summary of the bounded read; model prose cannot set a deployment receipt. */
export function publicationWorkloadNotice(result: unknown, context: AgentContext): string | null {
  if (!record(result) || result.ok !== true || !record(result.data) || !context.target) return null;
  const data = result.data;
  if (data.contract !== "publication-routes-v1" || data.basis !== "accepted_release_record" || data.appId !== context.target.appId ||
    data.accountId !== context.target.accountId || !record(data.scope) || data.scope.app !== context.target.app || data.scope.teamId !== context.target.teamId ||
    data.publicationVerified !== false || data.remoteChanges !== false || data.runtimeContent !== "unverified") return null;
  if (data.outcome === "inconclusive") return "اتصال پاسخ‌ها به نسخهٔ جاری قطعی نشد؛ سلامت انتشار تأیید نمی‌شود و رسید خواندن حفظ شده است.";
  if (data.outcome === "mismatch") return "پاسخ صفحه یا معیار مسیرهای API با انتظار ثبت‌شده برابر نبود؛ خواندن شواهد تغییری در سرور یا تأیید انتشار ایجاد نکرد.";
  if (data.outcome !== "matched" || !Number.isInteger(data.requested) || Number(data.requested) < 1 || Number(data.requested) > 8 || data.matched !== data.requested) return null;
  return `معیار صفحهٔ مصوب و ${data.requested} مسیر API در این دور بررسی برقرار بود و نسخهٔ جاری در ابتدا و انتها مطابق رسید انتشار بود. محتوای اجرایی، تنظیمات، ماندگاری داده و رفتار مرورگر با این خواندن تأیید نمی‌شوند.`;
}
