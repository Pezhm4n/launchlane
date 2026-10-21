export class AppError extends Error {
  readonly code: string;
  readonly status: number;
  readonly retryable: boolean;

  constructor(code: string, message: string, status = 400, retryable = false) {
    super(message);
    this.name = "AppError";
    this.code = code;
    this.status = status;
    this.retryable = retryable;
  }
}

export function ensure(
  condition: unknown,
  code: string,
  message: string,
  status = 400,
): asserts condition {
  if (!condition) throw new AppError(code, message, status);
}
