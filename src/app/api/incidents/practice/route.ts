import { exactKeys, object } from "../../../../contracts/validation.ts";
import { ensure } from "../../../../server/errors.ts";
import { endpoint, jsonBody, reply } from "../../../../server/http.ts";
import {
  practiceComparison,
  practiceScenarios,
  runPractice,
} from "../../../../server/incident/practice.ts";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  return endpoint(request, true, async () => {
    const input = object(await jsonBody(request));
    exactKeys(input, ["scenario", "choice"]);
    const scenario = practiceScenarios.find((value) => value === input.scenario);
    ensure(scenario, "INVALID_INPUT", "سناریوی تمرین معتبر نیست.");
    ensure(
      input.choice === undefined || input.choice === "related" || input.choice === "unrelated",
      "INVALID_INPUT",
      "نوع مقایسه معتبر نیست.",
    );
    return reply(
      input.choice
        ? practiceComparison(scenario, input.choice)
        : await runPractice(scenario, request.signal),
    );
  });
}
