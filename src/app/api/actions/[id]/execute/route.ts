import { string } from "../../../../../contracts/validation.ts";
import { executeDeployment } from "../../../../../server/application/deployment.ts";
import { endpoint, reply } from "../../../../../server/http.ts";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
  return endpoint(request, true, async ({ config, store, session }) => {
    const id = string((await context.params).id, 36);
    return reply({
      action: await executeDeployment(
        config,
        store,
        session,
        id,
        AbortSignal.any([request.signal, AbortSignal.timeout(config.runTimeoutMs)]),
      ),
    });
  });
}
