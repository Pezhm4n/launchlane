import {
  parseDiagnosis,
  parseEvidenceBundle,
  type Diagnosis,
  type EvidenceBundle,
} from "./incident.ts";
import { integer, object, string, text } from "./validation.ts";
import { ensure } from "../server/errors.ts";
export const symptoms = ["unavailable", "errors", "slow", "other"] as const;
export type Symptom = (typeof symptoms)[number];
export type IncidentRun = {
  id: string;
  kind: "live" | "sample";
  appId: string | null;
  symptom: Symptom;
  problem: string;
  path: string;
  scenario: "configuration" | "contradictory" | "insufficient" | "latency" | null;
  evidence: EvidenceBundle;
  diagnosis: Diagnosis | null;
  analysis: "ready" | "pending" | "model" | "scripted" | "unavailable" | "failed";
  analysisMessage: string | null;
  after: EvidenceBundle | null;
  updatedAt: number;
};
export function parseIncidentRun(value: unknown): IncidentRun {
  const row = object(value),
    symptom = symptoms.find((item) => item === row.symptom);
  ensure(
    (row.kind === "live" || row.kind === "sample") && symptom,
    "INCIDENT_INVALID",
    "نوع بررسی مشکل معتبر نیست.",
  );
  ensure(
    row.analysis === "ready" ||
      row.analysis === "pending" ||
      row.analysis === "model" ||
      row.analysis === "scripted" ||
      row.analysis === "unavailable" ||
      row.analysis === "failed",
    "INCIDENT_INVALID",
    "وضعیت توضیح علت معتبر نیست.",
  );
  const evidence = parseEvidenceBundle(row.evidence);
  ensure(
    (row.kind === "sample") === (evidence.mode === "simulated"),
    "INCIDENT_INVALID",
    "نوع نتیجه با شواهد بررسی تطبیق ندارد.",
  );
  const scenario = row.scenario;
  ensure(
    scenario === null ||
      scenario === "configuration" ||
      scenario === "contradictory" ||
      scenario === "latency" ||
      scenario === "insufficient",
    "INCIDENT_INVALID",
    "سناریوی بررسی معتبر نیست.",
  );
  ensure(
    row.kind === "live"
      ? scenario === null
      : scenario === "configuration" || scenario === "contradictory" || scenario === "insufficient" || scenario === "latency",
    "INCIDENT_INVALID",
    "سناریوی نمونه معتبر نیست.",
  );
  const diagnosis = row.diagnosis === null ? null : object(row.diagnosis);
  const after = row.after === null ? null : parseEvidenceBundle(row.after);
  ensure(
    !after ||
      (after.mode === evidence.mode &&
        after.scope.teamId === evidence.scope.teamId &&
        after.scope.app === evidence.scope.app),
    "INCIDENT_INVALID",
    "بررسی تازه باید مربوط به همان برنامه باشد.",
  );
  return {
    id: string(row.id, 36),
    kind: row.kind,
    appId: row.appId === undefined || row.appId === null ? null : string(row.appId, 128),
    symptom,
    problem: row.problem === "" ? "" : text(row.problem, 1000),
    path: string(row.path, 200),
    scenario,
    evidence,
    diagnosis: diagnosis
      ? parseDiagnosis({ summary: diagnosis.summary, hypotheses: diagnosis.hypotheses }, evidence)
      : null,
    analysis: row.analysis,
    analysisMessage: row.analysisMessage === null ? null : string(row.analysisMessage, 1000),
    after,
    updatedAt: integer(row.updatedAt, 0, Number.MAX_SAFE_INTEGER),
  };
}
