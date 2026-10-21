import { gzipSync } from "node:zlib";
import { pack } from "tar-stream";
import { readConfig } from "../src/server/config.ts";
import { prepareProjectFlow } from "../src/server/application/project-flows.ts";
import { GitHubClient } from "../src/server/github/client.ts";
import { parseEvidenceBundle } from "../src/contracts/incident.ts";
import { practiceEvidence } from "../src/server/incident/practice.ts";
import { createLiveIncidentRun, recheckIncidentRun } from "../src/server/incident/runs.ts";

// Only the isolated test process imports this module; product routes keep their real adapters.
export function browserConfig(server) {
  return readConfig({
    LAUNCHLANE_ORIGIN: server.origin,
    LAUNCHLANE_STATE_DIR: server.stateDir,
    LAUNCHLANE_WORKSPACE_ROOT: server.workspace,
    LAUNCHLANE_SESSION_SECRET: server.sessionSecret,
    LAUNCHLANE_OPERATOR_TOKEN: server.token,
    LIARA_TEAM_ID: server.teamId,
    LAUNCHLANE_APP_ALLOWLIST: server.app,
    LAUNCHLANE_ENABLE_LIVE_LIARA: "true",
  });
}

export async function importedProject(server, store, actorId, selection) {
  const archive = pack(),
    parts = [];
  const bytes = (async () => {
    for await (const part of archive) parts.push(part);
    return gzipSync(Buffer.concat(parts));
  })();
  for (const [name, content] of [
    [
      "package.json",
      JSON.stringify({ name: "synthetic-import", scripts: { start: "node server.mjs" } }),
    ],
    ["server.mjs", "throw new Error('untrusted source must never run'); app.listen(3000)"],
    [".env.local", "PRIVATE=synthetic-do-not-import"],
  ])
    archive.entry({ name: `repository/${selection.directory}/${name}` }, content);
  archive.finalize();
  const compressed = await bytes;
  const client = new GitHubClient(async (path) => ({
    status: 200,
    hasNext: false,
    rateLimited: false,
    body: path.includes("tarball")
      ? compressed
      : Buffer.from(
          JSON.stringify(
            path.includes("branches")
              ? { name: selection.branch, commit: { sha: selection.revision } }
              : {
                  id: selection.repositoryId,
                  name: selection.name,
                  owner: { login: selection.owner },
                  full_name: `${selection.owner}/${selection.name}`,
                  private: true,
                  default_branch: "main",
                },
          ),
        ),
  }));
  return prepareProjectFlow(
    browserConfig(server),
    store,
    actorId,
    selection,
    AbortSignal.timeout(5000),
    client,
  );
}

export async function incidentResponse(server, store, actorId, input, status) {
  const reader = async (_config, selected) => {
    const base = practiceEvidence("configuration", Date.now());
    return parseEvidenceBundle({
      ...base,
      mode: "provider_contract",
      scope: { teamId: server.teamId, app: server.app },
      entries: base.entries.map((entry) =>
        entry.fact?.kind === "http"
          ? {
              ...entry,
              fact: {
                kind: "http",
                origin: "https://sample.example.com",
                path: selected.path,
                status,
                durationMs: 24,
              },
            }
          : entry,
      ),
    });
  };
  const config = browserConfig(server),
    signal = AbortSignal.timeout(5000);
  return input.operation === "recheck"
    ? recheckIncidentRun(config, store, actorId, input.id, signal, reader)
    : createLiveIncidentRun(config, store, actorId, input, signal, reader);
}
