import {
  exactKeys,
  hash,
  identifier,
  integer,
  object,
  string,
} from "../../../contracts/validation.ts";
import { ensure } from "../../../server/errors.ts";
import { endpoint, jsonBody, reply } from "../../../server/http.ts";
import { authorizeScope } from "../../../server/policy/action.ts";
import { inspectProject } from "../../../server/workspace/inspect.ts";
import { readArtifact } from "../../../server/workspace/archive.ts";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  return endpoint(request, true, async ({ config, store, session }) => {
    ensure(config.workspaceRoot, "WORKSPACE_UNCONFIGURED", "workspace مجاز تنظیم نشده است.", 503);
    const input = object(await jsonBody(request));
    exactKeys(input, ["directory", "sourceHash", "artifactHash", "app", "port"]);
    const app = identifier(input.app),
      port = integer(input.port, 1, 65535);
    const scope = { teamId: config.teamId, app };
    authorizeScope(scope, config);
    const profile = await inspectProject(config.workspaceRoot, string(input.directory, 240), {
      secrets: [
        config.operatorToken,
        config.sessionSecret,
        config.modelKey,
        config.liaraToken,
      ].filter(Boolean),
      signal: AbortSignal.any([request.signal, AbortSignal.timeout(config.runTimeoutMs)]),
    });
    ensure(
      profile.sourceHash === hash(input.sourceHash),
      "SOURCE_CHANGED",
      "source پس از بررسی تغییر کرده است؛ دوباره بررسی کنید.",
      409,
    );
    ensure(
      profile.runtime === "node" && profile.start,
      "PROJECT_INCOMPLETE",
      "پروژه به package.json و دستور start نیاز دارد.",
      409,
    );
    const artifact = store.getArtifact(session.actorId, hash(input.artifactHash));
    ensure(
      artifact.sourceHash === profile.sourceHash,
      "ARTIFACT_MISMATCH",
      "بسته به همین source تعلق ندارد؛ دوباره آماده کنید.",
      409,
    );
    await readArtifact(config.stateDir, artifact);
    const action = store.createAction(session.actorId, {
      version: 2,
      scope,
      operation: "deploy",
      sourceHash: profile.sourceHash,
      artifactHash: artifact.archiveHash,
      args: { port, planId: null },
    });
    return reply(
      {
        action,
        evidence: "local_proposal",
        price: null,
        priceReason: "قیمت و پلن از سرویس واقعی تأیید نشده‌اند.",
        uploaded: false,
      },
      201,
    );
  });
}
