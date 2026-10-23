import type { Action, ActionSpec, Scope, Session } from "../../contracts/domain.ts";
import type { Config } from "../config.ts";
import { AppError, ensure } from "../errors.ts";
import type { Store } from "../persistence/store.ts";
import { authorizeScope } from "../policy/action.ts";
import { readArtifact } from "../workspace/archive.ts";
import { validateProjectAction } from "./project-flows.ts";

export type MutationAdapter = {
  preflight?(signal: AbortSignal): Promise<void>;
  execute(
    action: Action,
    signal: AbortSignal,
    source: Buffer | null,
  ): Promise<{ remoteId: string } | { restartAccepted: true } | { networkAccepted: true }>;
};

export async function executeApproved(input: {
  store: Store;
  config: Config;
  session: Session;
  id: string;
  currentSpec: ActionSpec;
  adapter: MutationAdapter | null;
  signal: AbortSignal;
}): Promise<Action> {
  const { store, config, session, id, currentSpec, adapter, signal } = input;
  ensure(
    config.enableMutations,
    "MUTATIONS_DISABLED",
    "عملیات واقعی غیرفعال است؛ پس از آماده‌شدن دسترسی و بودجه، gate باید جداگانه فعال شود.",
    403,
  );
  authorizeScope(currentSpec.scope, config);
  ensure(
    adapter,
    "CAPABILITY_UNAVAILABLE",
    "adapter نوشتن هنوز به سرویس واقعی متصل و تأیید نشده است.",
    503,
  );
  ensure(!signal.aborted, "CANCELLED", "پیش از شروع اجرا لغو شد.", 409);
  let source: Buffer | null = null;
  if (currentSpec.operation === "deploy") {
    ensure(
      (currentSpec.version === 2 || currentSpec.version === 3 || currentSpec.version === 4 || currentSpec.version === 5 || (currentSpec.version === 7 || currentSpec.version === 10 || currentSpec.version === 11)) &&
        currentSpec.artifactHash,
      "ARTIFACT_REQUIRED",
      "این پیشنهاد به بسته source متصل نیست؛ پیشنهاد تازه بسازید.",
      409,
    );
    const artifact = store.getArtifact(session.actorId, currentSpec.artifactHash);
    ensure(
      artifact.sourceHash === currentSpec.sourceHash,
      "ARTIFACT_MISMATCH",
      "بسته به محتوای مورد تأیید تعلق ندارد.",
      409,
    );
    source = await readArtifact(config.stateDir, artifact);
    ensure(!signal.aborted, "CANCELLED", "پیش از شروع اجرا لغو شد.", 409);
  }
  await validateProjectAction(config, store, session.actorId, currentSpec, signal);
  if (adapter.preflight) await adapter.preflight(signal);
  ensure(!signal.aborted, "CANCELLED", "پیش از claim اجرا لغو شد.", 409);
  const action = store.claim(id, session.actorId, session.id, currentSpec);
  // The attempt is committed BEFORE entering the provider boundary. Never retry this write.
  try {
    const result = await adapter.execute(action, signal, source);
    if ("restartAccepted" in result) return store.acceptRestart(id, session.actorId);
    if ("networkAccepted" in result) return store.acceptNetwork(id, session.actorId);
    return store.receipt(id, session.actorId, result.remoteId);
  } catch {
    store.uncertain(id, session.actorId);
    throw new AppError(
      "UPSTREAM_UNCERTAIN",
      "پاسخ قطعی اجرا نداریم؛ پیش از هر اقدام دیگر، نتیجه باید از سرویس خوانده شود.",
      409,
    );
  }
}

export type Observation = {
  scope: Scope;
  remoteId: string | null;
  evidenceId: string;
  effect: "healthy" | "failed" | "not_applied" | "unknown";
};

export async function observeAction(
  store: Store,
  session: Session,
  id: string,
  readBack: (action: Action) => Promise<Observation>,
): Promise<Action> {
  const action = store.getAction(id, session.actorId);
  ensure(
    action.state === "observing" || action.state === "uncertain",
    "ACTION_CONFLICT",
    "این اقدام منتظر بررسی نتیجه نیست.",
    409,
  );
  const evidence = await readBack(action);
  ensure(
    evidence.scope.teamId === action.spec.scope.teamId &&
      evidence.scope.app === action.spec.scope.app &&
      evidence.evidenceId &&
      (!action.remoteId || evidence.remoteId === action.remoteId),
    "EVIDENCE_MISMATCH",
    "شاهد به همان تیم، برنامه یا release تعلق ندارد.",
    409,
  );
  // A lost response without correlation cannot establish successful deployment.
  ensure(
    evidence.effect !== "healthy" ||
      (action.remoteId !== null && evidence.remoteId === action.remoteId),
    "EVIDENCE_MISMATCH",
    "برای نتیجه موفق، release متناظر باید مشخص باشد.",
    409,
  );
  return store.finishObservation(id, session.actorId, evidence.effect);
}
