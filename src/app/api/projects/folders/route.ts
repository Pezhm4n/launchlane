import { exactKeys, integer, object, string } from "../../../../contracts/validation.ts";
import { ensure } from "../../../../server/errors.ts";
import { endpoint, jsonBody, reply } from "../../../../server/http.ts";
import { browseFolders } from "../../../../server/workspace/browse.ts";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export async function POST(request: Request) {
  return endpoint(request, true, async ({ config }) => {
    ensure(
      config.workspaceRoot,
      "WORKSPACE_UNCONFIGURED",
      "پوشه پروژه‌ها هنوز برای این نصب مشخص نشده است. راهنمای انتخاب پوشه را ببینید.",
      503,
    );
    const input = object(await jsonBody(request));
    exactKeys(input, ["directory", "offset"]);
    return reply(
      await browseFolders(
        config.workspaceRoot,
        string(input.directory, 240),
        input.offset === undefined ? 0 : integer(input.offset, 0, 500),
        AbortSignal.any([request.signal, AbortSignal.timeout(10_000)]),
      ),
    );
  });
}
