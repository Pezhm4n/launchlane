import { ensure } from "../server/errors.ts";

export function object(value: unknown): Record<string, unknown> {
  ensure(
    typeof value === "object" && value !== null && !Array.isArray(value),
    "INVALID_INPUT",
    "ساختار ورودی معتبر نیست.",
  );
  return value as Record<string, unknown>;
}

export function exactKeys(value: Record<string, unknown>, keys: readonly string[]): void {
  ensure(
    Object.keys(value).every((key) => keys.includes(key)),
    "INVALID_INPUT",
    "ورودی دارای فیلد ناشناخته است.",
  );
}

export function string(value: unknown, max = 200): string {
  ensure(
    typeof value === "string" && value.length > 0 && value.length <= max && !hasControl(value),
    "INVALID_INPUT",
    "متن ورودی معتبر نیست.",
  );
  return value;
}

export function hasControl(value: string): boolean {
  return Array.from(value).some((character) => {
    const code = character.charCodeAt(0);
    return code < 32 || code === 127;
  });
}

export function text(value: unknown, max = 16_384): string {
  ensure(
    typeof value === "string" && value.length > 0 && value.length <= max,
    "INVALID_INPUT",
    "حجم متن معتبر نیست.",
  );
  ensure(
    !hasControl(value.replaceAll("\n", "").replaceAll("\r", "").replaceAll("\t", "")),
    "INVALID_INPUT",
    "متن دارای نویسه کنترلی نامعتبر است.",
  );
  return value;
}

export function identifier(value: unknown): string {
  const result = string(value, 63);
  ensure(/^[a-zA-Z0-9][a-zA-Z0-9_-]*$/.test(result), "INVALID_INPUT", "شناسه معتبر نیست.");
  return result;
}

export function hash(value: unknown): string {
  const result = string(value, 64);
  ensure(/^[a-f0-9]{64}$/.test(result), "INVALID_INPUT", "اثر انگشت ورودی معتبر نیست.");
  return result;
}

export function integer(value: unknown, min: number, max: number): number {
  ensure(
    typeof value === "number" && Number.isSafeInteger(value) && value >= min && value <= max,
    "INVALID_INPUT",
    "مقدار عددی خارج از محدوده است.",
  );
  return value;
}
