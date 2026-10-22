import { exactKeys, object, string } from "../../../contracts/validation.ts";
import { destinationOptions, proposeDestination } from "../../../server/application/provision.ts";
import { endpoint, jsonBody, reply } from "../../../server/http.ts";
import { ensure } from "../../../server/errors.ts";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export async function POST(request: Request) {
  return endpoint(request, true, async ({ config, store, session }) => {
    const input = object(await jsonBody(request));
    if (input.operation === "options") {
      exactKeys(input, ["operation"]);
      return reply(await destinationOptions(config, store, session.actorId, request.signal));
    }
    ensure(input.operation === "propose", "INVALID_OPERATION", "درخواست مقصد پشتیبانی نمی‌شود.");
    exactKeys(input, ["operation", "projectId", "app", "planId", "bundleId", "networkId"]);
    return reply({ action: await proposeDestination(config, store, session.actorId, {
      flowId: string(input.projectId, 36), app: string(input.app, 63), planId: string(input.planId, 63),
      bundleId: string(input.bundleId, 63), networkId: string(input.networkId, 24),
    }, request.signal) });
  });
}
