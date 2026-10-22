import { object } from "../contracts/validation.ts";

export class ClientError extends Error {
  readonly code: string;
  readonly requestId: string | null;
  readonly retryable: boolean;
  constructor(
    code: string,
    message: string,
    requestId: string | null = null,
    retryable = false,
  ) {
    super(message);
    this.code = code;
    this.requestId = requestId;
    this.retryable = retryable;
  }
}

export async function api<T>(
  path: string,
  decode: (value: unknown) => T,
  options: { body?: unknown; csrf?: string; method?: string; signal?: AbortSignal } = {},
): Promise<T> {
  const headers: Record<string, string> = {};
  if (options.body !== undefined) headers["Content-Type"] = "application/json";
  if (options.csrf) headers["X-CSRF-Token"] = options.csrf;
  const response = await fetch(path, {
    method: options.method || (options.body !== undefined ? "POST" : "GET"),
    credentials: "same-origin",
    cache: "no-store",
    headers,
    ...(options.body === undefined ? {} : { body: JSON.stringify(options.body) }),
    ...(options.signal ? { signal: options.signal } : {}),
  });
  const value: unknown = await response.json();
  if (!response.ok) {
    const error = object(object(value).error);
    throw new ClientError(
      typeof error.code === "string" ? error.code : "UNKNOWN",
      typeof error.message === "string" ? error.message : "درخواست کامل نشد.",
      typeof error.requestId === "string" ? error.requestId : null,
      error.retryable === true,
    );
  }
  return decode(value);
}
