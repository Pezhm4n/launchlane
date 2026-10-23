import { randomUUID } from "node:crypto";
import { liaraSignIn } from "../../../../server/connections/liara-login.ts";
import { checkPublicSessionRequest, errorReply, jsonBody, reply } from "../../../../server/http.ts";
import { getRuntime } from "../../../../server/runtime.ts";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export async function POST(request: Request) {
  const requestId = randomUUID();
  try {
    const { config, store } = getRuntime();
    checkPublicSessionRequest(request, config);
    const result = await liaraSignIn(config, store, await jsonBody(request), request.signal);
    return "session" in result ? reply({ authenticated: true, expiresAt: result.session.expiresAt }, 200,
      { "Set-Cookie": result.cookie, "X-Request-Id": requestId }) : reply(result, 200, { "X-Request-Id": requestId });
  } catch (error) { return errorReply(error, requestId); }
}
