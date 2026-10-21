import { exactKeys, integer, object, string } from "../../../../contracts/validation.ts";
import { endpoint, jsonBody, reply } from "../../../../server/http.ts";
import { githubCommand } from "../../../../server/github/cli.ts";
import { connectedGitHub, githubLoginService } from "../../../../server/github/login.ts";
import { ensure } from "../../../../server/errors.ts";
import { githubOwner, githubRepoName, gitRevision } from "../../../../contracts/github.ts";
import { projectSubdirectory } from "../../../../server/github/import.ts";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export async function GET(request: Request) {
  return endpoint(request, false, async ({ config, store, session }) => {
    let toolReady = false;
    try {
      toolReady = /^gh version 2\.103\.0\b/.test(
        (
          await githubCommand(config, session.actorId, "cli_private", ["--version"], request.signal)
        ).toString(),
      );
    } catch {
      /* Availability is distinct from a connected account. */
    }
    return reply({
      connection: store.getConnection(session.actorId, "github")?.view ?? null,
      toolReady,
    });
  });
}
export async function DELETE(request: Request) {
  return endpoint(request, true, ({ store, session }) => {
    store.disconnectConnection(session.actorId, "github");
    return reply({ disconnected: true, providerRevoked: false });
  });
}
export async function POST(request: Request) {
  return endpoint(request, true, async ({ config, store, session }) => {
    const input = object(await jsonBody(request)),
      operation = string(input.operation, 32);
    const service = githubLoginService(config, store),
      actor = session.actorId;
    if (operation === "start") {
      exactKeys(input, ["operation"]);
      return reply({ login: service.start(actor) }, 202);
    }
    if (["status", "cancel", "confirm"].includes(operation)) {
      exactKeys(input, ["operation", "id"]);
      const id = string(input.id, 64);
      if (operation === "confirm")
        return reply({ connection: await service.confirm(actor, id, request.signal) });
      return reply({
        login: operation === "cancel" ? service.cancel(actor, id) : service.status(actor, id),
      });
    }
    ensure(
      ["repositories", "branches", "folders"].includes(operation),
      "INVALID_OPERATION",
      "این درخواست GitHub پشتیبانی نمی‌شود.",
    );
    const signal = AbortSignal.any([request.signal, AbortSignal.timeout(120_000)]);
    if (operation === "repositories") {
      exactKeys(input, ["operation", "query", "page"]);
      ensure(typeof input.query === "string", "INVALID_INPUT", "عبارت جست‌وجو معتبر نیست.");
      ensure(
        input.query.length <= 100 && !/[\r\n]/.test(input.query),
        "GITHUB_INPUT_INVALID",
        "جست‌وجو را کوتاه‌تر بنویسید.",
      );
      const page = integer(input.page, 1, 1000);
      const client = await connectedGitHub(config, store, actor, signal);
      return reply(await client.repositories(input.query, page, signal));
    }
    exactKeys(input, [
      "operation",
      "owner",
      "name",
      "repositoryId",
      ...(operation === "branches" ? ["page"] : ["revision", "directory"]),
    ]);
    const owner = githubOwner(input.owner),
      name = githubRepoName(input.name),
      repositoryId = integer(input.repositoryId, 1, Number.MAX_SAFE_INTEGER),
      page = operation === "branches" ? integer(input.page, 1, 1000) : null,
      revision = operation === "folders" ? gitRevision(input.revision) : null,
      directory = operation === "folders" ? projectSubdirectory(input.directory) : null;
    const client = await connectedGitHub(config, store, actor, signal);
    const repository = await client.repository(owner, name, repositoryId, signal);
    if (operation === "branches")
      return reply(await client.branches(repository, page ?? 1, signal));
    ensure(revision && directory, "INVALID_INPUT", "شاخه و پوشه را انتخاب کنید.");
    return reply({
      folders: await client.folders(repository, revision, directory, signal),
    });
  });
}
