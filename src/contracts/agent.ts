import { ensure } from "../server/errors.ts";
import { integer, object, string, text } from "./validation.ts";
import { parseCodeRepairJob, type CodeRepairJob } from "./code-repair.ts";
import { decodeAction } from "./client-decode.ts";
import type { Action } from "./domain.ts";
import { parsePublicationMission, type PublicationMission } from "./publication-mission.ts";
import { parseMissionAuthority, type MissionAuthority } from "./mission-authority.ts";
import { parseDestinationRecommendation, type DestinationRecommendation } from "./destination-recommendation.ts";
import { parseAgentFailure, type AgentFailure } from "./agent-failure.ts";
import { isProvisionSpec } from "./provision.ts";

export const agentStates = [
  "queued",
  "working",
  "needs_input",
  "needs_approval",
  "partially_completed",
  "completed",
  "failed",
  "cancelled",
  "interrupted",
] as const;
export type AgentState = (typeof agentStates)[number];
export const nextActions = [
  "choose_project",
  "connect_account",
  "select_app",
  "review_project",
  "configure_env",
  "reply",
] as const;
export type NextAction = (typeof nextActions)[number];
export type AgentEvent = {
  sequence: number;
  kind: "user" | "activity" | "tool" | "assistant" | "error" | "state";
  message: string;
  at: number;
  tool?: string;
  callId?: string;
  outcome?: "succeeded" | "failed";
  failure?: AgentFailure;
  notice?: string;
};
export type AgentView = {
  id: string;
  revision: number;
  projectId: string | null;
  state: AgentState;
  events: AgentEvent[];
  nextAction: NextAction | null;
  question: string | null;
  updatedAt: number;
  // A host-owned statement. Model prose is never an execution receipt.
  effect: "no_remote_changes" | "network_created" | "destination_created" | "configuration_changed" | "disk_created" | "remote_changes_unverified" | "remote_changes_verified";
  repair: CodeRepairJob | null;
  publication: Action | null;
  destination: Action | null;
  destinationContinued: boolean;
  mission?: PublicationMission | null;
  channel?: "legacy" | "conversation";
  authority?: MissionAuthority | null;
  network?: Action | null;
  networkContinued?: boolean;
  disk?: Action | null;
  diskContinued?: boolean;
  destinationRecommendation?: DestinationRecommendation | null;
};
export function parseAgentView(value: unknown): AgentView {
  const row = object(value);
  ensure(row.destinationContinued === undefined || typeof row.destinationContinued === "boolean",
    "INVALID_RESPONSE", "رسید ادامه ساخت معتبر نیست.");
  ensure(row.networkContinued === undefined || typeof row.networkContinued === "boolean", "INVALID_RESPONSE", "رسید ادامه شبکه معتبر نیست.");
  ensure(row.diskContinued === undefined || typeof row.diskContinued === "boolean", "INVALID_RESPONSE", "رسید ادامه فضای پایدار معتبر نیست.");
  const state = agentStates.find((state) => state === row.state);
  const nextAction =
    row.nextAction === null ? null : nextActions.find((action) => action === row.nextAction);
  ensure(
    state && nextAction !== undefined && (row.effect === "no_remote_changes" || row.effect === "network_created" || row.effect === "destination_created" || row.effect === "configuration_changed" || row.effect === "disk_created" || row.effect === "remote_changes_unverified" || row.effect === "remote_changes_verified"),
    "INVALID_RESPONSE",
    "وضعیت دستیار معتبر نیست.",
  );
  ensure(
    Array.isArray(row.events) && row.events.length <= 160,
    "INVALID_RESPONSE",
    "رویدادهای دستیار معتبر نیستند.",
  );
  let previous = 0;
  const events = row.events.map((value): AgentEvent => {
    const event = object(value),
      sequence = integer(event.sequence, 1, 10000);
    ensure(sequence > previous, "INVALID_RESPONSE", "ترتیب رویدادها معتبر نیست.");
    previous = sequence;
    ensure(event.outcome === undefined || event.outcome === "succeeded" || event.outcome === "failed", "INVALID_RESPONSE", "نتیجه مرحله معتبر نیست.");
    const kind = event.kind;
    ensure(
      kind === "user" ||
        kind === "activity" ||
        kind === "tool" ||
        kind === "assistant" ||
        kind === "error" ||
        kind === "state",
      "INVALID_RESPONSE",
      "نوع رویداد معتبر نیست.",
    );
    return {
      sequence,
      kind,
      message: text(event.message, 6000),
      at: integer(event.at, 0, Number.MAX_SAFE_INTEGER),
      ...(event.tool === undefined ? {} : { tool: string(event.tool, 80) }),
      ...(event.callId === undefined ? {} : { callId: string(event.callId, 80) }),
      ...(event.outcome === undefined ? {} : { outcome: event.outcome }),
      ...(event.failure === undefined ? {} : { failure: parseAgentFailure(event.failure) }),
      ...(event.notice === undefined ? {} : { notice: string(event.notice, 1000) }),
    };
  });
  const destination = row.destination === null || row.destination === undefined ? null : decodeAction(row.destination);
  ensure(!destination || isProvisionSpec(destination.spec), "INVALID_RESPONSE", "رسید مقصد با قرارداد ساخت تطبیق ندارد.");
  const network = row.network === null || row.network === undefined ? null : decodeAction(row.network);
  const disk = row.disk === null || row.disk === undefined ? null : decodeAction(row.disk);
  ensure(!disk || disk.spec.version === 25 && disk.spec.agentRunId === row.id, "INVALID_RESPONSE", "رسید فضای پایدار متعلق به همین مأموریت نیست.");
  const destinationRecommendation = row.destinationRecommendation === null || row.destinationRecommendation === undefined ? null : parseDestinationRecommendation(row.destinationRecommendation);
  const destinationSpec = destination?.spec;
  ensure(!destinationRecommendation || destinationSpec && isProvisionSpec(destinationSpec) &&
    destinationRecommendation.projectId === destinationSpec.projectFlowId && destinationRecommendation.sourceHash === destinationSpec.sourceHash &&
    destinationRecommendation.catalogFingerprint === destinationSpec.cost.catalogFingerprint && destinationRecommendation.offers.some(offer =>
      offer.planId === destinationSpec.args.planId && offer.bundleId === destinationSpec.bundleId && offer.hourlyHundredthsToman === destinationSpec.cost.hourlyHundredthsToman),
    "INVALID_RESPONSE", "پیشنهاد پلن به همان پروژه، مقصد و قیمت تعلق ندارد.", 502);
  ensure(!network || network.spec.version === 13, "INVALID_RESPONSE", "رسید شبکه معتبر نیست.");
  return {
    id: string(row.id, 36),
    revision: integer(row.revision, 1, 10000),
    projectId: row.projectId === null ? null : string(row.projectId, 36),
    state,
    events,
    nextAction,
    question: row.question === null ? null : text(row.question, 2000),
    updatedAt: integer(row.updatedAt, 0, Number.MAX_SAFE_INTEGER),
    effect: row.effect,
    repair: row.repair === null || row.repair === undefined ? null : parseCodeRepairJob(row.repair),
    publication: row.publication === null || row.publication === undefined ? null : decodeAction(row.publication),
    destination,
    destinationContinued: row.destinationContinued === true,
    mission: row.mission === undefined || row.mission === null ? null : parsePublicationMission(row.mission),
    channel: row.channel === "conversation" ? "conversation" : "legacy",
    authority: row.authority === undefined || row.authority === null ? null : parseMissionAuthority(row.authority),
    network, networkContinued: row.networkContinued === true,
    disk, diskContinued: row.diskContinued === true,
    destinationRecommendation,
  };
}
