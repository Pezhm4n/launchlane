import { exactKeys, object, string } from "../../../../contracts/validation.ts";
import { proposeRestart } from "../../../../server/application/restart.ts";
import { endpoint, jsonBody, reply } from "../../../../server/http.ts";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export async function POST(request: Request) {
  return endpoint(request, true, async ({ config, store, session }) => {
    const input = object(await jsonBody(request));
    exactKeys(input, ["incidentRunId"]);
    return reply(
      {
        action: await proposeRestart(
          config,
          store,
          session.actorId,
          string(input.incidentRunId, 36),
          AbortSignal.any([request.signal, AbortSignal.timeout(config.runTimeoutMs)]),
        ),
      },
      201,
    );
  });
}
