export type Scope = Readonly<{ teamId: string; app: string }>;

export type ManifestEntry = Readonly<{
  path: string;
  bytes: number;
  sha256: string;
}>;
export type ProjectProfile = Readonly<{
  directory: string;
  runtime: "node" | "python" | "static" | "docker" | "unknown";
  nodeVersion: string | null;
  // Historical profiles predate runtime selection; fresh inspection always supplies it.
  nodeRuntime?: import("./node-runtime.ts").NodeRuntime;
  pythonRuntime?: import("./python-runtime.ts").PythonRuntime;
  staticRuntime?: import("./static-runtime.ts").StaticRuntime;
  nextRuntime?: import("./next-runtime.ts").NextRuntime;
  frontendRuntime?: import("./frontend-runtime.ts").FrontendRuntime;
  dockerRuntime?: import("./docker-runtime.ts").DockerRuntime;
  nativeInspection?: import("./liara-platform.ts").NativePlatformInspection;
  fullstack?: import("./fullstack.ts").FullstackInspection;
  applicationRequirements?: import("./application-requirements.ts").ApplicationRequirementsInspection;
  sourceFixtureReviews?: readonly import("./source-fixture-review.ts").SourceFixtureReviewEvidence[];
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
export type ActionSpec = (ActionInputs &
  (
    | Readonly<{ version: 1 }>
    | Readonly<{ version: 2; artifactHash: string | null }>
    | Readonly<{
        version: 3;
        artifactHash: string;
        projectFlowId: string;
        selectionHash: string;
      }>
    | Readonly<{
        version: 4;
        artifactHash: string;
        projectFlowId: string;
        selectionHash: string;
        targetAppId: string;
        workload: import("./deployment.ts").WorkloadExpectation;
      }>
    | Readonly<{
        version: 5;
        artifactHash: string;
        projectFlowId: string;
        selectionHash: string;
        targetAppId: string;
        workload: import("./deployment.ts").WorkloadExpectation;
        nodeVersion: import("./node-runtime.ts").NodeVersion;
      }>
    | Readonly<{
        version: 7;
        artifactHash: string;
        projectFlowId: string;
        selectionHash: string;
        accountId: string;
        targetAppId: string;
        workload: import("./deployment.ts").WorkloadContract;
        nodeVersion: import("./node-runtime.ts").NodeVersion;
      }>
    | Readonly<{
        version: 6;
        operation: "restart";
        sourceHash: null;
        args: Readonly<{ port: null; planId: null }>;
        accountId: string;
        targetAppId: string;
        targetPlanId: string;
        targetReleaseId: string;
        incidentRunId: string;
        evidenceHash: string;
        target: import("./deployment.ts").WorkloadTarget;
      }>
    | Readonly<{
        version: 10;
        operation: "deploy";
        sourceHash: string;
        artifactHash: string;
        projectFlowId: string;
        selectionHash: string;
        accountId: string;
        targetAppId: string;
        workload: import("./deployment.ts").WorkloadContract;
        nodeVersion: import("./node-runtime.ts").NodeVersion;
        environment: import("./environment.ts").EnvironmentReference;
      }>
    | Readonly<{
        version: 23; operation: "deploy"; sourceHash: string; artifactHash: string; projectFlowId: string;
        selectionHash: string; accountId: string; targetAppId: string; workload: import("./deployment.ts").WorkloadContract;
        nodeVersion: import("./node-runtime.ts").NodeVersion;
        environment: import("./environment.ts").EnvironmentReference | null;
        verification: import("./fullstack.ts").FullstackVerification;
      }>
    | Readonly<{
        version: 26; operation: "deploy"; sourceHash: string; artifactHash: string; projectFlowId: string;
        selectionHash: string; accountId: string; targetAppId: string; workload: import("./deployment.ts").WorkloadContract;
        nodeVersion: "24"; environment: import("./environment.ts").EnvironmentReference;
        verification: import("./fullstack.ts").FullstackVerification; storage: import("./persistent-disk.ts").DiskBinding;
      }>
    | Readonly<{
        version: 11;
        operation: "deploy";
        sourceHash: string;
        artifactHash: string;
        projectFlowId: string;
        selectionHash: string;
        accountId: string;
        targetAppId: string;
        workload: import("./deployment.ts").WorkloadContract;
        nodeVersion: null;
        runtime: import("./python-runtime.ts").PythonRuntime;
        environment: import("./environment.ts").EnvironmentReference | null;
      }>
    | Readonly<{
        version: 15; operation: "deploy"; sourceHash: string; artifactHash: string; projectFlowId: string;
        selectionHash: string; accountId: string; targetAppId: string; workload: import("./deployment.ts").WorkloadContract;
        nodeVersion: null; runtime: import("./static-runtime.ts").StaticRuntime;
      }>
    | Readonly<{
        version: 17; operation: "deploy"; sourceHash: string; artifactHash: string; projectFlowId: string;
        selectionHash: string; accountId: string; targetAppId: string; workload: import("./deployment.ts").WorkloadContract;
        nodeVersion: import("./node-runtime.ts").NodeVersion; runtime: import("./next-runtime.ts").NextRuntime;
        environment: import("./environment.ts").EnvironmentReference | null;
      }>
    | Readonly<{
        version: 19; operation: "deploy"; sourceHash: string; artifactHash: string; projectFlowId: string;
        selectionHash: string; accountId: string; targetAppId: string; workload: import("./deployment.ts").WorkloadContract;
        nodeVersion: "20"; runtime: import("./frontend-runtime.ts").FrontendRuntime;
        environment: import("./environment.ts").EnvironmentReference | null;
      }>
    | Readonly<{
        version: 21; operation: "deploy"; sourceHash: string; artifactHash: string; projectFlowId: string;
        selectionHash: string; accountId: string; targetAppId: string; workload: import("./deployment.ts").WorkloadContract;
        nodeVersion: null; runtime: import("./docker-runtime.ts").DockerRuntime;
        environment: import("./environment.ts").EnvironmentReference | null;
      }>
  )) | import("./provision.ts").ProvisionSpec | import("./environment.ts").EnvironmentSpec | import("./network.ts").NetworkSpec | import("./project-lifecycle.ts").LifecycleSpec | import("./persistent-disk.ts").DiskSpec | import("./database-provision.ts").DatabaseProvisionSpec;

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
  deployment?: import("./deployment.ts").DeploymentProgress;
  restart?: import("./restart.ts").RestartProgress;
  provision?: import("./provision.ts").ProvisionProgress;
  environment?: import("./environment.ts").EnvironmentProgress;
  network?: import("./network.ts").NetworkProgress;
  lifecycle?: import("./project-lifecycle.ts").LifecycleProgress;
  disk?: import("./persistent-disk.ts").DiskProgress;
  database?: import("./database-provision.ts").DatabaseProvisionProgress;
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
  connections: {
    github: import("./connections.ts").ConnectionView | null;
    liara: import("./connections.ts").ConnectionView | null;
  };
  features: {
    serviceReads: boolean;
    analysis: boolean;
    deployment: boolean;
    probeApps: readonly string[];
    probeOrigin: string | null;
  };
}>;
