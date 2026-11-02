import { ensure } from "../server/errors.ts";
import { exactKeys, hash, integer, object, string } from "./validation.ts";

export const phpBuildImage = "docker.arvancloud.ir/php@sha256:1d6dadc914463434ecc4a981df24b4cf688585ce7ca091bf05a8c84e25036995";
export const composerTool = Object.freeze({ version: "2.11.1", bytes: 3797852, sha256: "6f1b891e1d4927d62740276c540fb490e47689e19e102c49e8da849794882f8c" });
export const phpUnzipTool = Object.freeze({ bytes: 166504, sha256: "1c27c879f4f7f056499c5393d422fd6c77ff6fbfa450c3f91f2f205ca788cc36",
  url: "https://security.debian.org/debian-security/pool/updates/main/u/unzip/unzip_6.0-28+deb12u1_amd64.deb" });
export type PhpRuntime = Readonly<{ kind: "php" | "laravel"; version: "8.3.36"; documentRoot: "." | "public"; testConfiguration: "phpunit.xml" | "phpunit.xml.dist"; port: number }>;
export function parsePhpRuntime(value: unknown): PhpRuntime {
  const row = object(value); exactKeys(row, ["kind", "version", "documentRoot", "testConfiguration", "port"]);
  ensure((row.kind === "php" || row.kind === "laravel") && row.version === "8.3.36" && (row.documentRoot === "." || row.documentRoot === "public") &&
    (row.testConfiguration === "phpunit.xml" || row.testConfiguration === "phpunit.xml.dist") && (row.kind !== "laravel" || row.documentRoot === "public"), "PHP_RUNTIME_UNSUPPORTED", "نسخهٔ PHP، document root و تنظیمات تست باید از source مشخص باشند.", 409);
  return { kind: row.kind, version: "8.3.36", documentRoot: row.documentRoot, testConfiguration: row.testConfiguration, port: integer(row.port, 1024, 65535) };
}
export type PhpVerification = Readonly<{ version: 1; buildJobId: string; testedSourceHash: string; planHash: string; outputArtifactHash: string; runtime: PhpRuntime }>;
export function parsePhpVerification(value: unknown): PhpVerification {
  const row = object(value); exactKeys(row, ["version", "buildJobId", "testedSourceHash", "planHash", "outputArtifactHash", "runtime"]);
  const buildJobId = string(row.buildJobId, 36); ensure(row.version === 1 && /^[a-f0-9-]{36}$/.test(buildJobId), "PHP_BUILD_REQUIRED", "رسید نصب PHP به همان job نیاز دارد.", 409);
  return { version: 1, buildJobId, testedSourceHash: hash(row.testedSourceHash), planHash: hash(row.planHash), outputArtifactHash: hash(row.outputArtifactHash), runtime: parsePhpRuntime(row.runtime) };
}
