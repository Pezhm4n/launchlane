import { isWorkloadDeploymentSpec, matchesWorkload } from "../../contracts/deployment.ts";
import { matchesFullstackApi } from "../../contracts/fullstack.ts";
import { actionPlatform } from "../../contracts/platform.ts";
import { assertObservableWorkloadValue, parsePublicationWorkloadRead, type PublicationWorkloadRead } from "../../contracts/publication-workload.ts";
import type { Config } from "../config.ts";
import { connectedLiaraConfig } from "../connections/liara.ts";
import { ensure } from "../errors.ts";
import { LiaraReadClient, type ReleasePage } from "../liara/client.ts";
import { WorkloadProbe, type ProbeResult, validateProbePath } from "../liara/probe.ts";
import type { Store } from "../persistence/store.ts";
import type { RunBudget } from "../policy/budget.ts";
import { parseProbeOrigins } from "../policy/probe-target.ts";
import { readArtifact } from "../workspace/archive.ts";
import { verifyHtmlAssets } from "./publication-assets.ts";

/** Read-only observations tied to an accepted publication, never a new approval or deployment observation. */
export async function readPublicationWorkload(config: Config, store: Store, actor: string,
  input: PublicationWorkloadRead & Readonly<{ path: string; assets: boolean }>, budget: RunBudget, signal: AbortSignal,
  dependencies: { read?: LiaraReadClient; probe?: WorkloadProbe; checkContext?: () => void } = {}) {
  const request = parsePublicationWorkloadRead({ publicationActionId: input.publicationActionId, checks: input.checks }), path = validateProbePath(input.path);
  const action = store.getAction(request.publicationActionId, actor);
  ensure(isWorkloadDeploymentSpec(action.spec), "PUBLICATION_WORKLOAD_UNSUPPORTED", "این انتشار قرارداد پاسخ قابل سنجش ندارد.", 409);
  const spec = action.spec, releaseId = action.remoteId;
  assertObservableWorkloadValue(spec.workload.assertion.kind === "text" ? spec.workload.assertion.contains : spec.workload.assertion.equals);
  ensure(action.attemptId && releaseId && action.deployment?.stage === "release_accepted" && action.deployment.sourceId &&
    ["observing", "succeeded", "failed", "uncertain"].includes(action.state) &&
    store.db.prepare("SELECT id FROM attempts WHERE id=? AND action_id=? AND remote_id=?").get(action.attemptId, action.id, releaseId),
    "PUBLICATION_RECEIPT_REQUIRED", "رسید همان source و release پذیرفته‌شده لازم است؛ پاسخ نامعلوم مجوز مشاهدهٔ نسخهٔ دیگری نیست.", 409);
  ensure(path === spec.workload.path, "PUBLICATION_WORKLOAD_CHANGED", "صفحهٔ اصلی باید همان معیار ثبت‌شدهٔ انتشار باشد؛ معیار قبلی تغییر نمی‌کند.", 409);
  const checkContext = () => {
    dependencies.checkContext?.();
    const connection = store.getConnection(actor, "liara")?.view;
    ensure(connection?.status === "connected" && connection.teamId === config.teamId && connection.identityId === spec.accountId &&
      connection.selectedApp === spec.scope.app && connection.teamId === spec.scope.teamId &&
      connection.apps.some(app => app.name === spec.scope.app && app.id === spec.targetAppId),
      "SCOPE_DENIED", "انتشار به حساب، تیم و برنامهٔ انتخاب‌شده تعلق ندارد.", 403);
    const origin = config.probeOrigins[spec.scope.app] || store.getProbeOrigin(actor, spec.scope.teamId, spec.scope.app);
    ensure(origin === spec.workload.origin, "PUBLICATION_ORIGIN_CHANGED", "نشانی مصوب همان انتشار تغییر کرده است؛ میزبان جایگزین بررسی نمی‌شود.", 409);
    ensure(config.enableLiveLiara, "LIVE_LIARA_DISABLED", "خواندن سرویس در این نصب خاموش است.", 403);
  };
  checkContext();
  // Archive + two identity/release fences + the original page + requested APIs.
  // Optional referenced assets spend additional reads; no new allowance is created.
  ensure(budget.maxToolCalls - budget.toolCalls >= 6 + request.checks.length, "BUDGET_EXHAUSTED", "بودجهٔ باقی‌مانده برای سنجش کامل این مسیرها کافی نیست؛ تعداد مسیرها را کمتر کنید.", 409);
  const scoped = connectedLiaraConfig(config, store, actor, spec.scope.app),
    probeConfig = { ...scoped, probeOrigins: parseProbeOrigins(JSON.stringify({ [spec.scope.app]: spec.workload.origin }), [spec.scope.app]) },
    read = dependencies.read ?? new LiaraReadClient(scoped), probe = dependencies.probe ?? new WorkloadProbe(probeConfig), startedAt = Date.now();
  const artifact = store.getArtifact(actor, spec.artifactHash);
  ensure(artifact.archiveHash === spec.artifactHash && artifact.sourceHash === spec.sourceHash, "PUBLICATION_ARTIFACT_CHANGED", "بستهٔ ذخیره‌شده با همان انتشار برابر نیست.", 409);
  budget.take("tool", signal); await readArtifact(config.stateDir, artifact); checkContext();
  const identity = async () => {
    checkContext(); const project = await read.project(spec.scope, budget, signal); checkContext();
    ensure(project.id === spec.targetAppId && project.platform === actionPlatform(spec), "SCOPE_DENIED", "هویت یا نوع برنامه هنگام بررسی تغییر کرده است.", 403);
  };
  const releases = async () => { checkContext(); const page = await read.releases(spec.scope, 1, 50, budget, signal); checkContext(); return page; };
  const current = (page: ReleasePage) => page.currentRelease === releaseId && page.releases.some(row => row.id === releaseId && row.state === "READY");
  const validateResponse = (response: ProbeResult, expectedPath: string) => {
    checkContext(); ensure(response.scope.teamId === spec.scope.teamId && response.scope.app === spec.scope.app && response.origin === spec.workload.origin &&
      response.path === expectedPath && response.observedAt >= startedAt && response.observedAt <= Date.now(),
      "EVIDENCE_MISMATCH", "پاسخ متعلق به همین مقصد، مسیر و دور بررسی نیست.", 409);
  };
  const base = { contract: "publication-routes-v1" as const, basis: "accepted_release_record" as const, actionId: action.id,
    projectId: spec.projectFlowId, sourceHash: spec.sourceHash, artifactHash: spec.artifactHash, releaseId,
    accountId: spec.accountId, appId: spec.targetAppId, scope: spec.scope, origin: spec.workload.origin, startedAt,
    archivedArtifactVerified: true, runtimeContent: "unverified" as const, runtimeConfiguration: "unverified" as const,
    publicationVerified: false, remoteChanges: false, trust: "untrusted_response" as const };
  await identity();
  const before = await releases();
  if (!current(before)) return { ...base, outcome: "inconclusive" as const, code: "PUBLICATION_RELEASE_NOT_CURRENT", observedAt: Date.now(),
    primary: null, routes: [], assets: null, requested: request.checks.length, matched: 0 };
  const response = input.assets ? await probe.checkDocument(spec.scope, path, budget, signal) : await probe.check(spec.scope, path, budget, signal, 65536);
  validateResponse(response, path);
  const primary = { path, status: response.status, matched: response.outcome === "response" && matchesWorkload(spec.workload, response.status, response.body), observedAt: response.observedAt };
  const assets = input.assets && primary.matched ? await verifyHtmlAssets({ origin: spec.workload.origin, documentPath: path,
    body: response.body, contentType: response.contentType, check: async assetPath => {
      checkContext(); const asset = await probe.checkAsset(spec.scope, assetPath, budget, signal); validateResponse(asset, assetPath); return asset;
    }, aborted: () => signal.aborted }) : null;
  const routes: { path: string; status: number; matched: boolean; assertions: number; observedAt: number }[] = [];
  for (const check of request.checks) {
    checkContext(); const result = await probe.check(spec.scope, check.path, budget, signal, 65536); validateResponse(result, check.path);
    const mime = result.contentType?.split(";")[0]?.trim().toLowerCase() ?? "";
    routes.push({ path: check.path, status: result.status, assertions: check.assertions.length, observedAt: result.observedAt,
      matched: result.outcome === "response" && /^application\/(?:json|[a-z0-9.+-]+\+json)$/.test(mime) && matchesFullstackApi(check, result.status, result.body) });
  }
  await identity(); const after = await releases();
  const matched = routes.filter(route => route.matched).length, stable = current(after), all = primary.matched && matched === request.checks.length && (!assets || assets.outcome === "verified");
  return { ...base, observedAt: Date.now(), primary, routes, assets, requested: request.checks.length, matched,
    outcome: !stable || assets?.outcome === "inconclusive" ? "inconclusive" as const : all ? "matched" as const : "mismatch" as const,
    code: !stable ? "PUBLICATION_RELEASE_CHANGED" : assets?.outcome === "inconclusive" ? "ASSET_VERIFICATION_UNAVAILABLE" : all ? "PUBLICATION_ROUTES_MATCHED" : "PUBLICATION_ROUTES_MISMATCH" };
}
