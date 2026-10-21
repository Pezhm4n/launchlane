import { symptoms } from "../../../../contracts/incident-run.ts";
import { exactKeys, object, string, text } from "../../../../contracts/validation.ts";
import { endpoint, jsonBody, reply } from "../../../../server/http.ts";
import { ensure } from "../../../../server/errors.ts";
import { practiceScenarios } from "../../../../server/incident/practice.ts";
import {
  analyzeIncidentRun,
  comparePracticeRun,
  createLiveIncidentRun,
  createPracticeRun,
  recheckIncidentRun,
} from "../../../../server/incident/runs.ts";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export async function GET(request: Request) {
  return endpoint(request, false, ({ store, session }) => {
    const params = new URL(request.url).searchParams,
      id = params.get("id"),
      kind = params.get("kind");
    ensure(
      [...params.keys()].every((key) => key === "id" || key === "kind") &&
        (kind === null || kind === "live" || kind === "sample"),
      "INVALID_INPUT",
      "نشانی بررسی معتبر نیست.",
    );
    if (id) string(id, 36);
    const run = store.getIncidentRun(session.actorId, id || undefined, kind || "live");
    ensure(!id || run, "NOT_FOUND", "این نتیجه پیدا نشد. می‌توانید بررسی تازه‌ای شروع کنید.", 404);
    return reply({ run });
  });
}
export async function POST(request: Request) {
  return endpoint(request, true, async ({ config, store, session }) => {
    const input = object(await jsonBody(request)),
      operation = string(input.operation, 16),
      signal = AbortSignal.any([request.signal, AbortSignal.timeout(config.runTimeoutMs)]);
    if (operation === "sample") {
      exactKeys(input, ["operation", "scenario"]);
      const scenario = practiceScenarios.find((row) => row === input.scenario);
      ensure(scenario, "INVALID_INPUT", "نمونه مورد نظر را انتخاب کنید.");
      return reply({ run: await createPracticeRun(store, session.actorId, scenario, signal) }, 201);
    }
    if (operation === "compare") {
      exactKeys(input, ["operation", "id", "choice"]);
      ensure(
        input.choice === "related" || input.choice === "unrelated",
        "INVALID_INPUT",
        "نوع مقایسه نمونه معتبر نیست.",
      );
      return reply({
        run: comparePracticeRun(store, session.actorId, string(input.id, 36), input.choice),
      });
    }
    if (operation === "collect") {
      exactKeys(input, ["operation", "app", "symptom", "problem", "path"]);
      const symptom = symptoms.find((row) => row === input.symptom);
      ensure(symptom, "INVALID_INPUT", "نشانه مشکل را انتخاب کنید.");
      return reply(
        {
          run: await createLiveIncidentRun(
            config,
            store,
            session.actorId,
            {
              app: string(input.app, 63),
              symptom,
              problem: input.problem === "" ? "" : text(input.problem, 1000),
              path: string(input.path, 512),
            },
            signal,
          ),
        },
        201,
      );
    }
    ensure(
      operation === "recheck" || operation === "analyze",
      "INVALID_OPERATION",
      "این درخواست بررسی پشتیبانی نمی‌شود.",
    );
    exactKeys(input, ["operation", "id"]);
    const id = string(input.id, 36);
    return reply({
      run:
        operation === "recheck"
          ? await recheckIncidentRun(config, store, session.actorId, id, signal)
          : await analyzeIncidentRun(config, store, session.actorId, id, signal),
    });
  });
}
