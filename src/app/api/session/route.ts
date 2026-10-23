import { exactKeys, object, string } from "../../../contracts/validation.ts";
import {
  checkPublicSessionRequest,
  endpoint,
  errorReply,
  jsonBody,
  reply,
} from "../../../server/http.ts";
import { login, logoutCookie } from "../../../server/policy/session.ts";
import { getRuntime } from "../../../server/runtime.ts";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  try {
    const { config, store } = getRuntime();
    checkPublicSessionRequest(request, config);
    const input = object(await jsonBody(request));
    exactKeys(input, ["token"]);
    const result = login(string(input.token, 256), config, store);
    return reply(
      { session: { csrfToken: result.session.csrfToken, expiresAt: result.session.expiresAt } },
      200,
      { "Set-Cookie": result.cookie },
    );
  } catch (error) {
    return errorReply(error);
  }
}

export async function DELETE(request: Request) {
  return endpoint(request, true, ({ config, store, session }) => {
    store.revokeSession(session.id);
    return reply({ state: "signed_out" }, 200, { "Set-Cookie": `${logoutCookie}${config.origin.startsWith("https:") ? "; Secure" : ""}` });
  });
}
