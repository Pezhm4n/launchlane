import { parseSelection } from "../../../contracts/project-flow.ts";
import { exactKeys, integer, object, string } from "../../../contracts/validation.ts";
import {
  prepareProjectFlow,
  proposeProjectFlow,
  restoreProjectFlow,
} from "../../../server/application/project-flows.ts";
import { ensure } from "../../../server/errors.ts";
import { endpoint, jsonBody, reply } from "../../../server/http.ts";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export async function GET(request: Request) {
  return endpoint(request, false, async ({ config, store, session }) => {
    const params = new URL(request.url).searchParams,
      id = params.get("id");
    ensure(
      [...params.keys()].every((key) => key === "id"),
      "INVALID_INPUT",
      "نشانی پروژه معتبر نیست.",
    );
    if (id) string(id, 36);
    const flow = await restoreProjectFlow(
      config,
      store,
      session.actorId,
      AbortSignal.any([request.signal, AbortSignal.timeout(config.runTimeoutMs)]),
      id ?? undefined,
    );
    store.listActions(session.actorId);
    return reply({
      flow,
      action: flow?.actionId ? store.getAction(flow.actionId, session.actorId) : null,
    });
  });
}
export async function POST(request: Request) {
  return endpoint(request, true, async ({ config, store, session }) => {
    const input = object(await jsonBody(request)),
      operation = string(input.operation, 16),
      signal = AbortSignal.any([request.signal, AbortSignal.timeout(config.runTimeoutMs)]);
    if (operation === "prepare") {
      exactKeys(input, ["operation", "selection"]);
      const selection = parseSelection(input.selection);
      const flow = await prepareProjectFlow(config, store, session.actorId, selection, signal);
      return reply({ flow, action: null }, 201);
    }
    ensure(operation === "propose", "INVALID_OPERATION", "این درخواست پروژه پشتیبانی نمی‌شود.");
    exactKeys(input, ["operation", "id", "app", "port"]);
    const id = string(input.id, 36),
      app = string(input.app, 63),
      port = input.port === null ? null : integer(input.port, 1, 65535);
    const action = await proposeProjectFlow(config, store, session.actorId, id, app, port, signal);
    return reply({ flow: store.getProjectFlow(session.actorId, id), action }, 201);
  });
}
