import { AppError, ensure } from "../errors.ts";
import { setTimeout as delay } from "node:timers/promises";
import type { RunBudget } from "../policy/budget.ts";
import { Pool } from "undici";

export type Transport = (url: string, init: RequestInit) => Promise<Response>;
// Slow TLS handshakes were exhausting fetch's 10s connection limit before the run deadline.
const liaraPool = new Pool("https://api.liara.ir", {
  connections: 4,
  connectTimeout: 30_000,
  keepAliveTimeout: 30_000,
  keepAliveMaxTimeout: 60_000,
  allowH2: false,
});
export const transport: Transport = (url, init) => {
  const options: RequestInit & { dispatcher?: Pool } =
    new URL(url).origin === "https://api.liara.ir" ? { ...init, dispatcher: liaraPool } : init;
  return fetch(url, options);
};

export async function sendRead(
  send: Transport,
  url: string,
  init: RequestInit,
  budget: RunBudget,
  bounded: AbortSignal,
): Promise<Response> {
  ensure(init.method === "GET", "READ_METHOD_REQUIRED", "تکرار محدود فقط برای خواندن مجاز است.", 500);
  // Reuse the body's deadline signal so a sibling timeout cannot be mistaken for user cancellation.
  for (let attempt = 0; ; attempt++) {
    budget.take("tool", bounded);
    try {
      return await abortable(() => send(url, { ...init, signal: bounded }), bounded);
    } catch (error) {
      const cause = error instanceof TypeError ? error.cause : null;
      // A connect timeout has no HTTP response; one idempotent retry tolerates transient network loss.
      // HTTP failures, invalid payloads and possibly committed writes never enter this retry path.
      if (attempt !== 0 || bounded.aborted || typeof cause !== "object" || cause === null ||
        !("code" in cause) || cause.code !== "UND_ERR_CONNECT_TIMEOUT") throw error;
      await delay(250, undefined, { signal: bounded });
    }
  }
}

export async function abortable<T>(task: () => Promise<T>, signal: AbortSignal): Promise<T> {
  ensure(!signal.aborted, "CANCELLED", "مهلت درخواست پایان یافته است.", 409);
  let stop: () => void = () => undefined;
  const ended = new Promise<never>((_resolve, reject) => {
    stop = () => reject(new AppError("CANCELLED", "درخواست کامل نشد؛ نتیجه قطعی نداریم.", 409));
    signal.addEventListener("abort", stop, { once: true });
  });
  try {
    return await Promise.race([task(), ended]);
  } finally {
    signal.removeEventListener("abort", stop);
  }
}

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
      "درخواست با قرارداد فعال سرویس تطبیق ندارد؛ پارامترها باید بررسی شوند.",
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
