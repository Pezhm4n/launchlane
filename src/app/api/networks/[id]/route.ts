import { exactKeys, object, string } from "../../../../contracts/validation.ts";
import { executeNetwork, observeNetwork } from "../../../../server/application/network.ts";
import { validateProjectAction } from "../../../../server/application/project-flows.ts";
import { endpoint, jsonBody, reply } from "../../../../server/http.ts";
import { ensure } from "../../../../server/errors.ts";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
type Context = { params: Promise<{ id: string }> };
export async function GET(request: Request, { params }: Context) {
  return endpoint(request, false, async ({ store, session }) => {
    const action = store.getAction(string((await params).id, 36), session.actorId);
    ensure(action.spec.version === 13, "INVALID_OPERATION", "این اقدام مربوط به ساخت شبکه نیست.");
    return reply({ action });
  });
}
export async function POST(request: Request, { params }: Context) {
  return endpoint(request, true, async ({ config, store, session }) => {
    const id = string((await params).id, 36), input = object(await jsonBody(request)), action = store.getAction(id, session.actorId);
    ensure(action.spec.version === 13 && action.spec.agentRunId === null, "INVALID_OPERATION", "تصمیم مأموریت را از همان مأموریت ثبت کنید.");
    if (input.operation === "decision") {
      exactKeys(input, ["operation", "hash", "decision", "acknowledgeUnknownCost"]);
      ensure((input.decision === "approve" || input.decision === "reject") && typeof input.acknowledgeUnknownCost === "boolean", "INVALID_INPUT", "تصمیم معتبر نیست.");
      if (input.decision === "approve") await validateProjectAction(config, store, session.actorId, action.spec, request.signal);
      return reply({ action: store.decide(id, session.actorId, session.id, string(input.hash, 64), input.decision, Date.now(), undefined,
        { acknowledgeUnknownCost: input.acknowledgeUnknownCost }) });
    }
    exactKeys(input, ["operation"]);
    ensure(input.operation === "execute" || input.operation === "observe", "INVALID_OPERATION", "درخواست ساخت شبکه معتبر نیست.");
    return reply({ action: await (input.operation === "execute" ? executeNetwork : observeNetwork)(config, store, session, id, request.signal) });
  });
}
