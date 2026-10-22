import type { Action } from "./domain.ts";
import type { EvidenceBundle } from "./incident.ts";
import type { IncidentRun } from "./incident-run.ts";
import { restartReadbackEvidence } from "./restart.ts";

export function latestIncidentEvidence(
  run: IncidentRun,
  actions: readonly Action[],
): EvidenceBundle {
  let latest = run.after ?? run.evidence;
  if (run.kind === "sample") return latest;
  const firstHttp = run.evidence.entries.find((row) => row.fact?.kind === "http");
  for (const action of actions) {
    if (
      action.spec.version !== 6 ||
      action.spec.incidentRunId !== run.id ||
      action.spec.targetAppId !== run.appId ||
      action.spec.scope.teamId !== run.evidence.scope.teamId ||
      action.spec.scope.app !== run.evidence.scope.app ||
      action.spec.target.path !== run.path ||
      (firstHttp?.fact?.kind === "http" && action.spec.target.origin !== firstHttp.fact.origin)
    )
      continue;
    const evidence = restartReadbackEvidence(action);
    if (evidence && evidence.collectedAt > latest.collectedAt) latest = evidence;
  }
  return latest;
}
