import type {
  Action,
  ActionSpec,
  ActionState,
  Capabilities,
  Capability,
  ProjectProfile,
  SourceArtifact,
  WorkspaceView,
} from "./domain.ts";
import { ensure } from "../server/errors.ts";
import { hash, integer, object, string } from "./validation.ts";
import { parseArtifact } from "./source.ts";
import { parseConnection } from "./connections.ts";
import { parseWorkloadContract, parseWorkloadExpectation, parseWorkloadTarget, parseDeploymentProgress } from "./deployment.ts";
import { parseRestartProgress } from "./restart.ts";
import { parseProvisionSpec, parseProvisionProgress } from "./provision.ts";
import { parseEnvironmentSpec, parseEnvironmentProgress, parseEnvironmentReference } from "./environment.ts";
import { parseNodeRuntime, parseNodeVersion } from "./node-runtime.ts";
import { sourceFileByteLimit, SOURCE_MAX_BYTES, SOURCE_MAX_FILES } from "./source-limits.ts";
import { parsePythonRuntime } from "./python-runtime.ts";
import { parseNetworkSpec, parseNetworkProgress } from "./network.ts";
import { parseLifecycleSpec, parseLifecycleProgress } from "./project-lifecycle.ts";
import { parseStaticRuntime } from "./static-runtime.ts";
import { parseNextRuntime } from "./next-runtime.ts";

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
  if (spec.version === 17) {
    const { runtime, environment, ...rest } = spec, parsed = parseNextRuntime(runtime), base = decodeAction({ ...raw, spec: { ...rest, version: 7 } });
    ensure(base.spec.version === 7 && typeof base.spec.sourceHash === "string" && base.spec.nodeVersion === parsed.version, "INVALID_RESPONSE", "نسخهٔ انتشار Next با پروژه برابر نیست.");
    return { ...base, spec: { ...base.spec, version: 17, operation: "deploy", sourceHash: base.spec.sourceHash, runtime: parsed, environment: environment === null ? null : parseEnvironmentReference(environment) } };
  }
  if (spec.version === 18) {
    const parsed = parseProvisionSpec(spec), { runtime: _runtime, ...rest } = spec;
    return { ...decodeAction({ ...raw, spec: { ...rest, version: 8 } }), spec: parsed };
  }
  if (spec.version === 15) {
    ensure(spec.nodeVersion === null, "INVALID_RESPONSE", "نسخه انتشار ایستا معتبر نیست.");
    const { runtime, ...rest } = spec, base = decodeAction({ ...raw, spec: { ...rest, version: 7, nodeVersion: "22" } });
    ensure(base.spec.version === 7 && typeof base.spec.sourceHash === "string" && base.spec.args.port === 80, "INVALID_RESPONSE", "پیشنهاد انتشار ایستا معتبر نیست.");
    return { ...base, spec: { ...base.spec, version: 15, operation: "deploy", sourceHash: base.spec.sourceHash, nodeVersion: null, runtime: parseStaticRuntime(runtime) } };
  }
  if (spec.version === 16) {
    const parsed = parseProvisionSpec(spec), { runtime: _runtime, ...rest } = spec;
    return { ...decodeAction({ ...raw, spec: { ...rest, version: 8, nodeVersion: "22" } }), spec: parsed };
  }
  if (spec.version === 11) {
    ensure(spec.nodeVersion === null, "INVALID_RESPONSE", "نسخه انتشار Python معتبر نیست.");
    const { runtime, environment, ...rest } = spec, base = decodeAction({ ...raw, spec: { ...rest, version: 7, nodeVersion: "22" } });
    ensure(base.spec.version === 7 && typeof base.spec.sourceHash === "string", "INVALID_RESPONSE", "پیشنهاد انتشار معتبر نیست.");
    return { ...base, spec: { ...base.spec, version: 11, operation: "deploy", sourceHash: base.spec.sourceHash, nodeVersion: null,
      runtime: parsePythonRuntime(runtime), environment: environment === null ? null : parseEnvironmentReference(environment) } };
  }
  if (spec.version === 12) {
    const parsed = parseProvisionSpec(spec), { runtime: _runtime, ...rest } = spec,
      base = decodeAction({ ...raw, spec: { ...rest, version: 8, nodeVersion: "22" } });
    return { ...base, spec: parsed };
  }
  if (spec.version === 10) {
    const { environment, ...rest } = spec, base = decodeAction({ ...raw, spec: { ...rest, version: 7 } });
    ensure(base.spec.version === 7 && typeof base.spec.sourceHash === "string", "INVALID_RESPONSE", "پیشنهاد انتشار معتبر نیست.");
    return { ...base, spec: { ...base.spec, version: 10, operation: "deploy", sourceHash: base.spec.sourceHash, environment: parseEnvironmentReference(environment) } };
  }
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
    state &&
      (spec.version === 1 || spec.version === 2 || spec.version === 3 || spec.version === 4 || spec.version === 5 || spec.version === 6 || spec.version === 7 || spec.version === 8 || spec.version === 9 || spec.version === 13 || spec.version === 14) &&
      (spec.operation === "deploy" || spec.operation === "restart" || (spec.version === 8 && spec.operation === "create_app") || (spec.version === 9 && spec.operation === "update_env") || (spec.version === 13 && spec.operation === "create_network") || (spec.version === 14 && (spec.operation === "stop_app" || spec.operation === "delete_app"))),
    "INVALID_RESPONSE",
    "ساختار اقدام معتبر نیست.",
  );
  let parsedSpec: ActionSpec;
  if (spec.version === 14) parsedSpec = parseLifecycleSpec(spec);
  else if (spec.version === 13) parsedSpec = parseNetworkSpec(spec);
  else if (spec.version === 9) parsedSpec = parseEnvironmentSpec(spec);
  else if (spec.version === 8) parsedSpec = parseProvisionSpec(spec);
  else {
    ensure(spec.operation === "deploy" || spec.operation === "restart", "INVALID_RESPONSE", "نوع اقدام معتبر نیست.");
    const common: Pick<Exclude<ActionSpec, {version: 8 | 9 | 12 | 13 | 14 | 16 | 18}>, "scope" | "operation" | "sourceHash" | "args"> = {
      operation: spec.operation,
      scope: { teamId: string(scope.teamId), app: string(scope.app) },
      sourceHash: nullableString(spec.sourceHash),
      args: {
        port: args.port === null ? null : integer(args.port, 1, 65535),
        planId: nullableString(args.planId),
      },
    };
    if (spec.version === 6) {
      ensure(spec.operation === "restart" && common.sourceHash === null && common.args.port === null && common.args.planId === null,
        "INVALID_RESPONSE", "ساختار پیشنهاد راه‌اندازی دوباره معتبر نیست.");
      parsedSpec = {
        ...common, version: 6, operation: "restart", sourceHash: null, args: { port: null, planId: null },
        accountId: string(spec.accountId, 128), targetAppId: string(spec.targetAppId, 128),
        targetPlanId: string(spec.targetPlanId, 128), targetReleaseId: string(spec.targetReleaseId, 128),
        incidentRunId: string(spec.incidentRunId, 36), evidenceHash: hash(spec.evidenceHash),
        target: parseWorkloadTarget(spec.target),
      };
    }
    else if (spec.version === 1) parsedSpec = { ...common, version: 1 };
    else if (spec.version === 4 || spec.version === 5 || spec.version === 7) {
      const deployment = {
        ...common,
        artifactHash: hash(spec.artifactHash),
        projectFlowId: string(spec.projectFlowId, 36),
        selectionHash: hash(spec.selectionHash),
        targetAppId: string(spec.targetAppId, 128),

      };
      parsedSpec = spec.version === 7
        ? { ...deployment, version: 7, accountId: string(spec.accountId, 128), nodeVersion: parseNodeVersion(spec.nodeVersion), workload: parseWorkloadContract(spec.workload) }
        : spec.version === 5
        ? { ...deployment, workload: parseWorkloadExpectation(spec.workload), version: 5, nodeVersion: parseNodeVersion(spec.nodeVersion) }
        : { ...deployment, workload: parseWorkloadExpectation(spec.workload), version: 4 };
    } else if (spec.version === 3) parsedSpec = {
      ...common, version: 3, artifactHash: hash(spec.artifactHash),
      projectFlowId: string(spec.projectFlowId, 36), selectionHash: hash(spec.selectionHash),
    };
    else parsedSpec = { ...common, version: 2, artifactHash: spec.artifactHash === null ? null : hash(spec.artifactHash) };
  }
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
    ...(raw.lifecycle === undefined ? {} : { lifecycle: parseLifecycleProgress(raw.lifecycle) }),
    ...(raw.deployment === undefined
      ? {}
      : { deployment: parseDeploymentProgress(raw.deployment) }),
    ...(raw.restart === undefined ? {} : { restart: parseRestartProgress(raw.restart) }),
    ...(raw.provision === undefined ? {} : { provision: parseProvisionProgress(raw.provision) }),
    ...(raw.environment === undefined ? {} : { environment: parseEnvironmentProgress(raw.environment) }),
    ...(raw.network === undefined ? {} : { network: parseNetworkProgress(raw.network) }),
  };
}
export function decodeArtifact(value: unknown): SourceArtifact {
  return parseArtifact(object(value).artifact);
}
export function decodeWorkspace(value: unknown): WorkspaceView {
  const raw = object(value),
    session = object(raw.session),
    caps = object(raw.capabilities),
    scope = object(caps.scope),
    connections = object(raw.connections),
    features = object(raw.features);
  ensure(
    typeof features.serviceReads === "boolean" &&
      typeof features.analysis === "boolean" &&
      typeof features.deployment === "boolean",
    "INVALID_RESPONSE",
    "وضعیت امکانات معتبر نیست.",
  );
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
    connections: {
      github: connections.github === null ? null : parseConnection(connections.github),
      liara: connections.liara === null ? null : parseConnection(connections.liara),
    },
    features: {
      serviceReads: features.serviceReads,
      analysis: features.analysis,
      deployment: features.deployment,
      probeApps: strings(features.probeApps),
      probeOrigin: features.probeOrigin === null ? null : string(features.probeOrigin, 512),
    },
  };
}
export function decodeProfile(value: unknown): ProjectProfile {
  const raw = object(object(value).profile);
  ensure(
    raw.runtime === "node" || raw.runtime === "python" || raw.runtime === "static" || raw.runtime === "unknown",
    "INVALID_RESPONSE",
    "runtime پاسخ معتبر نیست.",
  );
  ensure(
    Array.isArray(raw.manifest) && raw.manifest.length <= SOURCE_MAX_FILES,
    "INVALID_RESPONSE",
    "manifest پاسخ معتبر نیست.",
  );
  if (raw.runtime === "static") {
    parseStaticRuntime(raw.staticRuntime);
    ensure(raw.nodeVersion === null && raw.nodeRuntime === undefined && raw.pythonRuntime === undefined && raw.port === 80 && raw.start === "liara-static" && raw.build === null,
      "INVALID_RESPONSE", "اطلاعات اجرای سایت ایستا با قرارداد آن تطبیق ندارد.");
  }
  if (raw.nextRuntime !== undefined) {
    const next = parseNextRuntime(raw.nextRuntime);
    ensure(raw.runtime === "node" && parseNodeRuntime(raw.nodeRuntime).version === next.version && raw.pythonRuntime === undefined && raw.staticRuntime === undefined,
      "INVALID_RESPONSE", "نسخهٔ Next و محیط Node پاسخ با هم برابر نیستند.");
  }
  return {
    directory: string(raw.directory, 240),
    runtime: raw.runtime,
    nodeVersion: nullableString(raw.nodeVersion),
    ...(raw.nodeRuntime === undefined ? {} : { nodeRuntime: parseNodeRuntime(raw.nodeRuntime) }),
    ...(raw.pythonRuntime === undefined ? {} : { pythonRuntime: parsePythonRuntime(raw.pythonRuntime) }),
    ...(raw.staticRuntime === undefined ? {} : { staticRuntime: parseStaticRuntime(raw.staticRuntime) }),
    ...(raw.nextRuntime === undefined ? {} : { nextRuntime: parseNextRuntime(raw.nextRuntime) }),
    port: raw.port === null ? null : integer(raw.port, 1, 65535),
    start: nullableString(raw.start),
    build: nullableString(raw.build),
    envNames: strings(raw.envNames),
    missing: strings(raw.missing),
    manifest: raw.manifest.map((value: unknown) => {
      const entry = object(value);
      const path = string(entry.path, 512);
      return {
        path,
        bytes: integer(entry.bytes, 0, sourceFileByteLimit(path)),
        sha256: string(entry.sha256, 64),
      };
    }),
    sourceHash: string(raw.sourceHash, 64),
    totalBytes: integer(raw.totalBytes, 0, SOURCE_MAX_BYTES),
    excludedCount: integer(raw.excludedCount, 0, 5000),
    inspectedAt: string(raw.inspectedAt),
  };
}
