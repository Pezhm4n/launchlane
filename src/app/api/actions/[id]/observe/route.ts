import { string } from "../../../../../contracts/validation.ts";
import { observeDeployment } from "../../../../../server/application/deployment.ts";
import { endpoint, reply } from "../../../../../server/http.ts";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
  return endpoint(request, true, async ({ config, store, session }) =>
    reply({
      action: await observeDeployment(
        config,
        store,
        session,
        string((await context.params).id, 36),
        AbortSignal.any([request.signal, AbortSignal.timeout(config.runTimeoutMs)]),
      ),
    }),
  );
}
