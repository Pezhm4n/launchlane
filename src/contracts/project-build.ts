import { parseWorkloadContract, type WorkloadContract } from "./deployment.ts";
import { exactKeys, integer, object, text } from "./validation.ts";
import { ensure } from "../server/errors.ts";
import { parseEnvironmentReference, type EnvironmentReference } from "./environment.ts";
import { parsePythonRuntime, type PythonRuntime, pythonStart } from "./python-runtime.ts";

export const projectBuildImage = "node:22.23.3-bookworm-slim@sha256:3ed98443660ff48413b5af19ecefce3b9d50845a901a43420d47cc63a9fddbe9";

export const pythonBuildImage = "docker.arvancloud.ir/python:3.12-slim@sha256:d764629ce0ddd8c71fd371e9901efb324a95789d2315a47db7e4d27e78f1b0e9";
type NodeBuildPlan = Readonly<{
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
export type PythonBuildPlan = Omit<NodeBuildPlan, "version" | "nodeVersion" | "image"> & Readonly<{
  version: 2; nodeVersion: null; image: typeof pythonBuildImage; runtime: PythonRuntime;
}>;
export type ProjectBuildPlan = NodeBuildPlan | PythonBuildPlan;
export function parseProjectBuildPlan(value: unknown): ProjectBuildPlan {
  const row = object(value);
  if (row.version === 2) {
    const { runtime, ...rest } = row;
    ensure(row.nodeVersion === null && row.image === pythonBuildImage && row.buildCommand === null && row.testCommand === null,
      "BUILD_RUNTIME_UNSUPPORTED", "فرمان و محیط Python باید از برنامه محدود و تثبیت‌شده باشند.", 409);
    const parsed = parsePythonRuntime(runtime);
    ensure(row.startCommand === pythonStart(parsed), "BUILD_PLAN_CHANGED", "فرمان Python با نسخه مصوب برابر نیست.", 409);
    const base = parseProjectBuildPlan({ ...rest, version: 1, nodeVersion: "22", image: projectBuildImage });
    return { ...base, version: 2, nodeVersion: null, image: pythonBuildImage, runtime: parsed };
  }
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
