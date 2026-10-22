import type { Action, ActionSpec } from "./domain.ts";
import { ensure } from "../server/errors.ts";
import { exactKeys, integer, object, string } from "./validation.ts";

export type RestartSpec = Extract<ActionSpec, { version: 6 }>;
export type RestartObservation = Readonly<{
  outcome: "responding" | "unhealthy" | "changed" | "inconclusive" | "not_started";
  code: string;
  checkedAt: number;
  status: number | null;
  releaseId: string | null;
}>;
export type RestartProgress = Readonly<{
  stage: "claimed" | "request_started" | "accepted";
  acceptedAt: number | null;
  observation: RestartObservation | null;
}>;

export function canReadRestartResult(action: Action): boolean {
  return (
    action.spec.version === 6 &&
    Boolean(action.restart) &&
    (["observing", "uncertain"].includes(action.state) ||
      (action.restart?.stage === "accepted" && ["succeeded", "failed"].includes(action.state)))
  );
}

export function parseRestartObservation(value: unknown): RestartObservation {
  const row = object(value);
  exactKeys(row, ["outcome", "code", "checkedAt", "status", "releaseId"]);
  ensure(
    row.outcome === "responding" ||
      row.outcome === "unhealthy" ||
      row.outcome === "changed" ||
      row.outcome === "inconclusive" ||
      row.outcome === "not_started",
    "INVALID_RESPONSE",
    "نتیجه بررسی راه‌اندازی دوباره معتبر نیست.",
  );
  return {
    outcome: row.outcome,
    code: string(row.code, 64),
    checkedAt: integer(row.checkedAt, 0, Number.MAX_SAFE_INTEGER),
    status: row.status === null ? null : integer(row.status, 100, 599),
    releaseId: row.releaseId === null ? null : string(row.releaseId, 128),
  };
}

export function parseRestartProgress(value: unknown): RestartProgress {
  const row = object(value);
  exactKeys(row, ["stage", "acceptedAt", "observation"]);
  ensure(
    row.stage === "claimed" || row.stage === "request_started" || row.stage === "accepted",
    "INVALID_RESPONSE",
    "مرحله راه‌اندازی دوباره معتبر نیست.",
  );
  const acceptedAt =
    row.acceptedAt === null ? null : integer(row.acceptedAt, 0, Number.MAX_SAFE_INTEGER);
  ensure(
    (row.stage === "accepted") === (acceptedAt !== null),
    "INVALID_RESPONSE",
    "رسید پذیرش با مرحله اجرا تطبیق ندارد.",
  );
  return {
    stage: row.stage,
    acceptedAt,
    observation: row.observation === null ? null : parseRestartObservation(row.observation),
  };
}
