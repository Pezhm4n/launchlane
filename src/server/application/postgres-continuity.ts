import type { ServerComparison } from "../../contracts/database-data.ts";
import { exactKeys, hash, integer, object, string } from "../../contracts/validation.ts";
import { ensure } from "../errors.ts";

export type PrivateTargetSample = Readonly<{
  id: string; databaseId: string; started: number; sampled: number; cells: readonly string[];
}>;

export function previousTargetSamples(value: unknown): PrivateTargetSample[] | null {
  // Migration 22 originally stored just arrays of digests of JS-decoded JSON.
  // Those samples lack a server clock and can have lost numeric precision.
  if (Array.isArray(value)) return null;
  const envelope = object(value);
  exactKeys(envelope, ["version", "targets"]);
  ensure(envelope.version === 2 && Array.isArray(envelope.targets) && envelope.targets.length > 0 && envelope.targets.length <= 4,
    "DATABASE_DATA_BASELINE_INVALID", "ساختار شاهد خصوصی داده معتبر نیست.", 409);
  return envelope.targets.map(value => {
    const target = object(value);
    exactKeys(target, ["id", "databaseId", "started", "sampled", "cells"]);
    const sampled = integer(target.sampled, 1, Number.MAX_SAFE_INTEGER);
    ensure(Array.isArray(target.cells) && target.cells.length <= 8, "DATABASE_DATA_BASELINE_INVALID", "شاهد خصوصی داده معتبر نیست.", 409);
    return { id: string(target.id, 32), databaseId: string(target.databaseId, 24), sampled,
      started: integer(target.started, 1, sampled), cells: target.cells.map(value => hash(value)) };
  });
}

export function compareTargetSamples(current: PrivateTargetSample, prior: PrivateTargetSample) {
  ensure(current.id === prior.id && current.databaseId === prior.databaseId && current.cells.length > 0 && current.cells.length === prior.cells.length,
    "DATABASE_DATA_BASELINE_INVALID", "شاهد قبلی به همان منبع و معیارهای داده تعلق ندارد.", 409);
  const equal = current.cells.every((cell, i) => cell === prior.cells[i]);
  let serverComparison: ServerComparison = "inconclusive";
  if (current.sampled >= prior.sampled) {
    if (current.started === prior.started) serverComparison = "same_start";
    else if (current.started > prior.sampled) serverComparison = equal ? "retained_after_later_start" : "changed_after_later_start";
  }
  return { equal, serverComparison };
}
