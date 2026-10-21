import { exactKeys, hash, object, string } from "../../../../../contracts/validation.ts";
import { ensure } from "../../../../../server/errors.ts";
import { endpoint, jsonBody, reply } from "../../../../../server/http.ts";
import { authorizeScope } from "../../../../../server/policy/action.ts";

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
    authorizeScope(store.getAction(id, session.actorId).spec.scope, config);
    return reply({
      action: store.decide(id, session.actorId, session.id, hash(input.hash), input.decision),
    });
  });
}
