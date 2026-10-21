import { capabilities } from "../../../server/application/capabilities.ts";
import { endpoint, reply } from "../../../server/http.ts";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  return endpoint(request, false, ({ config, store, session }) =>
    reply({
      session: { csrfToken: session.csrfToken, expiresAt: session.expiresAt },
      capabilities: capabilities(config),
      actions: store.listActions(session.actorId),
      storage: "available",
    }),
  );
}
