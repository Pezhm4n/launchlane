import { ensure } from "../server/errors.ts";
import { exactKeys, object } from "./validation.ts";

export const codexWorkerVersion = "codex-cli 0.163.0-alpha.11";
export const codexWorkerModel = "gpt-6.1-sol";
export type CodexAgentChoice = {
  kind: "codex";
  mode: "packet_only";
  version: typeof codexWorkerVersion;
  model: typeof codexWorkerModel;
  cost: "subscription_usage_unpriced";
  acknowledgeUnknownCost: true;
  fallbackBeforeDispatch: boolean;
};
export type CodingAgentChoice = { kind: "internal" } | CodexAgentChoice;
export function parseCodingAgentChoice(value: unknown): CodingAgentChoice {
  const row = object(value);
  if (row.kind === "internal") { exactKeys(row, ["kind"]); return { kind: "internal" }; }
  exactKeys(row, ["kind", "mode", "version", "model", "cost", "acknowledgeUnknownCost", "fallbackBeforeDispatch"]);
  ensure(row.kind === "codex" && row.mode === "packet_only" && row.version === codexWorkerVersion && row.model === codexWorkerModel &&
    row.cost === "subscription_usage_unpriced" && row.acknowledgeUnknownCost === true && typeof row.fallbackBeforeDispatch === "boolean",
    "CODING_AGENT_UNSUPPORTED", "عامل، نسخه یا پذیرش هزینه معتبر نیست؛ انتخاب و تصمیم روشن لازم است.", 409);
  return { kind: "codex", mode: "packet_only", version: codexWorkerVersion, model: codexWorkerModel,
    cost: "subscription_usage_unpriced", acknowledgeUnknownCost: true, fallbackBeforeDispatch: row.fallbackBeforeDispatch };
}
