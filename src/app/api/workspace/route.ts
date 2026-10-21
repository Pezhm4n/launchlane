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
    const app = connections.liara?.selectedApp,
      savedOrigin = app ? store.getProbeOrigin(session.actorId, config.teamId, app) : null;
    return reply({
      session: { csrfToken: session.csrfToken, expiresAt: session.expiresAt },
      capabilities: capabilities(config, connections.liara),
      actions: store.listActions(session.actorId),
      storage: "available",
      connections,
      features: {
        serviceReads: config.enableLiveLiara,
        analysis: Boolean(config.enableLiveModel && config.modelKey && config.modelId),
        deployment: Boolean(
          config.enableMutations &&
            config.enableLiveLiara &&
            app &&
            connections.liara?.status === "connected" &&
            (config.probeOrigins[app] || savedOrigin),
        ),
        probeApps: [
          ...new Set([...Object.keys(config.probeOrigins), ...(savedOrigin && app ? [app] : [])]),
        ],
        probeOrigin: app ? config.probeOrigins[app] || savedOrigin : null,
      },
    });
  });
}
