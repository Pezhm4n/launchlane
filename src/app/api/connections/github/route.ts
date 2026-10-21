import { exactKeys, integer, object, string } from "../../../../contracts/validation.ts";
import { endpoint, jsonBody, reply } from "../../../../server/http.ts";
import { githubCommand } from "../../../../server/github/cli.ts";
import { connectedGitHub, githubLoginService } from "../../../../server/github/login.ts";
import { ensure } from "../../../../server/errors.ts";

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
    const client = await connectedGitHub(config, store, actor, signal);
    if (operation === "repositories") {
      exactKeys(input, ["operation", "query", "page"]);
      ensure(typeof input.query === "string", "INVALID_INPUT", "عبارت جست‌وجو معتبر نیست.");
      return reply(await client.repositories(input.query, integer(input.page, 1, 1000), signal));
    }
    exactKeys(input, [
      "operation",
      "owner",
      "name",
      "repositoryId",
      ...(operation === "branches" ? ["page"] : ["revision", "directory"]),
    ]);
    const repository = await client.repository(
      string(input.owner, 39),
      string(input.name, 100),
      integer(input.repositoryId, 1, Number.MAX_SAFE_INTEGER),
      signal,
    );
    if (operation === "branches")
      return reply(await client.branches(repository, integer(input.page, 1, 1000), signal));
    const directory = string(input.directory, 240);
    ensure(
      directory === "." ||
        directory
          .split("/")
          .every((part) => /^[\p{L}\p{N}._ @()+-]+$/u.test(part) && part !== "." && part !== ".."),
      "UNSAFE_PATH",
      "زیرپوشه را از فهرست مخزن انتخاب کنید.",
      403,
    );
    return reply({
      folders: await client.folders(repository, string(input.revision, 40), directory, signal),
    });
  });
}
