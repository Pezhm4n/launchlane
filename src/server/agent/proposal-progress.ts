import type { ProjectProfile } from "../../contracts/domain.ts";
import type { ToolDefinition } from "./model.ts";
import type { AgentRecord } from "./store.ts";
import { separateApplicationRequirements } from "../policy/application-scope.ts";

function record(value: unknown): Record<string, unknown> | null {
  return value && typeof value === "object" && !Array.isArray(value) ? Object.fromEntries(Object.entries(value)) : null;
}

export function suggestedDestinationName(allowed: unknown, projectId: string | null): string | null {
  if (!projectId || !/^[a-f0-9-]{36}$/.test(projectId)) return null;
  if (allowed === null) return `launchlane-${projectId.slice(0, 8)}`;
  return Array.isArray(allowed) && allowed.length === 1 && typeof allowed[0] === "string" && /^[a-z0-9][a-z0-9-]{0,62}$/.test(allowed[0]) ? allowed[0] : null;
}

/** Only host-recorded tool results are evidence; user/model prose cannot supply them. */
function successfulReads(run: AgentRecord): Map<string, Record<string, unknown>> {
  const names = new Map<string, string>(), reads = new Map<string, Record<string, unknown>>();
  for (const message of run.messages) {
    if (message.role === "assistant") for (const call of message.tool_calls ?? []) names.set(call.id, call.function.name);
    if (message.role !== "tool") continue;
    const name = names.get(message.tool_call_id);if (!name) continue;
    try {
      const result = record(JSON.parse(message.content)), data = record(result?.data);
      if (result?.ok === true && data) reads.set(name, data);else reads.delete(name);
    } catch { reads.delete(name); }
  }
  return reads;
}

/** A completion gate, not a planner or an executor. The model still chooses typed
 * arguments and the proposal service revalidates price, identity and membership. */
type DestinationProposalHint = Readonly<{ tool: "propose_destination"; reason: string; refreshTools?: readonly string[]; suggestedApp?: string; networkId?: string }>;
export function requiredDestinationProposal(run: AgentRecord, profile: ProjectProfile | undefined, tools: readonly ToolDefinition[]): DestinationProposalHint | null {
  if (!run.mission || run.channel === "conversation" || run.context.target || !run.context.account || !profile || profile.runtime === "unknown" ||
    profile.sourceHash !== run.context.sourceHash || profile.missing.length || profile.applicationRequirements?.diagnostics.length || separateApplicationRequirements(profile).length ||
    profile.applicationRequirements && profile.applicationRequirements.sourceHash !== profile.sourceHash ||
    run.destination || run.network || run.disk || run.publication || run.repair && run.repair.state !== "succeeded" ||
    !tools.some(tool => tool.function.name === "propose_destination") ||
    run.messages.some(message => message.role === "assistant" && message.tool_calls?.some(call => call.function.name === "propose_destination"))) return null;
  const covered = new Set(profile.fullstack?.workerSqlite ? ["backend_api", "cloudflare_worker", "cloudflare_d1", "sqlite", "persistent_storage"] : ["backend_api"]);
  if (profile.applicationRequirements?.requirements.some(need => need.need !== "optional" && (!covered.has(need.kind) || need.consumerRoot !== "."))) return null;
  const reads = successfulReads(run), inspection = reads.get("inspect_project"), destination = reads.get("read_destination"), catalog = reads.get("read_catalog"), networks = reads.get("read_networks");
  if (!inspection || !destination || !catalog || !networks || inspection.state !== "ready" || inspection.archiveReady !== true || !Array.isArray(inspection.gaps) || inspection.gaps.length ||
    destination.state !== "connected" || destination.creationAvailable !== true || destination.selectedApp !== null) return null;
  // Old source reads had no explicit hash; they are reusable only at the unchanged mission root.
  if (inspection.sourceHash === undefined ? run.mission.sourceHash !== run.context.sourceHash : inspection.sourceHash !== run.context.sourceHash || inspection.projectId !== run.context.projectId) return null;
  const refreshTools = [...(["read_destination", "read_catalog", "read_networks"] as const)].filter(name => {
    const account = record(reads.get(name)?.account);
    return account?.accountId !== run.context.account?.accountId || account?.teamId !== run.context.account?.teamId;
  });
  if (refreshTools.length) return { tool: "propose_destination", refreshTools,
    reason: "These older account results lack the current account/team binding. Refresh the listed authorized reads before choosing a network or drafting the review card. Do not ask permission for these reads or permission to prepare a proposal. No read, suggestion or model message grants creation consent." };
  if (!Array.isArray(networks.networks) || networks.networks.length !== 1 || !Array.isArray(catalog.offers)) return null;
  const network = record(networks.networks[0]);
  if (typeof network?.id !== "string" || !/^[a-f0-9]{24}$/.test(network.id)) return null;
  const offers = catalog.offers.map(record).filter(offer => offer?.region === "iran" && typeof offer.hourlyHundredthsToman === "number" && Number.isSafeInteger(offer.hourlyHundredthsToman) && offer.hourlyHundredthsToman >= 0);
  if (!offers.some(offer => typeof catalog.balanceToman === "number" && offer && catalog.balanceToman >= Number(offer.hourlyHundredthsToman) / 100)) return null;
  const app = suggestedDestinationName(destination.allowedNewAppNames, run.projectId);if (!app) return null;
  return { tool: "propose_destination", suggestedApp: app, networkId: network.id,
    reason: "The source, account, an eligible catalog offer and the only network are known. Draft the exact review card; asking permission to draft it is not a user decision. The proposal service must fetch current cost and membership before a card can be approved. This hint grants no consent or execution authority." };
}
