import { parseWorkloadContract, type WorkloadContract } from "./deployment.ts";
import { parseEnvironmentReference, parseSourceEnvironmentReference, type EnvironmentReference, type SourceEnvironmentReference } from "./environment.ts";
import { parsePhpRuntime, phpBuildImage, type PhpRuntime } from "./php-runtime.ts";
import { exactKeys, hash, object } from "./validation.ts";
import { ensure } from "../server/errors.ts";

export type PhpBuildPlan = Readonly<{ version: 12; nodeVersion: null; image: typeof phpBuildImage; sourceHash: string; runtime: PhpRuntime; install?: never;
  buildCommand: "composer install --prefer-dist"; testCommand: "phpunit original configuration"; startCommand: "launchlane-installed-php"; port: number;
  workload: Omit<WorkloadContract, "origin">; environment?: EnvironmentReference | null; sourceEnvironment?: SourceEnvironmentReference }>;
export function parsePhpBuild(value: unknown): PhpBuildPlan {
  const row = object(value); exactKeys(row, ["version", "nodeVersion", "image", "sourceHash", "runtime", "buildCommand", "testCommand", "startCommand", "port", "workload", "environment", "sourceEnvironment"]);
  const runtime = parsePhpRuntime(row.runtime), workload = object(row.workload); exactKeys(workload, ["path", "status", "assertion"]);
  const { origin: _origin, ...parsed } = parseWorkloadContract({ ...workload, origin: "https://php-build.invalid" });
  let primaryPath: string;
  try { primaryPath = decodeURIComponent(new URL(parsed.path, "https://php-build.invalid").pathname); } catch { ensure(false, "PHP_BUILD_CHANGED", "مسیر معیار PHP معتبر نیست.", 409); }
  ensure(row.version === 12 && row.nodeVersion === null && row.image === phpBuildImage && row.port === runtime.port && row.buildCommand === "composer install --prefer-dist" &&
    row.testCommand === "phpunit original configuration" && row.startCommand === "launchlane-installed-php" && primaryPath !== "/launchlane-build-proof.json", "PHP_BUILD_CHANGED", "نصب lock اصلی، تست و Apache تولیدی باید در برنامهٔ PHP حفظ شوند.", 409);
  ensure(!(row.environment && row.sourceEnvironment), "ENV_REFERENCE_CHANGED", "یک مرجع تنظیمات خصوصی لازم است.", 409);
  return { version: 12, nodeVersion: null, image: phpBuildImage, sourceHash: hash(row.sourceHash), runtime, buildCommand: "composer install --prefer-dist", testCommand: "phpunit original configuration", startCommand: "launchlane-installed-php", port: runtime.port, workload: parsed,
    ...(row.environment === undefined ? {} : { environment: row.environment === null ? null : parseEnvironmentReference(row.environment) }), ...(row.sourceEnvironment === undefined ? {} : { sourceEnvironment: parseSourceEnvironmentReference(row.sourceEnvironment) }) };
}
