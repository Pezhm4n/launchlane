import { parseWorkloadContract, type WorkloadContract } from "./deployment.ts";
import { exactKeys, integer, object, text } from "./validation.ts";
import { ensure } from "../server/errors.ts";
import { parseEnvironmentReference, parseSourceEnvironmentReference, type EnvironmentReference, type SourceEnvironmentReference } from "./environment.ts";
import { parsePythonRuntime, type PythonRuntime, pythonStart } from "./python-runtime.ts";
import { parseFrontendRuntime, type FrontendRuntime } from "./frontend-runtime.ts";
import { parseDockerBuildPlan, type DockerBuildPlan } from "./docker-build.ts";
import { fullstackTestCommand, parseFullstackApiChecks, parseFullstackPreparation, type FullstackPreparation, type FullstackApiCheck } from "./fullstack.ts";
import { parseDisposableTestDatabase, type DisposableTestDatabase } from "./test-database.ts";

export const projectBuildImage = "node:22.23.3-bookworm-slim@sha256:3ed98443660ff48413b5af19ecefce3b9d50845a901a43420d47cc63a9fddbe9";
export const node24BuildImage = "node:24.18.0-bookworm-slim@sha256:6f7b03f7c2c8e2e784dcf9295400527b9b1270fd37b7e9a7285cf83b6951452d";

