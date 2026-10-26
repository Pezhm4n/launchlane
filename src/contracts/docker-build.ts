import { ensure } from "../server/errors.ts";
import { parseDockerRuntime, type DockerRuntime } from "./docker-runtime.ts";
import { parseWorkloadContract, type WorkloadContract } from "./deployment.ts";
import { parseEnvironmentReference, type EnvironmentReference } from "./environment.ts";
import { exactKeys, hash, object, string } from "./validation.ts";

// This trusted verifier runs separately from the application's entrypoint and stdout.
export const dockerVerifierImage = "node:22.23.3-bookworm-slim@sha256:3ed98443660ff48413b5af19ecefce3b9d50845a901a43420d47cc63a9fddbe9";
export type DockerBuildPlan = Readonly<{
  version: 6;
  nodeVersion: null;
  image: null;
  install?: never;
  runtime: DockerRuntime;
  sourceHash: string;
  baseImages: readonly string[];
  verifierImage: typeof dockerVerifierImage;
  buildCommand: null;
  testCommand: null;
  startCommand: "liara-docker";
  port: number;
  workload: Omit<WorkloadContract, "origin">;
  environment?: EnvironmentReference | null;
}>;

export function pinnedDockerImage(value: unknown): string {
  const image = string(value, 280);
  ensure(/^[a-z0-9][a-z0-9._:/-]{0,190}@sha256:[a-f0-9]{64}$/.test(image) &&
    !image.includes("//") && image.split("/").every(part => part !== "." && part !== ".."),
    "DOCKER_BASE_UNPINNED", "image پایه باید مرجع صریح با digest SHA256 داشته باشد؛ tag شناور یا pull خودکار مجاز نیست.", 409);
  return image;
}

export function parseDockerBuildPlan(value: unknown): DockerBuildPlan {
  const row = object(value);
  exactKeys(row, ["version", "nodeVersion", "image", "runtime", "sourceHash", "baseImages", "verifierImage", "buildCommand", "testCommand", "startCommand", "port", "workload", "environment"]);
  const runtime = parseDockerRuntime(row.runtime);
  ensure(row.version === 6 && row.nodeVersion === null && row.image === null && row.verifierImage === dockerVerifierImage &&
    row.buildCommand === null && row.testCommand === null && row.startCommand === "liara-docker" && row.port === runtime.port &&
    Array.isArray(row.baseImages) && row.baseImages.length <= 16,
    "DOCKER_BUILD_PLAN_CHANGED", "برنامهٔ ساخت باید به همان Dockerfile، پورت، بررسی‌کننده و source متصل باشد؛ image خروجی هنوز ساخته نشده است.", 409);
  const baseImages = row.baseImages.map(pinnedDockerImage);
  ensure(new Set(baseImages).size === baseImages.length, "DOCKER_BUILD_PLAN_CHANGED", "مرجع image پایه تکراری است.", 409);
  const workload = object(row.workload); exactKeys(workload, ["path", "status", "assertion"]);
  const { origin: _origin, ...parsed } = parseWorkloadContract({ ...workload, origin: "https://docker-build.invalid" });
  return { version: 6, nodeVersion: null, image: null, runtime, sourceHash: hash(row.sourceHash), baseImages,
    verifierImage: dockerVerifierImage, buildCommand: null, testCommand: null, startCommand: "liara-docker", port: runtime.port, workload: parsed,
    ...(row.environment === undefined ? {} : { environment: row.environment === null ? null : parseEnvironmentReference(row.environment) }) };
}
