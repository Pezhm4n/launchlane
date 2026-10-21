import { exactKeys, object, string } from "../../../../contracts/validation.ts";
import { ensure } from "../../../../server/errors.ts";
import { endpoint, jsonBody, reply } from "../../../../server/http.ts";
import { inspectProject } from "../../../../server/workspace/inspect.ts";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  return endpoint(request, true, async ({ config }) => {
    ensure(
      config.workspaceRoot,
      "WORKSPACE_UNCONFIGURED",
      "ابتدا پوشه workspace مجاز را در تنظیمات محلی مشخص کنید.",
      503,
    );
    const input = object(await jsonBody(request));
    exactKeys(input, ["directory"]);
    const profile = await inspectProject(config.workspaceRoot, string(input.directory, 240), {
      secrets: [
        config.operatorToken,
        config.sessionSecret,
        config.modelKey,
        config.liaraToken,
      ].filter(Boolean),
      signal: AbortSignal.any([request.signal, AbortSignal.timeout(config.runTimeoutMs)]),
    });
    return reply({ profile, evidence: "local_source", modelUsed: false, uploaded: false });
  });
}
