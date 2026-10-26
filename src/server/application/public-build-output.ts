import { runInNewContext } from "node:vm";
import type { FullstackVerification } from "../../contracts/fullstack.ts";
import { exactKeys, object, string } from "../../contracts/validation.ts";
import { ensure } from "../errors.ts";
import type { Store } from "../persistence/store.ts";
import { parseCodeRepairJob } from "../../contracts/code-repair.ts";
import { readBuildOutput } from "../agent/build-output-store.ts";
import { frontendAssetProgram } from "../agent/container.ts";

export async function publicBuildAssets(store: Store, stateDir: string, actor: string, verification: FullstackVerification, origin: string) {
  const row = store.db.prepare("SELECT state,data_json FROM code_repair_jobs WHERE actor_id=? AND id=? AND state='succeeded'").get(actor, verification.buildJobId);
  ensure(row, "FULLSTACK_BUILD_REQUIRED", "رسید خروجی همان نسخه موجود نیست.", 409);
  const job = parseCodeRepairJob({ ...object(object(JSON.parse(string(row.data_json, 1024 * 1024))).job), state: row.state }), receipt = job.afterTest?.buildOutput;
  ensure(receipt?.artifactHash === verification.outputArtifactHash && receipt.sourceHash === verification.testedSourceHash && receipt.planHash === verification.planHash,
    "BUILD_OUTPUT_BINDING_CHANGED", "خروجی مرورگر با همان ساخت مصوب برابر نیست.", 409);
  const output = await readBuildOutput(stateDir, receipt, { sourceHash: verification.testedSourceHash, planHash: verification.planHash });
  const html = output.files.find(file => file.path === "index.html")?.content.toString("utf8"); ensure(html, "BUILD_OUTPUT_INDEX_REQUIRED", "صفحهٔ ساخته‌شده موجود نیست.", 409);
  // Only the fixed host parser executes; HTML remains inert data in the context.
  const parsed = object(runInNewContext(`${frontendAssetProgram};frontendAssets(html)`, { Buffer, html }, { timeout: 100 }));
  exactKeys(parsed, ["base", "references"]);
  ensure((parsed.base === null || typeof parsed.base === "string") && Array.isArray(parsed.references) && parsed.references.length <= 32,
    "BUILD_ASSET_LIMIT", "مرجع فایل‌های ساخته‌شده از سقف بررسی بیشتر است.", 409);
  const base = new URL(parsed.base ?? "/", `${origin}/`), assets = new Map<string, { path: string; sha256: string; kind: "script" | "style" }>();
  ensure(base.origin === origin, "BUILD_ASSET_TARGET_DENIED", "میزبان خروجی ساخت باید همان مقصد مصوب باشد.", 409);
  for (const value of parsed.references) {
    const ref = object(value); exactKeys(ref, ["path", "kind"]);
    ensure(ref.kind === "script" || ref.kind === "style", "BUILD_ASSET_INVALID", "نوع فایل ساخته‌شده معتبر نیست.", 409);
    const url = new URL(string(ref.path, 512), base);
    ensure(url.origin === origin && !url.search && !url.hash && /^\/[A-Za-z0-9_./-]+$/.test(url.pathname), "BUILD_ASSET_TARGET_DENIED", "فایل خروجی باید مسیر مستقیم در همان مقصد داشته باشد.", 409);
    const file = output.manifest.find(file => file.path === url.pathname.slice(1));
    ensure(file, "BUILD_ASSET_MISSING", "مرجع HTML در خروجی همان ساخت وجود ندارد.", 409);
    assets.set(`${ref.kind}:${url.pathname}`, { path: url.pathname, sha256: file.sha256, kind: ref.kind });
  }
  return [...assets.values()];
}
export function publicAssetMime(kind: "script" | "style", value: string | null | undefined): boolean {
  const mime = (value ?? "").split(";")[0]?.trim().toLowerCase();
  return kind === "style" ? mime === "text/css" : ["application/javascript", "text/javascript", "application/ecmascript", "text/ecmascript"].includes(mime ?? "");
}
