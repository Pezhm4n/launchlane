import { createHash } from "node:crypto";
import type { ActionSpec, Scope } from "../../contracts/domain.ts";
import {
  exactKeys,
  hash,
  identifier,
  integer,
  object,
  string,
} from "../../contracts/validation.ts";
import { ensure } from "../errors.ts";

export function canonical(value: unknown): string {
  if (
    value === null ||
    typeof value === "string" ||
    typeof value === "boolean" ||
    typeof value === "number"
  )
    return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map(canonical).join(",")}]`;
  const record = object(value);
  return `{${Object.keys(record)
    .sort()
    .map((key) => `${JSON.stringify(key)}:${canonical(record[key])}`)
    .join(",")}}`;
}

export function fingerprint(value: unknown): string {
  return createHash("sha256").update(canonical(value)).digest("hex");
}

export function parseActionSpec(value: unknown): ActionSpec {
  const input = object(value);
  exactKeys(input, ["version", "scope", "operation", "sourceHash", "args"]);
  ensure(
    input.version === 1 && (input.operation === "deploy" || input.operation === "restart"),
    "INVALID_OPERATION",
    "عملیات پشتیبانی نمی‌شود.",
  );
  const scope = object(input.scope);
  exactKeys(scope, ["teamId", "app"]);
  const teamId = string(scope.teamId, 24);
  ensure(/^[a-f0-9]{24}$/.test(teamId), "INVALID_SCOPE", "تیم معتبر نیست.");
  const app = identifier(scope.app);
  ensure(/^[a-z0-9][a-z0-9-]{0,62}$/.test(app), "INVALID_SCOPE", "نام برنامه معتبر نیست.");
  const args = object(input.args);
  exactKeys(args, ["port", "planId"]);
  const port = args.port === null ? null : integer(args.port, 1, 65535);
  const planId = args.planId === null ? null : identifier(args.planId);
  const sourceHash = input.sourceHash === null ? null : hash(input.sourceHash);
  ensure(
    input.operation !== "deploy" || (sourceHash !== null && port !== null),
    "INVALID_INPUT",
    "انتشار به source و port مشخص نیاز دارد.",
  );
  ensure(
    input.operation !== "restart" || (sourceHash === null && port === null && planId === null),
    "INVALID_INPUT",
    "restart آرگومان انتشار نمی‌پذیرد.",
  );
  return {
    version: 1,
    scope: { teamId, app },
    operation: input.operation,
    sourceHash,
    args: { port, planId },
  };
}

export function authorizeScope(
  scope: Scope,
  allowed: { teamId: string; apps: readonly string[] },
): void {
  ensure(
    allowed.teamId && scope.teamId === allowed.teamId && allowed.apps.includes(scope.app),
    "SCOPE_DENIED",
    "این تیم یا برنامه در محدوده مجاز نیست.",
    403,
  );
}
