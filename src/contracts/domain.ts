export type Scope = Readonly<{ teamId: string; app: string }>;

export type ManifestEntry = Readonly<{
  path: string;
  bytes: number;
  sha256: string;
}>;
export type ProjectProfile = Readonly<{
  directory: string;
  runtime: "node" | "unknown";
  nodeVersion: string | null;
  port: number | null;
  start: string | null;
  build: string | null;
  envNames: readonly string[];
  missing: readonly string[];
  manifest: readonly ManifestEntry[];
  sourceHash: string;
  totalBytes: number;
  excludedCount: number;
  inspectedAt: string;
}>;

export type SourceArtifact = Readonly<{
  format: "tar.gz";
  archiveHash: string;
  sourceHash: string;
  bytes: number;
  fileCount: number;
  createdAt: number;
}>;

type ActionInputs = Readonly<{
  scope: Scope;
  operation: "deploy" | "restart";
  sourceHash: string | null;
  args: Readonly<{ port: number | null; planId: string | null }>;
}>;

// Keep v1 byte-for-byte canonicalizable: existing approvals must not acquire new inputs.
export type ActionSpec = ActionInputs &
  (
    | Readonly<{ version: 1 }>
    | Readonly<{ version: 2; artifactHash: string | null }>
    | Readonly<{ version: 3; artifactHash: string; projectFlowId: string; selectionHash: string }>
  );

export type ActionState =
  | "awaiting_approval"
  | "approved"
  | "cancelled"
  | "expired"
  | "executing"
  | "observing"
  | "uncertain"
  | "succeeded"
  | "failed";

export type Action = Readonly<{
  id: string;
  actorId: string;
  spec: ActionSpec;
  hash: string;
  state: ActionState;
  createdAt: number;
  expiresAt: number;
  attemptId: string | null;
  remoteId: string | null;
  errorCode: string | null;
}>;

export type Session = Readonly<{
  id: string;
  actorId: string;
  csrfToken: string;
  expiresAt: number;
}>;

export type Capability = Readonly<{
  state: "available" | "unavailable" | "unverified";
  reason: string;
  nextStep: string;
}>;

export type Capabilities = Readonly<{
  evidence: "local";
  workspace: Capability;
  liara: Capability;
  model: Capability;
  mutations: Capability;
  scope: { teamId: string | null; apps: readonly string[] };
}>;

export type WorkspaceView = Readonly<{
  session: { csrfToken: string; expiresAt: number };
  capabilities: Capabilities;
  actions: readonly Action[];
  storage: "available" | "unavailable";
}>;
