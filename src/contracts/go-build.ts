import { parseWorkloadContract, type WorkloadContract } from "./deployment.ts";
import { parseEnvironmentReference, parseSourceEnvironmentReference } from "./environment.ts";
import { parseGoRuntime, executablePort, type GoRuntime } from "./go-runtime.ts";
import { exactKeys, hash, object } from "./validation.ts";
import { ensure } from "../server/errors.ts";

export type GoBuildPlan = Readonly<{
  version: 11; nodeVersion: null; image: typeof import("./project-build.ts").projectBuildImage; sourceHash: string; runtime: GoRuntime; install?: never;
  buildCommand: "go build -mod=readonly -trimpath -buildvcs=false";
  testCommand: "go test -json -count=1 -mod=readonly ./..."; startCommand: "launchlane-compiled-go"; port: 8080 | 8081;
  workload: Omit<WorkloadContract, "origin">;
  environment?: import("./environment.ts").EnvironmentReference | null;
  sourceEnvironment?: import("./environment.ts").SourceEnvironmentReference;
}>;
export function parseGoBuild(value: unknown, image: GoBuildPlan["image"]): GoBuildPlan {
  const row = object(value); exactKeys(row, ["version", "nodeVersion", "image", "sourceHash", "runtime", "buildCommand", "testCommand", "startCommand", "port", "workload", "environment", "sourceEnvironment"]);
  const runtime = parseGoRuntime(row.runtime), workload = object(row.workload); exactKeys(workload, ["path", "status", "assertion"]);
  const { origin: _origin, ...parsed } = parseWorkloadContract({ ...workload, origin: "https://go-build.invalid" });
  ensure(row.version === 11 && row.nodeVersion === null && row.image === image && row.port === executablePort(runtime) &&
    row.buildCommand === "go build -mod=readonly -trimpath -buildvcs=false" && row.testCommand === "go test -json -count=1 -mod=readonly ./..." && row.startCommand === "launchlane-compiled-go" && parsed.path !== "/launchlane-build-proof.json",
    "GO_BUILD_CHANGED", "برنامهٔ Go باید تست‌های اصلی، compiler و اجرای باینری compiled را حفظ کند؛ پورت 8080 برای بررسی‌کننده رزرو است.", 409);
  ensure(!(row.environment && row.sourceEnvironment), "ENV_REFERENCE_CHANGED", "ساخت دو منبع تنظیمات متفاوت نمی‌پذیرد.", 409);
  return { version: 11, nodeVersion: null, image, sourceHash: hash(row.sourceHash), runtime, buildCommand: "go build -mod=readonly -trimpath -buildvcs=false",
    testCommand: "go test -json -count=1 -mod=readonly ./...", startCommand: "launchlane-compiled-go", port: executablePort(runtime), workload: parsed,
    ...(row.environment === undefined ? {} : { environment: row.environment === null ? null : parseEnvironmentReference(row.environment) }),
    ...(row.sourceEnvironment === undefined ? {} : { sourceEnvironment: parseSourceEnvironmentReference(row.sourceEnvironment) }) };
}
