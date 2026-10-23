import { after } from "next/server";
import { randomUUID } from "node:crypto";
import { errorReply } from "../../../server/http.ts";
import { requireMcpAccess } from "../../../server/mcp/access.ts";
import { handleMcpRequest } from "../../../server/mcp/server.ts";
import { getRuntime } from "../../../server/runtime.ts";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 600;
async function handle(request: Request) {
  const requestId = randomUUID();
  try {
    const { config, store } = getRuntime(), access = requireMcpAccess(request, config, store);
    const response = await handleMcpRequest(request, { config, store, access, schedule: work => after(work) });
    response.headers.set("Cache-Control", "no-store");
    response.headers.set("X-Content-Type-Options", "nosniff");
    response.headers.set("X-Request-Id", requestId);
    return response;
  } catch (error) { return errorReply(error, requestId); }
}
export const GET = handle;
export const POST = handle;
export const DELETE = handle;
