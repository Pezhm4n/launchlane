import { string } from "../../../../../contracts/validation.ts";
import { executeApproved } from "../../../../../server/application/execute.ts";
import { endpoint, reply } from "../../../../../server/http.ts";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
  return endpoint(request, true, async ({ config, store, session }) => {
    const id = string((await context.params).id, 36),
      action = store.getAction(id, session.actorId);
    return reply({
      action: await executeApproved({
        config,
        store,
        session,
        id,
        currentSpec: action.spec,
        adapter: null,
        signal: AbortSignal.any([request.signal, AbortSignal.timeout(config.runTimeoutMs)]),
      }),
    });
  });
}
