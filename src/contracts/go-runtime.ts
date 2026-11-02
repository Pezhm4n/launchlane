import { ensure } from "../server/errors.ts";
import { exactKeys, hash, integer, object, string } from "./validation.ts";

export const goToolchain = Object.freeze({ version: "1.25.14", filename: "go1.25.14.linux-amd64.tar.gz",
  sha256: "a21ae5633a269bcd7e90cf767e48225633795e99d831742cbf3397064fee7712", bytes: 59909419 });
export type GoRuntime = Readonly<{ kind: "go"; version: "1.25.14"; packagePath: string; port: number }>;
export function executablePort(runtime: GoRuntime): 8080 | 8081 { return runtime.port === 8080 ? 8081 : 8080; }
export function parseGoRuntime(value: unknown): GoRuntime {
  const row = object(value); exactKeys(row, ["kind", "version", "packagePath", "port"]);
  const packagePath = string(row.packagePath, 200);
  ensure(row.kind === "go" && row.version === goToolchain.version && (packagePath === "." || /^\.\/(?:[A-Za-z_][A-Za-z0-9_-]*\/)*[A-Za-z_][A-Za-z0-9_-]*$/.test(packagePath)),
    "GO_RUNTIME_UNSUPPORTED", "بستهٔ اجرایی و toolchain تثبیت‌شدهٔ Go باید از source مشخص باشند.", 409);
  return { kind: "go", version: "1.25.14", packagePath, port: integer(row.port, 1024, 65535) };
}
export type ExecutableVerification = Readonly<{ version: 1; buildJobId: string; testedSourceHash: string; planHash: string; outputArtifactHash: string; runtime: GoRuntime }>;
export function parseExecutableVerification(value: unknown): ExecutableVerification {
  const row = object(value); exactKeys(row, ["version", "buildJobId", "testedSourceHash", "planHash", "outputArtifactHash", "runtime"]);
  const buildJobId = string(row.buildJobId, 36);
  ensure(row.version === 1 && /^[a-f0-9-]{36}$/.test(buildJobId), "EXECUTABLE_BUILD_REQUIRED", "گواه برنامهٔ compiled معتبر نیست.", 409);
  return { version: 1, buildJobId, testedSourceHash: hash(row.testedSourceHash), planHash: hash(row.planHash), outputArtifactHash: hash(row.outputArtifactHash), runtime: parseGoRuntime(row.runtime) };
}
