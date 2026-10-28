import { proposePreviousRollback } from "../../../../server/application/rollback.ts";
import { endpoint, jsonBody, reply } from "../../../../server/http.ts";
import { exactKeys, object, string } from "../../../../contracts/validation.ts";
import { ensure } from "../../../../server/errors.ts";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  return endpoint(request, true, async ({ config, store, session }) => {
    const input = object(await jsonBody(request));
    exactKeys(input, ["beforeActionId"]);
    const beforeActionId = string(input.beforeActionId, 36);
    ensure(/^[a-f0-9-]{36}$/.test(beforeActionId), "INVALID_INPUT", "شناسهٔ نسخهٔ جاری معتبر نیست.");
    return reply(await proposePreviousRollback(config, store, session.actorId, beforeActionId, request.signal));
  });
}
