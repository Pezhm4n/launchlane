import { createDomainGuide } from "../../../../server/application/domain-guide.ts";
import { endpoint, jsonBody, reply } from "../../../../server/http.ts";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  return endpoint(request, true, async ({ config, store, session }) =>
    reply({ guide: createDomainGuide(config, store, session.actorId, await jsonBody(request)) }),
  );
}
