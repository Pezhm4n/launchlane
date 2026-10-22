import { after } from "next/server";
import { exactKeys, object, string, text } from "../../../../contracts/validation.ts";
import { createAgentRun, driveAgentRun } from "../../../../server/agent/runs.ts";
import { AgentRepository, agentView } from "../../../../server/agent/store.ts";
import { ensure } from "../../../../server/errors.ts";
import { endpoint, jsonBody, reply } from "../../../../server/http.ts";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 120;
export async function GET(request: Request) {
  return endpoint(request, false, ({ store, session }) => {
    ensure(!new URL(request.url).search, "INVALID_INPUT", "نشانی معتبر نیست.");
    const run = new AgentRepository(store).get(session.actorId);
    return reply({ run: run ? agentView(run) : null });
  });
}
export async function POST(request: Request) {
  return endpoint(request, true, async ({ config, store, session }) => {
    const input = object(await jsonBody(request));
    exactKeys(input, ["requestKey", "goal", "projectId"]);
    const key = string(input.requestKey, 80);
    ensure(/^[a-f0-9-]{36}$/.test(key), "INVALID_INPUT", "شناسه درخواست معتبر نیست.");
    const result = createAgentRun(
      config,
      store,
      session,
      key,
      text(input.goal, 2000).trim(),
      input.projectId === null ? null : string(input.projectId, 36),
    );
    if (result.created) after(() => driveAgentRun(config, store, session, result.run.id));
    return reply({ run: agentView(result.run) }, result.created ? 201 : 200);
  });
}
