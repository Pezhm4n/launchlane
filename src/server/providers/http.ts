import { AppError, ensure } from "../errors.ts";

export type Transport = (url: string, init: RequestInit) => Promise<Response>;
export const transport: Transport = (url, init) => fetch(url, init);

export async function boundedJson(response: Response, maxBytes = 256 * 1024): Promise<unknown> {
  ensure(response.ok, "UPSTREAM_HTTP", "سرویس پاسخ موفق نداد.", 502);
  ensure(
    response.headers.get("content-type")?.includes("application/json"),
    "UPSTREAM_INVALID",
    "نوع پاسخ سرویس JSON نیست.",
    502,
  );
  ensure(
    Number(response.headers.get("content-length") || 0) <= maxBytes,
    "UPSTREAM_LIMIT",
    "پاسخ سرویس از سقف مجاز بزرگ‌تر است.",
    502,
  );
  const reader = response.body?.getReader();
  ensure(reader, "UPSTREAM_INVALID", "پاسخ سرویس خالی است.", 502);
  const chunks: Uint8Array[] = [];
  let bytes = 0;
  try {
    while (true) {
      const part = await reader.read();
      if (part.done) break;
      bytes += part.value.byteLength;
      ensure(bytes <= maxBytes, "UPSTREAM_LIMIT", "پاسخ سرویس از سقف مجاز بزرگ‌تر است.", 502);
      chunks.push(part.value);
    }
    try {
      return JSON.parse(Buffer.concat(chunks).toString("utf8"));
    } catch {
      throw new AppError("UPSTREAM_INVALID", "ساختار JSON سرویس معتبر نیست.", 502);
    }
  } finally {
    await reader.cancel().catch(() => undefined);
    reader.releaseLock();
  }
}

export function httpFailure(status: number): AppError {
  if (status === 400 || status === 422)
    return new AppError(
      "PROVIDER_REJECTED",
      "درخواست با مدل یا قرارداد فعال سرویس تطبیق ندارد؛ پارامترها باید بررسی شوند.",
      502,
    );
  if (status === 401 || status === 403)
    return new AppError(
      "PROVIDER_AUTH",
      "دسترسی سرویس پذیرفته نشد؛ credential و محدوده را بررسی کنید.",
      502,
    );
  if (status === 429)
    return new AppError(
      "PROVIDER_RATE_LIMIT",
      "سقف درخواست سرویس پر شده است؛ بعداً دوباره بررسی کنید.",
      503,
      true,
    );
  return new AppError(
    "PROVIDER_UNAVAILABLE",
    "سرویس خارجی در دسترس نیست؛ نتیجه‌ای تأیید نشد.",
    502,
    status >= 500,
  );
}
