import { exactKeys, hash, object, string } from "../../../../../contracts/validation.ts";
import { ensure } from "../../../../../server/errors.ts";
import { endpoint, jsonBody, reply } from "../../../../../server/http.ts";
import { authorizeScope } from "../../../../../server/policy/action.ts";
import { connectedLiaraConfig } from "../../../../../server/connections/liara.ts";
import { validateProjectAction } from "../../../../../server/application/project-flows.ts";
import { isDeploymentSpec } from "../../../../../contracts/deployment.ts";
import { validateRestartAction } from "../../../../../server/application/restart.ts";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
  return endpoint(request, true, async ({ config, store, session }) => {
    const id = string((await context.params).id, 36);
    const input = object(await jsonBody(request));
    exactKeys(input, ["hash", "decision"]);
    ensure(
      input.decision === "approve" || input.decision === "reject",
      "INVALID_INPUT",
      "پاسخ تأیید معتبر نیست.",
    );
    const action = store.getAction(id, session.actorId);
    authorizeScope(
      action.spec.scope,
      action.spec.version === 3 || isDeploymentSpec(action.spec) || action.spec.version === 6
        ? connectedLiaraConfig(config, store, session.actorId, action.spec.scope.app)
        : config,
    );
    if (input.decision === "approve" && action.spec.version === 6)
      validateRestartAction(config, store, session.actorId, action.spec);
    if (input.decision === "approve")
      await validateProjectAction(config, store, session.actorId, action.spec, request.signal);
    return reply({
      action: store.decide(id, session.actorId, session.id, hash(input.hash), input.decision),
    });
  });
}
