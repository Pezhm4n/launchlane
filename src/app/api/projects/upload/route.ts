import { prepareProjectFlow } from "../../../../server/application/project-flows.ts";
import { endpoint, reply } from "../../../../server/http.ts";
import { readFolderUpload } from "../../../../server/workspace/upload.ts";
import { saveImportedEnvironment } from "../../../../server/environment/import.ts";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  return endpoint(request, true, async ({ config, store, session }) => {
    store.assertAgentIdle(session.actorId, null, true);
    const { name, files, environment } = await readFolderUpload(request);
    const flow = await prepareProjectFlow(config, store, session.actorId, { kind: "upload", directory: ".", name },
      AbortSignal.any([request.signal, AbortSignal.timeout(config.runTimeoutMs)]), undefined, undefined, files,
      created => saveImportedEnvironment(config, store, session.actorId, created, environment),
      environment.filter(row => !row.key.startsWith("NEXT_PUBLIC_") && row.value.length >= 8).map(row => row.value));
    return reply({ flow: { ...flow, displayName: name }, action: null }, 201);
  });
}
