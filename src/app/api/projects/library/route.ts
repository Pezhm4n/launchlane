import { openLibraryProject, listProjects } from "../../../../server/application/project-library.ts";
import { endpoint, jsonBody, reply } from "../../../../server/http.ts";
import { exactKeys, integer, object, string } from "../../../../contracts/validation.ts";
import { ensure } from "../../../../server/errors.ts";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export async function GET(request: Request) {
  return endpoint(request, false, ({ config, store, session }) => {
    const params = new URL(request.url).searchParams;
    ensure([...params.keys()].every(key => key === "offset"), "INVALID_INPUT", "نشانی فهرست پروژه‌ها معتبر نیست.");
    const offset = Number(params.get("offset") ?? 0);
    return reply(listProjects(config, store, session.actorId, integer(offset, 0, 1000000)));
  });
}
export async function POST(request: Request) {
  return endpoint(request, true, async ({ config, store, session }) => {
    const input = object(await jsonBody(request)); exactKeys(input, ["id"]);
    return reply({ flow: await openLibraryProject(config, store, session.actorId, string(input.id, 36), request.signal), action: null });
  });
}
