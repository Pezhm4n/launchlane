import { ensure } from "../server/errors.ts";
import { exactKeys, hash, integer, object, string } from "./validation.ts";
import { applicationSourcePath } from "./application-requirements.ts";
import { parseFullstackApiChecks, type FullstackApiCheck } from "./fullstack.ts";

export type PnpmComponent = Readonly<{
  root: string; name: string; kind: "node" | "static"; outputDirectory: string;
  argv: readonly string[]; internalPort: number; testCommand: string | null;
  remainingRoots: readonly string[];
}>;
export function parsePnpmComponent(value: unknown): PnpmComponent {
  const row = object(value); exactKeys(row, ["root", "name", "kind", "outputDirectory", "argv", "internalPort", "testCommand", "remainingRoots"]);
  const root = applicationSourcePath(row.root, true), outputDirectory = applicationSourcePath(row.outputDirectory), name = string(row.name, 214);
  ensure((row.kind === "node" || row.kind === "static") && Array.isArray(row.argv) && Array.isArray(row.remainingRoots) && row.remainingRoots.length <= 64,
    "COMPONENT_PLAN_INVALID", "نوع و محدودهٔ component باید از همین workspace مشخص باشند.", 409);
  const argv = row.argv.map(arg => string(arg, 240));
  ensure(row.kind === "static" ? argv.length === 0 : argv.length === 1 && argv[0]?.startsWith(`${outputDirectory}/`) && applicationSourcePath(argv[0]) === argv[0] && /\.[cm]?js$/.test(argv[0]),
    "COMPONENT_START_UNSUPPORTED", "این برش start مستقیم Node روی خروجی compiled یا فایل‌های static را اجرا می‌کند؛ CLI یا hook حذف نمی‌شود.", 409);
  return { root, name, kind: row.kind, outputDirectory, argv, internalPort: integer(row.internalPort, 1024, 65535),
    testCommand: row.testCommand === null ? null : string(row.testCommand, 1000), remainingRoots: row.remainingRoots.map(path => applicationSourcePath(path, true)) };
}
export type ComponentVerification = Readonly<{
  version: 1; buildJobId: string; testedSourceHash: string; planHash: string; outputArtifactHash: string;
  component: PnpmComponent; apiChecks: readonly FullstackApiCheck[];
}>;
export function parseComponentVerification(value: unknown): ComponentVerification {
  const row = object(value); exactKeys(row, ["version", "buildJobId", "testedSourceHash", "planHash", "outputArtifactHash", "component", "apiChecks"]);
  const id = string(row.buildJobId, 36), component = parsePnpmComponent(row.component);
  ensure(row.version === 1 && /^[a-f0-9-]{36}$/.test(id) && Array.isArray(row.apiChecks), "COMPONENT_VERIFICATION_INVALID", "گواه component باید به همان job متصل باشد.", 409);
  ensure(component.kind !== "node" || row.apiChecks.length > 0, "COMPONENT_API_REQUIRED", "component سرور به معیار مستقل API نیاز دارد.", 409);
  return { version: 1, buildJobId: id, testedSourceHash: hash(row.testedSourceHash), planHash: hash(row.planHash), outputArtifactHash: hash(row.outputArtifactHash), component,
    apiChecks: row.apiChecks.length ? parseFullstackApiChecks(row.apiChecks) : [] };
}
