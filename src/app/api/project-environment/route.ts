import { environmentContext, executeEnvironment, observeEnvironment, proposeEnvironment, proposeImportedEnvironment } from "../../../server/application/environment.ts";
import { importedEnvironmentReview } from "../../../server/environment/import.ts";
import { validateProjectAction } from "../../../server/application/project-flows.ts";
import { openEnvironmentInput } from "../../../server/environment/secrets.ts";
import { endpoint, jsonBody, reply } from "../../../server/http.ts";
import { ensure } from "../../../server/errors.ts";
import { exactKeys, hash, object, string } from "../../../contracts/validation.ts";
import { isApplicationEnvironmentKey, validateEnvironmentVisibility } from "../../../contracts/environment.ts";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export async function GET(request: Request) {
  return endpoint(request, false, ({ config, store, session }) => {
    const params = new URL(request.url).searchParams;
    ensure([...params.keys()].every(key => key === "run"), "INVALID_INPUT", "نشانی اطلاعات برنامه معتبر نیست.");
    const id = string(params.get("run"), 36), { flow, target } = environmentContext(config, store, session.actorId, id);
    store.listActions(session.actorId);
    const row = store.db.prepare("SELECT id FROM actions WHERE actor_id=? AND json_extract(spec,'$.version')=9 AND json_extract(spec,'$.agentRunId')=? ORDER BY rowid DESC LIMIT 1").get(session.actorId, id);
    return reply({ names: flow.profile.envNames.filter(isApplicationEnvironmentKey), app: target.app,
      imported: importedEnvironmentReview(config, store, session.actorId, flow),
      action: row ? store.getAction(String(row.id), session.actorId) : null });
  });
}
export async function POST(request: Request) {
  return endpoint(request, true, async ({ config, store, session }) => {
    const input = object(await jsonBody(request));
    ensure(["propose", "propose-import", "decision", "execute", "observe"].includes(String(input.operation)), "INVALID_OPERATION", "عملیات معتبر نیست.");
    if (input.operation === "propose-import") {
      exactKeys(input, ["operation", "runId", "requestKey", "publicKeys"]);
      ensure(Array.isArray(input.publicKeys) && input.publicKeys.length <= 32 && input.publicKeys.every(key => typeof key === "string"), "INVALID_INPUT", "انتخاب متغیرهای عمومی معتبر نیست.");
      return reply({ action: await proposeImportedEnvironment(config, store, session, string(input.runId, 36), string(input.requestKey, 36), input.publicKeys, request.signal) });
    }
    if (input.operation === "propose") {
      exactKeys(input, ["operation", "runId", "requestKey", "variables"]);
      return reply({ action: await proposeEnvironment(config, store, session, string(input.runId, 36), string(input.requestKey, 36), input.variables, request.signal) });
    }
    exactKeys(input, ["operation", "actionId", ...(input.operation === "decision" ? ["hash", "decision"] : [])]);
    const id = string(input.actionId, 36), action = store.getAction(id, session.actorId);
    ensure(action.spec.version === 9, "INVALID_OPERATION", "این اقدام مربوط به اطلاعات امن برنامه نیست.");
    environmentContext(config, store, session.actorId, action.spec.agentRunId);
    if (input.operation === "decision") {
      ensure(input.decision === "approve" || input.decision === "reject", "INVALID_INPUT", "تصمیم معتبر نیست.");
      if (input.decision === "approve") {
        validateEnvironmentVisibility(action.spec.secretKeys);
        await validateProjectAction(config, store, session.actorId, action.spec, request.signal);
        openEnvironmentInput(store, config.sessionSecret, session.actorId, action.spec);
      }
      return reply({ action: input.decision === "reject" && action.state === "approved"
        ? store.revokeEnvironmentApproval(id, session.actorId, hash(input.hash))
        : store.decide(id, session.actorId, session.id, hash(input.hash), input.decision) });
    }
    ensure(input.operation === "execute" || input.operation === "observe", "INVALID_OPERATION", "عملیات معتبر نیست.");
    return reply({ action: await (input.operation === "execute" ? executeEnvironment : observeEnvironment)(config, store, session, id, request.signal) });
  });
}
