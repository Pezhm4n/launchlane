import { after } from "next/server";
import { exactKeys, object, string, text } from "../../../../contracts/validation.ts";
import { createAgentRun, driveAgentRun } from "../../../../server/agent/runs.ts";
import { AgentRepository, agentView } from "../../../../server/agent/store.ts";
import { ensure } from "../../../../server/errors.ts";
import { endpoint, jsonBody, reply } from "../../../../server/http.ts";
import { createPublicationMission } from "../../../../server/application/publication-mission.ts";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 600;
export async function GET(request: Request) {
  return endpoint(request, false, ({ store, session }) => {
    const params = new URL(request.url).searchParams;
    ensure([...params.keys()].every(key => key === "project" || key === "kind") && params.getAll("project").length <= 1 && params.getAll("kind").length <= 1, "INVALID_INPUT", "نشانی معتبر نیست.");
    const project = params.get("project");
    const kind = params.get("kind");
    ensure(kind === null || kind === "publication" || kind === "conversation", "INVALID_INPUT", "نوع بررسی معتبر نیست.");
    ensure(project === null || project === "none" || /^[a-f0-9-]{36}$/.test(project), "INVALID_INPUT", "پروژه معتبر نیست.");
    const repo = new AgentRepository(store), run = project === null ? repo.get(session.actorId) : repo.forProject(session.actorId, project === "none" ? null : project, kind);
    return reply({ run: run ? agentView(run) : null });
  });
}
export async function POST(request: Request) {
  return endpoint(request, true, async ({ config, store, session }) => {
    const input = object(await jsonBody(request));
    exactKeys(input, input.operation === "publish" ? ["operation", "requestKey", "publication"] : ["requestKey", "goal", "projectId", ...(input.operation === "question" || input.operation === "maintain" ? ["operation"] : [])]);
    const key = string(input.requestKey, 80);
    ensure(/^[a-f0-9-]{36}$/.test(key), "INVALID_INPUT", "شناسه درخواست معتبر نیست.");
    const result = input.operation === "publish" ? await createPublicationMission(config, store, session, key, input.publication, request.signal) : createAgentRun(
      config,
      store,
      session,
      key,
      text(input.goal, 2000).trim(),
      input.projectId === null ? null : string(input.projectId, 36),
      input.operation === "question" ? "conversation" : input.operation === "maintain" ? "maintenance" : "legacy",
    );
    if (result.created) after(() => driveAgentRun(config, store, session, result.run.id));
    return reply({ run: agentView(result.run) }, result.created ? 201 : 200);
  });
}
