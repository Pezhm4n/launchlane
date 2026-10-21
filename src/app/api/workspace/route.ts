import { capabilities } from "../../../server/application/capabilities.ts";
import { endpoint, reply } from "../../../server/http.ts";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  return endpoint(request, false, ({ config, store, session }) => {
    const connections = {
      github: store.getConnection(session.actorId, "github")?.view ?? null,
      liara: store.getConnection(session.actorId, "liara")?.view ?? null,
    };
    return reply({
      session: { csrfToken: session.csrfToken, expiresAt: session.expiresAt },
      capabilities: capabilities(config, connections.liara),
      actions: store.listActions(session.actorId),
      storage: "available",
      connections,
      features: {
        serviceReads: config.enableLiveLiara,
        analysis: Boolean(config.enableLiveModel && config.modelKey && config.modelId),
        deployment: false,
        probeApps: Object.keys(config.probeOrigins),
      },
    });
  });
}
