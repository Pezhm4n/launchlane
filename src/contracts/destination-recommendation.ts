import { ensure } from "../server/errors.ts";
import { exactKeys, hash, integer, object, string } from "./validation.ts";

export type DestinationRecommendation = {
  version: 1; projectId: string; sourceHash: string; catalogFingerprint: string; observedAt: number;
  projectName: string; summary: string; reason: string; capacity: "unmeasured";
  recommended: { planId: string; bundleId: string };
  offers: { planId: string; bundleId: string; region: string; hourlyHundredthsToman: number }[];
};
export function parseDestinationRecommendation(value: unknown): DestinationRecommendation {
  const row = object(value), selected = object(row.recommended);
  exactKeys(row, ["version", "projectId", "sourceHash", "catalogFingerprint", "observedAt", "projectName", "summary", "reason", "capacity", "recommended", "offers"]);
  exactKeys(selected, ["planId", "bundleId"]);
  ensure(row.version === 1 && row.capacity === "unmeasured" && Array.isArray(row.offers) && row.offers.length > 0 && row.offers.length <= 4,
    "RECOMMENDATION_INVALID", "پیشنهاد پلن کامل و قابل تأیید نیست.", 502);
  const offers = row.offers.map(value => {
    const offer = object(value); exactKeys(offer, ["planId", "bundleId", "region", "hourlyHundredthsToman"]);
    return { planId: string(offer.planId, 63), bundleId: string(offer.bundleId, 63), region: string(offer.region, 40),
      hourlyHundredthsToman: integer(offer.hourlyHundredthsToman, 0, Number.MAX_SAFE_INTEGER) };
  });
  const recommended = { planId: string(selected.planId, 63), bundleId: string(selected.bundleId, 63) };
  ensure(new Set(offers.map(offer => `${offer.planId}/${offer.bundleId}`)).size === offers.length, "RECOMMENDATION_INVALID", "گزینه تکراری در پیشنهاد پلن معتبر نیست.", 502);
  ensure(offers.some(offer => offer.planId === recommended.planId && offer.bundleId === recommended.bundleId), "RECOMMENDATION_INVALID", "پلن پیشنهادی در گزینه‌های همین حساب نیست.", 502);
  return { version: 1, projectId: string(row.projectId, 36), sourceHash: hash(row.sourceHash), catalogFingerprint: hash(row.catalogFingerprint),
    observedAt: integer(row.observedAt, 0, Number.MAX_SAFE_INTEGER), projectName: string(row.projectName, 160), summary: string(row.summary, 1000), reason: string(row.reason, 1000),
    capacity: "unmeasured", recommended, offers };
}
