import { exactKeys, object, string } from "../../../../contracts/validation.ts";
import { ensure } from "../../../../server/errors.ts";
import { endpoint, jsonBody, reply } from "../../../../server/http.ts";
import { issueMcpAccess } from "../../../../server/mcp/access.ts";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export async function POST(request: Request) {
  return endpoint(request, true, async ({ config, store, session }) => {
    const input = object(await jsonBody(request));
    exactKeys(input, ["missions"]);
    ensure(typeof input.missions === "boolean", "INVALID_INPUT", "محدوده اتصال را مشخص کنید.");
    return reply(issueMcpAccess(config, store, session, input.missions), 201);
  });
}
export async function DELETE(request: Request) {
  return endpoint(request, true, async ({ store, session }) => {
    const input = object(await jsonBody(request));
    exactKeys(input, ["id"]);
    const id = string(input.id, 64);
    ensure(id !== session.id && store.sessionExists(id, session.actorId, Date.now()), "AUTH_REQUIRED", "دسترسی اتصال معتبر نیست.", 401);
    store.revokeSession(id);
    return reply({ revoked: true });
  });
}
