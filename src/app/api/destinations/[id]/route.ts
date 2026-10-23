import { exactKeys, object, string } from "../../../../contracts/validation.ts";
import { executeDestination, observeDestination } from "../../../../server/application/provision.ts";
import { validateProjectAction } from "../../../../server/application/project-flows.ts";
import { endpoint, jsonBody, reply } from "../../../../server/http.ts";
import { ensure } from "../../../../server/errors.ts";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
type Context = { params: Promise<{ id: string }> };
export async function GET(request: Request, { params }: Context) {
  return endpoint(request, false, async ({ store, session }) => {
    const action = store.getAction(string((await params).id, 36), session.actorId);
    ensure(action.spec.version === 8 || action.spec.version === 12 || action.spec.version === 16 || action.spec.version === 18 || action.spec.version === 20, "INVALID_OPERATION", "این اقدام مربوط به ساخت مقصد نیست.");
    return reply({ action });
  });
}
export async function POST(request: Request, { params }: Context) {
  return endpoint(request, true, async ({ config, store, session }) => {
    const id = string((await params).id, 36), input = object(await jsonBody(request)), action = store.getAction(id, session.actorId);
    ensure(action.spec.version === 8 || action.spec.version === 12 || action.spec.version === 16 || action.spec.version === 18 || action.spec.version === 20, "INVALID_OPERATION", "این اقدام مربوط به ساخت مقصد نیست.");
    if (input.operation === "decision") {
      exactKeys(input, ["operation", "hash", "decision"]);
      ensure(input.decision === "approve" || input.decision === "reject", "INVALID_INPUT", "تصمیم معتبر نیست.");
      if (input.decision === "approve") await validateProjectAction(config, store, session.actorId, action.spec, request.signal);
      return reply({ action: store.decide(id, session.actorId, session.id, string(input.hash, 64), input.decision) });
    }
    exactKeys(input, ["operation"]);
    ensure(input.operation === "execute" || input.operation === "observe", "INVALID_OPERATION", "درخواست ساخت مقصد معتبر نیست.");
    return reply({ action: await (input.operation === "execute" ? executeDestination : observeDestination)(config, store, session, id, request.signal) });
  });
}
