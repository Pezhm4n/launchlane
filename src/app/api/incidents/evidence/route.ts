import { exactKeys, integer, object, string } from "../../../../contracts/validation.ts";
import { endpoint, jsonBody, reply } from "../../../../server/http.ts";
import { LiaraReadClient } from "../../../../server/liara/client.ts";
import { WorkloadProbe } from "../../../../server/liara/probe.ts";
import { RunBudget } from "../../../../server/policy/budget.ts";
import { collectEvidence } from "../../../../server/incident/collect.ts";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export async function POST(request: Request) {
  return endpoint(request, true, async ({ config }) => {
    const input = object(await jsonBody(request));
    exactKeys(input, ["app", "start", "end", "since", "path"]);
    const evidence = await collectEvidence(
      new LiaraReadClient(config),
      new WorkloadProbe(config),
      {
        scope: { teamId: config.teamId, app: string(input.app, 63) },
        start: integer(input.start, 0, Number.MAX_SAFE_INTEGER),
        end: integer(input.end, 0, Number.MAX_SAFE_INTEGER),
        since: string(input.since, 64),
        path: string(input.path, 200),
      },
      new RunBudget(config),
      request.signal,
    );
    return reply({ evidence, modelUsed: false, mutated: false });
  });
}