export const pythonBuildImage = "docker.arvancloud.ir/python:3.12-slim@sha256:d764629ce0ddd8c71fd371e9901efb324a95789d2315a47db7e4d27e78f1b0e9";
type NodeBuildPlan = Readonly<{
  version: 1;
  nodeVersion: "22";
  image: typeof projectBuildImage;
  install?: "none";
  buildCommand: string | null;
  testCommand: string | null;
  startCommand: string;
  port: number;
  workload: Omit<WorkloadContract, "origin">;
  environment?: EnvironmentReference | null;
  sourceEnvironment?: SourceEnvironmentReference;
}>;
export type PythonBuildPlan = Omit<NodeBuildPlan, "version" | "nodeVersion" | "image"> & Readonly<{
  version: 2; nodeVersion: null; image: typeof pythonBuildImage; runtime: PythonRuntime;
}>;
type Node24BuildPlan = Omit<NodeBuildPlan, "version" | "nodeVersion" | "image"> & Readonly<{
  version: 3; nodeVersion: "24"; image: typeof node24BuildImage;
}>;
export const node20BuildImage = "docker.io/library/node:20-bookworm-slim@sha256:2cf067cfed83d5ea958367df9f966191a942351a2df77d6f0193e162b5febfc0";
type Node20BuildPlan = Omit<NodeBuildPlan, "version" | "nodeVersion" | "image"> & Readonly<{ version: 4; nodeVersion: "20"; image: typeof node20BuildImage }>;
type FrontendBuildPlan = Omit<Node20BuildPlan, "version" | "install"> & Readonly<{ version: 5; frontend: FrontendRuntime; install?: never }>;
export type FullstackBuildPlan = Omit<NodeBuildPlan, "version" | "nodeVersion" | "image" | "install"> & Readonly<{
  version: 7; nodeVersion: "22" | "24"; image: typeof projectBuildImage | typeof node24BuildImage;
  fullstack: FullstackPreparation; apiChecks: readonly FullstackApiCheck[]; install?: never;
  testDatabase?: DisposableTestDatabase;
}>;
export type ProjectBuildPlan = NodeBuildPlan | PythonBuildPlan | Node24BuildPlan | Node20BuildPlan | FrontendBuildPlan | DockerBuildPlan | FullstackBuildPlan;
export function nodeBuildRuntime(version: unknown) {
  ensure(version === "20" || version === "22" || version === "24", "BUILD_RUNTIME_UNSUPPORTED", "محیط ساخت سازگار با نسخهٔ پروژه در این نصب آماده نیست؛ اجرای ناسازگار روی رایانه انجام نشد.", 409);
  return version === "20" ? { version: 4, nodeVersion: "20", image: node20BuildImage } as const : version === "24" ? { version: 3, nodeVersion: "24", image: node24BuildImage } as const
    : { version: 1, nodeVersion: "22", image: projectBuildImage } as const;
}
export function parseProjectBuildPlan<V extends ProjectBuildPlan["version"]>(value: { version: V; [key: string]: unknown }): Extract<ProjectBuildPlan, { version: V }>;
export function parseProjectBuildPlan(value: unknown): ProjectBuildPlan;
export function parseProjectBuildPlan(value: unknown): ProjectBuildPlan {
  const row = object(value);
  if (row.version === 6) return parseDockerBuildPlan(row);
  if (row.version === 7) {
    const { fullstack, apiChecks, testDatabase, ...rest } = row, preparation = parseFullstackPreparation(fullstack);
    ensure(testDatabase === undefined || row.sourceEnvironment === undefined && (row.environment === undefined || row.environment === null) && preparation.testScripts.length > 0 && row.port !== 5432,
      "TEST_DATABASE_ENVIRONMENT_DENIED", "آزمون با دادهٔ ساختگی نباید تنظیمات واقعی پروژه را دریافت کند و باید تست اصلی داشته باشد.",409);
    ensure(row.install === undefined && row.nodeVersion === preparation.nodeVersion && row.image === (preparation.nodeVersion === "22" ? projectBuildImage : node24BuildImage) &&
      row.startCommand === preparation.startCommand && row.buildCommand === preparation.buildCommand && row.port === preparation.port && row.testCommand === fullstackTestCommand(preparation),
      "FULLSTACK_BUILD_CHANGED", "محیط، فرمان‌ها و پورت ساخت باید با برنامهٔ کامل مصوب برابر باشند.", 409);
    const base = parseProjectBuildPlan({ ...rest, version: 1, nodeVersion: "22", image: projectBuildImage });
    const { install: _install, ...fields } = base;
    return { ...fields, version: 7, nodeVersion: preparation.nodeVersion, image: preparation.nodeVersion === "22" ? projectBuildImage : node24BuildImage,
      fullstack: preparation, apiChecks: parseFullstackApiChecks(apiChecks),
      ...(testDatabase === undefined ? {} : {testDatabase:parseDisposableTestDatabase(testDatabase)}) };
  }
  if (row.version === 5) {
    const { frontend, ...rest } = row, parsed = parseFrontendRuntime(frontend);
    ensure(row.install === undefined && row.nodeVersion === parsed.nodeVersion && row.startCommand === "liara-frontend" && typeof row.buildCommand === "string" && row.port === 80,
      "BUILD_PLAN_CHANGED", "ساخت رابط باید خروجی بومی و پورت ثابت وب را بررسی کند.", 409);
    const base = parseProjectBuildPlan({ ...rest, version: 4 });
    ensure(base.version === 4, "BUILD_PLAN_CHANGED", "محیط ساخت رابط معتبر نیست.", 409);
    const { install: _install, ...fields } = base;
    return { ...fields, version: 5, frontend: parsed };
  }
  if (row.version === 4) {
    ensure(row.nodeVersion === "20" && row.image === node20BuildImage, "BUILD_RUNTIME_UNSUPPORTED", "نسخه Node20 و image برابر نیستند.", 409);
    const base = parseProjectBuildPlan({ ...row, version: 1, nodeVersion: "22", image: projectBuildImage });
    return { ...base, version: 4, nodeVersion: "20", image: node20BuildImage };
  }
  if (row.version === 3) {
    ensure(row.nodeVersion === "24" && row.image === node24BuildImage, "BUILD_RUNTIME_UNSUPPORTED", "نسخهٔ Node و تصویر محیط ساخت برابر نیستند؛ برنامهٔ تازه لازم است.", 409);
    const base = parseProjectBuildPlan({ ...row, version: 1, nodeVersion: "22", image: projectBuildImage });
    return { ...base, version: 3, nodeVersion: "24", image: node24BuildImage };
  }
  if (row.version === 2) {
    ensure(row.install === undefined, "BUILD_INSTALL_SCOPE", "قرارداد Python نمی‌تواند نصب وابستگی را حذف کند.", 409);
    const { runtime, ...rest } = row;
    ensure(row.nodeVersion === null && row.image === pythonBuildImage && row.buildCommand === null && row.testCommand === null,
      "BUILD_RUNTIME_UNSUPPORTED", "فرمان و محیط Python باید از برنامه محدود و تثبیت‌شده باشند.", 409);
    const parsed = parsePythonRuntime(runtime);
    ensure(row.startCommand === pythonStart(parsed), "BUILD_PLAN_CHANGED", "فرمان Python با نسخه مصوب برابر نیست.", 409);
    const base = parseProjectBuildPlan({ ...rest, version: 1, nodeVersion: "22", image: projectBuildImage });
    return { ...base, version: 2, nodeVersion: null, image: pythonBuildImage, runtime: parsed };
  }
  exactKeys(row, ["version", "nodeVersion", "image", "install", "buildCommand", "testCommand", "startCommand", "port", "workload", "environment", "sourceEnvironment"]);
  ensure(row.sourceEnvironment === undefined || row.environment === undefined || row.environment === null, "INVALID_ENV_REFERENCE", "دو منبع هم‌زمان تنظیمات برای ساخت مجاز نیست.");
  ensure(row.install === undefined || row.install === "none", "BUILD_INSTALL_SCOPE", "روش نصب معتبر نیست.", 409);
  ensure(row.version === 1 && row.nodeVersion === "22" && row.image === projectBuildImage, "BUILD_RUNTIME_UNSUPPORTED", "محیط build فعلی برای image تثبیت‌شده Node 22 است؛ تغییر محیط، تصمیم تازه لازم دارد.", 409);
  const workload = object(row.workload);
  exactKeys(workload, ["path", "status", "assertion"]);
  const { origin: _origin, ...parsed } = parseWorkloadContract({ ...workload, origin: "https://build.invalid" });
  return { version: 1, nodeVersion: "22", image: projectBuildImage, buildCommand: row.buildCommand === null ? null : text(row.buildCommand, 1000),
    testCommand: row.testCommand === undefined || row.testCommand === null ? null : text(row.testCommand, 1000),
    startCommand: text(row.startCommand, 1000), port: integer(row.port, 1, 65535), workload: parsed,
    ...(row.install === "none" ? { install: "none" as const } : {}),
    ...(row.environment === undefined ? {} : { environment: row.environment === null ? null : parseEnvironmentReference(row.environment) }),
    ...(row.sourceEnvironment === undefined ? {} : { sourceEnvironment: parseSourceEnvironmentReference(row.sourceEnvironment) }) };
}
