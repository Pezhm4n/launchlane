import { assertComponentJob } from "../policy/component-artifact.ts";
export { assertComponentJob } from "../policy/component-artifact.ts";
import { runInNewContext } from "node:vm";
import type { ProjectFlow } from "../../contracts/project-flow.ts";
import { parseCodeRepairJob } from "../../contracts/code-repair.ts";
import { type ComponentVerification } from "../../contracts/pnpm-component.ts";
import { object, string } from "../../contracts/validation.ts";
import { ensure } from "../errors.ts";
import type { Store } from "../persistence/store.ts";
import { readComponentOutput } from "../agent/build-output-store.ts";
import { readArtifact } from "../workspace/archive.ts";
import { matchesPublishedBuildEnvironment } from "../environment/build.ts";
import { frontendAssetProgram } from "../agent/container.ts";

export async function localComponentVerification(store: Store, stateDir: string, actor: string, flow: ProjectFlow) {
  const result = assertComponentJob(store, actor, flow);
  await readComponentOutput(stateDir, result.receipt, { sourceHash: result.verification.testedSourceHash, planHash: result.verification.planHash });
  ensure(flow.artifact, "COMPONENT_BUILD_REQUIRED", "artifact موجود نیست.", 409);
  await readArtifact(stateDir, store.getArtifact(actor, flow.artifact.archiveHash)); return result;
}
export async function componentVerification(store: Store, stateDir: string, actor: string, flow: ProjectFlow, secret: string) {
  const result = await localComponentVerification(store, stateDir, actor, flow);
  ensure(matchesPublishedBuildEnvironment({ sessionSecret: secret }, store, actor, flow.id, result.build), "COMPONENT_ENV_CHANGED", "تنظیمات نسخه با همان ساخت component برابر نیست.", 409);
  return result.verification;
}
export async function componentAssets(store: Store, stateDir: string, actor: string, verification: ComponentVerification, origin: string) {
  if (verification.component.kind !== "static") return [];
  const row = store.db.prepare("SELECT state,data_json FROM code_repair_jobs WHERE id=? AND actor_id=? AND state='succeeded'").get(verification.buildJobId, actor);
  ensure(row, "COMPONENT_BUILD_REQUIRED", "خروجی component موجود نیست.", 409);
  const job = parseCodeRepairJob({ ...object(object(JSON.parse(string(row.data_json, 1024 * 1024))).job), state: row.state }), receipt = job.afterTest?.buildOutput;
  ensure(receipt?.artifactHash === verification.outputArtifactHash, "BUILD_OUTPUT_BINDING_CHANGED", "خروجی متعلق به همین گواه نیست.", 409);
  const output = await readComponentOutput(stateDir, receipt, { sourceHash: verification.testedSourceHash, planHash: verification.planHash });
  const prefix = `${verification.component.root === "." ? "" : `${verification.component.root}/`}${verification.component.outputDirectory}/`;
  const html = output.contents.find(file => file.path === `${prefix}index.html`);
  ensure(html, "COMPONENT_INDEX_REQUIRED", "صفحهٔ compiled موجود نیست.", 409);
  const parsed = object(runInNewContext(`${frontendAssetProgram};frontendAssets(html)`, { Buffer, html: Buffer.from(html.base64, "base64").toString("utf8") }, { timeout: 100 }));
  ensure(Array.isArray(parsed.references) && parsed.references.length <= 32 && (parsed.base === null || typeof parsed.base === "string"), "COMPONENT_ASSET_INVALID", "مرجع فایل‌ها معتبر نیست.", 409);
  const base = new URL(parsed.base ?? "/", `${origin}/`);
  ensure(base.origin === origin, "BUILD_ASSET_TARGET_DENIED", "فایل مرورگر باید از همان مقصد باشد.", 409);
  return parsed.references.map((value): { path: string; sha256: string; kind: "script" | "style" } => {
    const ref = object(value), url = new URL(string(ref.path, 512), base);
    ensure(url.origin === origin && !url.search && !url.hash && /^\/[A-Za-z0-9_./-]+$/.test(url.pathname) && (ref.kind === "script" || ref.kind === "style"), "BUILD_ASSET_TARGET_DENIED", "مرجع مرورگر باید در همان خروجی compiled باشد.", 409);
    const file = output.entries.find(file => file.type === "file" && file.path === prefix + url.pathname.slice(1));
    ensure(file?.type === "file", "BUILD_ASSET_MISSING", "مرجع HTML در همان خروجی وجود ندارد.", 409);
    return { path: url.pathname, sha256: file.sha256, kind: ref.kind };
  });
}
