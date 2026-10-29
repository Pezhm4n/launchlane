import { databaseDataState, observeDatabaseData } from "../../../../server/application/database-data.ts";
import { dataObservationId } from "../../../../contracts/database-data.ts";
import { exactKeys, object } from "../../../../contracts/validation.ts";
import { endpoint, jsonBody, reply } from "../../../../server/http.ts";
import { ensure } from "../../../../server/errors.ts";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export async function GET(request: Request) {
  return endpoint(request, false, ({ config, store, session }) => {
    const query = new URL(request.url).searchParams;
    ensure([...query.keys()].length === 1 && query.has("actionId"), "INVALID_INPUT", "شناسهٔ انتشار لازم است.");
    return reply(databaseDataState(config, store, session.actorId, dataObservationId(query.get("actionId"))));
  });
}
export async function POST(request: Request) {
  return endpoint(request, true, async ({ config, store, session }) => {
    const row = object(await jsonBody(request)); exactKeys(row, ["actionId", "baselineId"]);
    return reply(await observeDatabaseData(config, store, session.actorId, dataObservationId(row.actionId),
      row.baselineId === undefined || row.baselineId === null ? null : dataObservationId(row.baselineId), request.signal));
  });
}
