import { exactKeys, object, string } from "../../../../../contracts/validation.ts";
import { liaraTeams, selectLiaraTeam } from "../../../../../server/connections/liara-teams.ts";
import { endpoint, jsonBody, reply } from "../../../../../server/http.ts";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export async function GET(request: Request) {
  return endpoint(request, false, async ({ config, store, session }) => reply({ teams: await liaraTeams(config, store, session.actorId, request.signal) }));
}
export async function POST(request: Request) {
  return endpoint(request, true, async ({ config, store, session }) => {
    const row = object(await jsonBody(request)); exactKeys(row, ["teamId"]);
    return reply({ connection: await selectLiaraTeam(config, store, session.actorId, string(row.teamId, 24), request.signal) });
  });
}
