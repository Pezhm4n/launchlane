import type { DeploymentAssets, DeploymentAssetFailure } from "../../contracts/deployment.ts";
import { htmlAssetReferences } from "../../contracts/html-assets.ts";
import { AppError } from "../errors.ts";
import type { ProbeResult } from "../liara/probe.ts";

export function isHtmlDocument(contentType: string | null | undefined): boolean {
  const mime = (contentType ?? "").split(";")[0]?.trim().toLowerCase();
  return mime === "text/html" || mime === "application/xhtml+xml";
}

/**
 * Prove that the bounded same-origin scripts and stylesheets referenced by an accepted
 * HTML document resolve. This is not a browser run: it cannot prove JavaScript executed,
 * nor a route rendered. A missing/failed asset still invalidates the publication outcome,
 * while an unreadable asset leaves the outcome inconclusive instead of healthy.
 */
export async function verifyHtmlAssets(input: {
  origin: string;
  documentPath: string;
  body: string;
  contentType: string | null | undefined;
  check: (path: string) => Promise<ProbeResult>;
  aborted: () => boolean;
}): Promise<DeploymentAssets | null> {
  if (!isHtmlDocument(input.contentType) || !input.body) return null;
  const plan = htmlAssetReferences(input.body, input.documentPath, input.origin);
  if (plan.references.length === 0 && plan.blocked.length === 0) return null;
  const failures: DeploymentAssetFailure[] = plan.blocked.map((asset) => ({ path: asset.path, reason: "insecure" }));
  let checked = 0, unavailable = false;
  for (const reference of plan.references) {
    if (input.aborted()) throw new AppError("CANCELLED", "بررسی فایل‌های صفحه لغو شد.", 409);
    try {
      const asset = await input.check(reference.path);
      checked++;
      if (asset.outcome !== "response" || asset.status !== 200) failures.push({ path: reference.path, reason: "status" });
      else if (isHtmlDocument(asset.contentType)) failures.push({ path: reference.path, reason: "html_fallback" });
    } catch (error) {
      if (error instanceof AppError && error.code === "CANCELLED") throw error;
      if (error instanceof AppError && ["BUDGET_EXHAUSTED", "PROBE_TIMEOUT", "PROBE_TRANSPORT", "PROBE_LIMIT"].includes(error.code)) {
        unavailable = true;
        break;
      }
      throw error;
    }
  }
  return {
    outcome: failures.length > 0 ? "failed" : unavailable ? "inconclusive" : "verified",
    checked,
    external: plan.external,
    omitted: plan.omitted,
    failures,
  };
}
