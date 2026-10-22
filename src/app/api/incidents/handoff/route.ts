import { ensure } from "../../../../server/errors.ts";
import { endpoint, reply } from "../../../../server/http.ts";
import { createIncidentHandoff } from "../../../../server/incident/handoff.ts";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export async function GET(request: Request) {
  return endpoint(request, false, ({ config, store, session }) => {
    const params = new URL(request.url).searchParams,
      id = params.get("id");
    ensure(
      [...params.keys()].every((key) => key === "id") &&
        params.getAll("id").length === 1 &&
        id &&
        /^[a-f0-9-]{36}$/.test(id),
      "INVALID_INPUT",
      "برای دریافت گزارش، نتیجه یک بررسی را باز کنید.",
    );
    return reply({ handoff: createIncidentHandoff(config, store, session.actorId, id) });
  });
}
