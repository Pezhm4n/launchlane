import { parseWorkloadContract, type WorkloadContract } from "./deployment.ts";
import { exactKeys, integer, object, text } from "./validation.ts";
import { ensure } from "../server/errors.ts";
import { parseEnvironmentReference, type EnvironmentReference } from "./environment.ts";

export const projectBuildImage = "node:22.23.3-bookworm-slim@sha256:3ed98443660ff48413b5af19ecefce3b9d50845a901a43420d47cc63a9fddbe9";

export type ProjectBuildPlan = Readonly<{
  version: 1;
  nodeVersion: "22";
  image: typeof projectBuildImage;
  buildCommand: string | null;
  testCommand: string | null;
  startCommand: string;
  port: number;
  workload: Omit<WorkloadContract, "origin">;
  environment?: EnvironmentReference | null;
}>;
export function parseProjectBuildPlan(value: unknown): ProjectBuildPlan {
  const row = object(value);
  exactKeys(row, ["version", "nodeVersion", "image", "buildCommand", "testCommand", "startCommand", "port", "workload", "environment"]);
  ensure(row.version === 1 && row.nodeVersion === "22" && row.image === projectBuildImage, "BUILD_RUNTIME_UNSUPPORTED", "محیط build فعلی برای image تثبیت‌شده Node 22 است؛ تغییر محیط، تصمیم تازه لازم دارد.", 409);
  const workload = object(row.workload);
  exactKeys(workload, ["path", "status", "assertion"]);
  const { origin: _origin, ...parsed } = parseWorkloadContract({ ...workload, origin: "https://build.invalid" });
  return { version: 1, nodeVersion: "22", image: projectBuildImage, buildCommand: row.buildCommand === null ? null : text(row.buildCommand, 1000),
    testCommand: row.testCommand === undefined || row.testCommand === null ? null : text(row.testCommand, 1000),
    startCommand: text(row.startCommand, 1000), port: integer(row.port, 1, 65535), workload: parsed,
    ...(row.environment === undefined ? {} : { environment: row.environment === null ? null : parseEnvironmentReference(row.environment) }) };
}
