import { after } from "next/server";
import { exactKeys, integer, object, string, text } from "../../../../../contracts/validation.ts";
import {
  cancelAgentRun,
  continueAgentRun,
  driveAgentRun,
  decideAgentRepair,
  decideAgentPublication,
  resumeAgentPublication,
  decideAgentDestination,
  resumeAgentDestination,
} from "../../../../../server/agent/runs.ts";
import { AgentRepository, agentView } from "../../../../../server/agent/store.ts";
import { ensure } from "../../../../../server/errors.ts";
import { endpoint, jsonBody, reply } from "../../../../../server/http.ts";
import { resumePublicationMission } from "../../../../../server/application/publication-mission.ts";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 600;
type Context = { params: Promise<{ id: string }> };
export async function GET(request: Request, { params }: Context) {
  return endpoint(request, false, async ({ store, session }) => {
    const { id } = await params;
    string(id, 36);
    const query = new URL(request.url).searchParams;
    ensure(
      [...query.keys()].every((key) => key === "after"),
      "INVALID_INPUT",
      "نشانی رویدادها معتبر نیست.",
    );
    const cursor = Number(query.get("after") ?? 0);
    integer(cursor, 0, 10000);
    const run = new AgentRepository(store).get(session.actorId, id);
    ensure(run, "AGENT_NOT_FOUND", "این بررسی پیدا نشد.", 404);
    return reply({
      run: agentView(run),
      events: run.events.filter((event) => event.sequence > cursor),
    });
  });
}
export async function POST(request: Request, { params }: Context) {
  return endpoint(request, true, async ({ config, store, session }) => {
    const { id } = await params;
    string(id, 36);
    const input = object(await jsonBody(request)),
      revision = integer(input.revision, 1, 10000);
    if (input.operation === "cancel") {
      exactKeys(input, ["operation", "revision"]);
      return reply({ run: agentView(cancelAgentRun(store, session.actorId, id, revision)) });
    }
    if (input.operation === "resume-publication") {
      exactKeys(input, ["operation", "revision", "requestKey"]);
      const result = await resumePublicationMission(config, store, session, id, revision, string(input.requestKey, 80), request.signal);
      if (result.created) after(() => driveAgentRun(config, store, session, id));
      return reply({ run: agentView(result.run) });
    }
    if (input.operation === "repair-decision") {
      exactKeys(input, ["operation", "revision", "jobId", "decision"]);
      ensure(
        input.decision === "approve" || input.decision === "reject",
        "INVALID_INPUT",
        "تصمیم معتبر نیست.",
      );
      const run = await decideAgentRepair(
        config,
        store,
        session,
        id,
        revision,
        string(input.jobId, 36),
        input.decision,
      );
      if (input.decision === "approve") after(() => driveAgentRun(config, store, session, id));
      return reply({ run: agentView(run) });
    }
    if (input.operation === "publication-decision") {
      exactKeys(input, ["operation", "revision", "actionId", "decision"]);
      ensure(input.decision === "approve" || input.decision === "reject", "INVALID_INPUT", "تصمیم معتبر نیست.");
      const run = await decideAgentPublication(config, store, session, id, revision,
        string(input.actionId, 36), input.decision);
      if (input.decision === "approve") after(() => driveAgentRun(config, store, session, id));
      return reply({ run: agentView(run) });
    }
    if (input.operation === "publication-observe") {
      exactKeys(input, ["operation", "revision"]);
      const run = resumeAgentPublication(store, session, id, revision);
      after(() => driveAgentRun(config, store, session, id));
      return reply({ run: agentView(run) });
    }
    if (input.operation === "destination-decision") {
      exactKeys(input, ["operation", "revision", "actionId", "decision"]);
      ensure(input.decision === "approve" || input.decision === "reject", "INVALID_INPUT", "تصمیم معتبر نیست.");
      const run = await decideAgentDestination(config, store, session, id, revision,
        string(input.actionId, 36), input.decision);
      if (input.decision === "approve") after(() => driveAgentRun(config, store, session, id));
      return reply({ run: agentView(run) });
    }
    if (input.operation === "destination-observe") {
      exactKeys(input, ["operation", "revision"]);
      const run = resumeAgentDestination(store, session, id, revision);
      after(() => driveAgentRun(config, store, session, id));
      return reply({ run: agentView(run) });
    }
    ensure(input.operation === "message", "INVALID_OPERATION", "این درخواست پشتیبانی نمی‌شود.");
    exactKeys(input, ["operation", "revision", "requestKey", "message"]);
    const result = continueAgentRun(
      config,
      store,
      session,
      id,
      revision,
      string(input.requestKey, 80),
      text(input.message, 2000).trim(),
    );
    if (result.created) after(() => driveAgentRun(config, store, session, id));
    return reply({ run: agentView(result.run) });
  });
}
