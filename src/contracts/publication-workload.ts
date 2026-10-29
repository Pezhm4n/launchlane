import { ensure } from "../server/errors.ts";
import { exactKeys, object, string } from "./validation.ts";
import { parseFullstackApiChecks, type FullstackApiCheck } from "./fullstack.ts";

export type PublicationWorkloadRead = Readonly<{
  publicationActionId: string; checks: readonly FullstackApiCheck[];
}>;
export function assertObservableWorkloadValue(value: unknown): void {
  ensure(typeof value !== "string" || !/\[REDACTED(?:_[A-Z_]+)?\]/i.test(value), "PUBLICATION_WORKLOAD_REDACTED",
    "نشانهٔ پوشاندن اطلاعات محرمانه، مقدار قابل سنجش برنامه نیست؛ معیار عمومی و مشخص لازم است.", 409);
}
export function parsePublicationWorkloadRead(value: unknown): PublicationWorkloadRead {
  const row = object(value); exactKeys(row, ["publicationActionId", "checks"]);
  const publicationActionId = string(row.publicationActionId, 36), checks = parseFullstackApiChecks(row.checks);
  ensure(/^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/.test(publicationActionId) && new Set(checks.map(check => check.path)).size === checks.length,
    "PUBLICATION_WORKLOAD_INVALID", "شناسهٔ انتشار و مسیرهای یکتای API باید صریح باشند.", 400);
  for (const check of checks) for (const assertion of check.assertions) assertObservableWorkloadValue(assertion.equals);
  return { publicationActionId, checks };
}
