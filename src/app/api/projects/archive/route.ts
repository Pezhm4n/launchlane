import { exactKeys, hash, object, string } from "../../../../contracts/validation.ts";
import { ensure } from "../../../../server/errors.ts";
import { endpoint, jsonBody, reply } from "../../../../server/http.ts";
import { prepareArchive } from "../../../../server/application/prepare-source.ts";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  return endpoint(request, true, async ({ config, store, session }) => {
    ensure(config.workspaceRoot, "WORKSPACE_UNCONFIGURED", "workspace مجاز تنظیم نشده است.", 503);
    const input = object(await jsonBody(request));
    exactKeys(input, ["directory", "sourceHash"]);
    const artifact = await prepareArchive({
      store,
      stateDir: config.stateDir,
      workspaceRoot: config.workspaceRoot,
      actorId: session.actorId,
      directory: string(input.directory, 240),
      sourceHash: hash(input.sourceHash),
      secrets: [
        config.operatorToken,
        config.sessionSecret,
        config.modelKey,
        config.liaraToken,
      ].filter(Boolean),
      signal: AbortSignal.any([request.signal, AbortSignal.timeout(config.runTimeoutMs)]),
    });
    return reply(
      {
        artifact,
        evidence: "local_archive",
        uploaded: false,
        modelUsed: false,
      },
      201,
    );
  });
}
