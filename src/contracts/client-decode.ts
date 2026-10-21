import type {
  Action,
  ActionSpec,
  ActionState,
  Capabilities,
  Capability,
  ProjectProfile,
  WorkspaceView,
} from "./domain.ts";
import { ensure } from "../server/errors.ts";
import { integer, object, string } from "./validation.ts";

function nullableString(value: unknown, max = 256): string | null {
  return value === null ? null : string(value, max);
}
function strings(value: unknown): string[] {
  ensure(
    Array.isArray(value) && value.length <= 1000,
    "INVALID_RESPONSE",
    "ساختار پاسخ معتبر نیست.",
  );
  return value.map((part: unknown) => string(part, 512));
}
function capability(value: unknown): Capability {
  const raw = object(value);
  ensure(
    raw.state === "available" || raw.state === "unavailable" || raw.state === "unverified",
    "INVALID_RESPONSE",
    "وضعیت سرویس معتبر نیست.",
  );
  return {
    state: raw.state,
    reason: string(raw.reason, 1000),
    nextStep: string(raw.nextStep, 1000),
  };
}
export function decodeAction(value: unknown): Action {
  const raw = object(value),
    spec = object(raw.spec),
    scope = object(spec.scope),
    args = object(spec.args);
  const states: readonly ActionState[] = [
    "awaiting_approval",
    "approved",
    "cancelled",
    "expired",
    "executing",
    "observing",
    "uncertain",
    "succeeded",
    "failed",
  ];
  const state = states.find((state) => state === raw.state);
  ensure(
    state && spec.version === 1 && (spec.operation === "deploy" || spec.operation === "restart"),
    "INVALID_RESPONSE",
    "ساختار اقدام معتبر نیست.",
  );
  const parsedSpec: ActionSpec = {
    version: 1,
    operation: spec.operation,
    scope: { teamId: string(scope.teamId), app: string(scope.app) },
    sourceHash: nullableString(spec.sourceHash),
    args: {
      port: args.port === null ? null : integer(args.port, 1, 65535),
      planId: nullableString(args.planId),
    },
  };
  return {
    id: string(raw.id),
    actorId: string(raw.actorId),
    hash: string(raw.hash),
    spec: parsedSpec,
    state,
    createdAt: integer(raw.createdAt, 0, Number.MAX_SAFE_INTEGER),
    expiresAt: integer(raw.expiresAt, 0, Number.MAX_SAFE_INTEGER),
    attemptId: nullableString(raw.attemptId),
    remoteId: nullableString(raw.remoteId),
    errorCode: nullableString(raw.errorCode),
  };
}
export function decodeWorkspace(value: unknown): WorkspaceView {
  const raw = object(value),
    session = object(raw.session),
    caps = object(raw.capabilities),
    scope = object(caps.scope);
  ensure(
    caps.evidence === "local" && raw.storage === "available" && Array.isArray(raw.actions),
    "INVALID_RESPONSE",
    "پاسخ workspace معتبر نیست.",
  );
  const capabilities: Capabilities = {
    evidence: "local",
    workspace: capability(caps.workspace),
    liara: capability(caps.liara),
    model: capability(caps.model),
    mutations: capability(caps.mutations),
    scope: { teamId: nullableString(scope.teamId), apps: strings(scope.apps) },
  };
  return {
    session: {
      csrfToken: string(session.csrfToken),
      expiresAt: integer(session.expiresAt, 0, Number.MAX_SAFE_INTEGER),
    },
    capabilities,
    storage: "available",
    actions: raw.actions.map(decodeAction),
  };
}
export function decodeProfile(value: unknown): ProjectProfile {
  const raw = object(object(value).profile);
  ensure(
    raw.runtime === "node" || raw.runtime === "unknown",
    "INVALID_RESPONSE",
    "runtime پاسخ معتبر نیست.",
  );
  ensure(
    Array.isArray(raw.manifest) && raw.manifest.length <= 1000,
    "INVALID_RESPONSE",
    "manifest پاسخ معتبر نیست.",
  );
  return {
    directory: string(raw.directory),
    runtime: raw.runtime,
    nodeVersion: nullableString(raw.nodeVersion),
    port: raw.port === null ? null : integer(raw.port, 1, 65535),
    start: nullableString(raw.start),
    build: nullableString(raw.build),
    envNames: strings(raw.envNames),
    missing: strings(raw.missing),
    manifest: raw.manifest.map((value: unknown) => {
      const entry = object(value);
      return {
        path: string(entry.path, 512),
        bytes: integer(entry.bytes, 0, 512 * 1024),
        sha256: string(entry.sha256, 64),
      };
    }),
    sourceHash: string(raw.sourceHash, 64),
    totalBytes: integer(raw.totalBytes, 0, 20 * 1024 * 1024),
    excludedCount: integer(raw.excludedCount, 0, 5000),
    inspectedAt: string(raw.inspectedAt),
  };
}
