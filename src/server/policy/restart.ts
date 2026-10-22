import type { IncidentRun } from "../../contracts/incident-run.ts";
import { fingerprint } from "./action.ts";

export function restartEvidenceHash(run: IncidentRun): string {
  // A new explanation alone does not change the observed problem. A recheck does.
  return fingerprint({ appId: run.appId, path: run.path, evidence: run.after ?? run.evidence });
}
