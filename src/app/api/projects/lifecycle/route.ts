import { endpoint, jsonBody, reply } from "../../../../server/http.ts";
import { exactKeys, hash, object, string } from "../../../../contracts/validation.ts";
import { ensure } from "../../../../server/errors.ts";
import { isLifecycleSpec } from "../../../../contracts/project-lifecycle.ts";
import { currentLifecycle, executeLifecycle, observeLifecycle, proposeLifecycle } from "../../../../server/application/project-lifecycle.ts";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export async function GET(request: Request) {
  return endpoint(request, false, ({ store, session }) => {
    const params = new URL(request.url).searchParams;
    ensure([...params.keys()].every(key => key === "project"), "INVALID_INPUT", "نشانی معتبر نیست.");
    const id = string(params.get("project"), 36), flow = store.getProjectFlow(session.actorId);
    ensure(flow?.id === id, "PROJECT_CHANGED", "ابتدا پروژه را باز کنید.", 409);
    store.listActions(session.actorId);
    const connection = store.getConnection(session.actorId, "liara")?.view;
    return reply({ action: currentLifecycle(store, session.actorId, id), app: connection?.selectedApp ?? null });
  });
}
export async function POST(request: Request) {
  return endpoint(request, true, async ({ config, store, session }) => {
    const input = object(await jsonBody(request));
    if (input.operation === "propose") {
      exactKeys(input, ["operation", "projectId", "effect", "requestKey"]);
      ensure(input.effect === "stop_app" || input.effect === "delete_app" || input.effect === "start_app" || input.effect === "enable_default_subdomain", "INVALID_OPERATION", "عملیات معتبر نیست.");
      return reply({ action: await proposeLifecycle(config, store, session, string(input.projectId, 36), input.effect, string(input.requestKey, 36), request.signal) });
    }
    ensure(input.operation === "decision" || input.operation === "execute" || input.operation === "observe", "INVALID_OPERATION", "عملیات معتبر نیست.");
    exactKeys(input, ["operation", "actionId", ...(input.operation === "decision" ? ["hash", "decision"] : [])]);
    const id = string(input.actionId, 36), action = store.getAction(id, session.actorId);
    ensure(isLifecycleSpec(action.spec), "INVALID_OPERATION", "این اقدام مربوط به مدیریت مقصد نیست.");
    if (input.operation === "decision") {
      ensure(input.decision === "approve" || input.decision === "reject", "INVALID_INPUT", "تصمیم معتبر نیست.");
      return reply({ action: store.decide(id, session.actorId, session.id, hash(input.hash), input.decision) });
    }
    return reply({ action: await (input.operation === "execute" ? executeLifecycle : observeLifecycle)(config, store, session, id, request.signal) });
  });
}
