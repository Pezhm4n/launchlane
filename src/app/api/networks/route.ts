import { exactKeys, object, string } from "../../../contracts/validation.ts";
import { proposeNetwork } from "../../../server/application/network.ts";
import { endpoint, jsonBody, reply } from "../../../server/http.ts";
import { ensure } from "../../../server/errors.ts";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export async function POST(request: Request) {
  return endpoint(request, true, async ({ config, store, session }) => {
    const input = object(await jsonBody(request));
    exactKeys(input, ["operation", "projectId", "app"]);
    ensure(input.operation === "propose", "INVALID_OPERATION", "درخواست شبکه معتبر نیست.");
    store.assertAgentIdle(session.actorId);
    return reply({ action: await proposeNetwork(config, store, session.actorId, {
      flowId: string(input.projectId, 36), app: string(input.app, 63),
    }, request.signal) });
  });
}
