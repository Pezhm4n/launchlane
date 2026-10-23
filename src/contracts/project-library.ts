import { agentStates, type AgentState } from "./agent.ts";
import { ensure } from "../server/errors.ts";
import { hash, integer, object, string } from "./validation.ts";

export type ProjectSummary = { id: string; name: string; source: string; runtime: string; updatedAt: number; active: boolean;
  state: AgentState | "ready" | "incomplete" | "stale" | "unavailable"; app: string | null; runId: string | null; sourceHash: string; removal: "local" | "destination" | "blocked" };
const libraryStates = [...agentStates, "ready", "incomplete", "stale", "unavailable"] as const;
export function parseProjectLibrary(value: unknown): { projects: ProjectSummary[]; nextOffset: number | null } {
  const row = object(value);
  ensure(Array.isArray(row.projects) && row.projects.length <= 20, "INVALID_RESPONSE", "فهرست پروژه‌ها معتبر نیست.");
  const projects = row.projects.map((value): ProjectSummary => {
    const item = object(value), state = libraryStates.find(state => state === item.state);
    ensure(state && typeof item.active === "boolean" && (item.removal === "local" || item.removal === "destination" || item.removal === "blocked"), "INVALID_RESPONSE", "وضعیت پروژه معتبر نیست.");
    return { id: string(item.id, 36), name: string(item.name, 512), source: string(item.source, 128), runtime: string(item.runtime, 64),
      updatedAt: integer(item.updatedAt, 0, Number.MAX_SAFE_INTEGER), active: item.active, state, sourceHash: hash(item.sourceHash), removal: item.removal,
      app: item.app === null ? null : string(item.app, 63), runId: item.runId === null ? null : string(item.runId, 36) };
  });
  return { projects, nextOffset: row.nextOffset === null ? null : integer(row.nextOffset, 0, 1000000) };
}
