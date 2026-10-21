import { randomUUID } from "node:crypto";
import type { Session } from "../contracts/domain.ts";
import type { Config } from "./config.ts";
import { AppError, ensure } from "./errors.ts";
import { getRuntime } from "./runtime.ts";
import type { Store } from "./persistence/store.ts";
import { checkRequest, requireSession } from "./policy/session.ts";

type Context = { config: Config; store: Store; session: Session; requestId: string };
const headers = {
  "Cache-Control": "no-store",
  "X-Content-Type-Options": "nosniff",
  "Referrer-Policy": "no-referrer",
};

export function reply(value: unknown, status = 200, extra: Record<string, string> = {}): Response {
  return Response.json(value, { status, headers: { ...headers, ...extra } });
}

export async function jsonBody(request: Request): Promise<unknown> {
  ensure(
    request.headers.get("content-type")?.split(";")[0] === "application/json",
    "INVALID_CONTENT_TYPE",
    "درخواست باید JSON باشد.",
    415,
  );
  ensure(
    Number(request.headers.get("content-length") || 0) <= 8192,
    "INPUT_LIMIT",
    "درخواست بیشتر از سقف مجاز است.",
    413,
  );
  const reader = request.body?.getReader();
  ensure(reader, "INVALID_INPUT", "بدنه درخواست خالی است.");
  const chunks: Uint8Array[] = [];
  let bytes = 0;
  try {
    while (true) {
      const result = await reader.read();
      if (result.done) break;
      bytes += result.value.byteLength;
      ensure(bytes <= 8192, "INPUT_LIMIT", "درخواست بیشتر از سقف مجاز است.", 413);
      chunks.push(result.value);
    }
    try {
      return JSON.parse(Buffer.concat(chunks).toString("utf8"));
    } catch {
      throw new AppError("INVALID_JSON", "JSON درخواست معتبر نیست.");
    }
  } finally {
    await reader.cancel().catch(() => undefined);
    reader.releaseLock();
  }
}

export async function endpoint(
  request: Request,
  write: boolean,
  handler: (context: Context) => Promise<Response> | Response,
): Promise<Response> {
  const requestId = randomUUID();
  try {
    const { config, store } = getRuntime();
    const session = requireSession(request, config, store, write);
    const response = await handler({ config, store, session, requestId });
    response.headers.set("X-Request-Id", requestId);
    return response;
  } catch (error) {
    return errorReply(error, requestId);
  }
}

export function errorReply(error: unknown, requestId = randomUUID()): Response {
  const typed =
    error instanceof AppError
      ? error
      : new AppError(
          "INTERNAL_UNAVAILABLE",
          "این مرحله به دلیل مشکل داخلی کامل نشد. دوباره تلاش کنید؛ اگر ادامه داشت، شناسه پیگیری را برای بررسی نگه دارید.",
          503,
        );
  // Never serialize an arbitrary provider/fs error, stack, input or environment value.
  return reply(
    { error: { code: typed.code, message: typed.message, retryable: typed.retryable, requestId } },
    typed.status,
    { "X-Request-Id": requestId },
  );
}

export function checkPublicSessionRequest(request: Request, config: Config): void {
  checkRequest(request, config, true);
}
