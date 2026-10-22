import type { Action, ProjectProfile, SourceArtifact } from "./domain.ts";
import { decodeProfile } from "./client-decode.ts";
import { githubOwner, githubRepoName, gitRevision } from "./github.ts";
import { parseArtifact } from "./source.ts";
import { hash, integer, object, string } from "./validation.ts";
import { ensure } from "../server/errors.ts";
export type ProjectSelection =
  | { kind: "local" | "sample"; directory: string }
  | {kind:"repair";directory:".";jobId:string;artifactHash:string}
  | {
      kind: "github";
      directory: string;
      repositoryId: number;
      owner: string;
      name: string;
      branch: string;
      revision: string;
    };
export type ProjectFlow = {
  displayName?: string;
  id: string;
  selection: ProjectSelection;
  selectionHash: string;
  profile: ProjectProfile;
  artifact: SourceArtifact | null;
  status: "ready" | "incomplete" | "stale" | "unavailable";
  message: string | null;
  updatedAt: number;
  actionId: string | null;
};
export type ProjectFlowResponse = { flow: ProjectFlow; action: Action | null };
export function parseSelection(value: unknown): ProjectSelection {
  const row = object(value);
  ensure(
    row.kind === "local" || row.kind === "sample" || row.kind === "github" || row.kind === "repair",
    "INVALID_INPUT",
    "روش انتخاب پروژه معتبر نیست.",
  );
  const directory = string(row.directory, 240);
  if(row.kind==="repair") {
    const jobId=string(row.jobId,36);ensure(directory==="."&&/^[a-f0-9-]{36}$/.test(jobId),"INVALID_INPUT","نسخه اصلاح‌شده معتبر نیست.");
    return {kind:"repair",directory:".",jobId,artifactHash:hash(row.artifactHash)};
  }
  if (row.kind !== "github") return { kind: row.kind, directory };
  return {
    kind: "github",
    directory,
    repositoryId: integer(row.repositoryId, 1, Number.MAX_SAFE_INTEGER),
    owner: githubOwner(row.owner),
    name: githubRepoName(row.name),
    branch: string(row.branch, 256),
    revision: gitRevision(row.revision),
  };
}
export function parseProjectFlow(value: unknown): ProjectFlow {
  const row = object(value);
  ensure(
    ["ready", "incomplete", "stale", "unavailable"].includes(String(row.status)),
    "INVALID_RESPONSE",
    "وضعیت پروژه معتبر نیست.",
  );
  const status = row.status;
  ensure(
    status === "ready" || status === "incomplete" || status === "stale" || status === "unavailable",
    "INVALID_RESPONSE",
    "وضعیت پروژه معتبر نیست.",
  );
  return {
    ...(row.displayName === undefined ? {} : { displayName: string(row.displayName, 512) }),
    id: string(row.id, 36),
    selection: parseSelection(row.selection),
    selectionHash: hash(row.selectionHash),
    profile: decodeProfile({ profile: row.profile }),
    artifact: row.artifact === null ? null : parseArtifact(row.artifact),
    status,
    message: row.message === null ? null : string(row.message, 1000),
    updatedAt: integer(row.updatedAt, 0, Number.MAX_SAFE_INTEGER),
    actionId: row.actionId === null ? null : string(row.actionId, 36),
  };
}
