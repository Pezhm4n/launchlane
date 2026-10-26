import { ensure } from "../server/errors.ts";
import { exactKeys, hasControl, integer, object, string } from "./validation.ts";

// Documentation snapshot, not account availability or a claim of executable support.
export const liaraPlatformDocumentationDate = "2026-10-25";
export const liaraPlatforms = ["node", "next", "laravel", "php", "python", "django", "flask", "dotnet", "go", "react", "angular", "vue", "static", "docker"] as const;
export type LiaraPlatform = typeof liaraPlatforms[number];
export type NativeLiaraPlatform = "laravel" | "php" | "django" | "flask" | "dotnet" | "go" | "docker";
export type LiaraPlatformDocumentation = Readonly<{
  url: string;
  versionUrl: string | null;
  versions: readonly string[] | null;
  documentedDefault: string | null;
  versionField: string | null;
  selectableVersion: boolean;
}>;
const pythonVersions = ["3.7", "3.8", "3.9", "3.10", "3.11", "3.12", "3.13"] as const;
function documentation(path: string, versions: readonly string[] | null, documentedDefault: string | null, versionField: string | null, selectableVersion = true): LiaraPlatformDocumentation {
  return { url: `https://docs.liara.ir/paas/${path}/how-tos/deploy-app/`,
    versionUrl: versions ? `https://docs.liara.ir/paas/${path}/how-tos/choose-version/` : null,
    versions, documentedDefault, versionField, selectableVersion: selectableVersion && versions !== null };
}
export const liaraPlatformDocumentation: Readonly<Record<LiaraPlatform, LiaraPlatformDocumentation>> = {
  node: documentation("nodejs", ["8", "10", "12", "14", "16", "18", "20", "22", "24"], "22", "node.version"),
  next: documentation("nextjs", ["20", "22", "24"], "22", "next.nodeVersion"),
  laravel: documentation("laravel", ["7.2", "7.3", "7.4", "8.0", "8.1", "8.2", "8.3", "8.4"], "7.4", "laravel.phpVersion"),
  php: documentation("php", ["7.2", "7.3", "7.4", "8.0", "8.1", "8.2", "8.3"], "8.0", "php.version"),
  python: documentation("python", pythonVersions, "3.12", "python.version"),
  django: documentation("django", pythonVersions, "3.12", "django.pythonVersion"),
  flask: documentation("flask", pythonVersions, "3.12", "flask.pythonVersion"),
  dotnet: documentation("dotnet", ["2.1", "2.2", "3.0", "3.1", "5.0", "6.0", "7.0", "8.0", "9.0", "10.0"], "3.1", "dotnet.version"),
  go: documentation("go", ["1.21", "1.22", "1.23", "1.24", "1.25"], "1.22", "go.version"),
  react: documentation("react", ["20"], "20", null, false),
  angular: documentation("angular", ["20"], "20", null, false),
  vue: documentation("vue", ["20"], "20", null, false),
  static: documentation("static", null, null, null, false),
  docker: documentation("docker", null, null, null, false),
};
export function isLiaraPlatform(value: unknown): value is LiaraPlatform {
  return typeof value === "string" && liaraPlatforms.some(platform => platform === value);
}
export function isNativeLiaraPlatform(value: unknown): value is NativeLiaraPlatform {
  return value === "laravel" || value === "php" || value === "django" || value === "flask" || value === "dotnet" || value === "go" || value === "docker";
}
export function isDocumentedLiaraVersion(platform: LiaraPlatform, version: unknown): boolean {
  return typeof version === "string" && (liaraPlatformDocumentation[platform].versions?.includes(version) ?? false);
}
export type NativePlatformIssue = Readonly<{ code: string; message: string; paths: readonly string[] }>;
export type NativePlatformDescriptor = Readonly<{
  platform: NativeLiaraPlatform;
  runtimeVersion: string | null;
  versionSource: "liara.json" | "manifest" | "unspecified";
  versionRequirement: string | null;
  entry: string | null;
  // Null means unknown or provider-managed; these are never invented host commands.
  startCommand: readonly string[] | null;
  buildCommand: readonly string[] | null;
  port: number | null;
  configuration: Readonly<Record<string, string | boolean>>;
  evidence: readonly Readonly<{ path: string; kind: "configuration" | "manifest" | "entry" | "dockerfile" }>[];
  requirements: readonly NativePlatformIssue[];
  publishable: false;
}>;
export type NativePlatformInspection =
  | Readonly<{ state: "not_applicable"; publishable: false }>
  | Readonly<{ state: "detected"; descriptor: NativePlatformDescriptor; publishable: false }>
  | Readonly<{ state: "unsupported"; platform: NativeLiaraPlatform | null; issues: readonly NativePlatformIssue[]; publishable: false }>;

function evidencePath(value: unknown): string {
  const path = string(value, 240);
  ensure(!hasControl(path) && !/[\\:]/.test(path) && path.split("/").every(part => part && part !== "." && part !== ".."),
    "INVALID_RESPONSE", "مسیر شاهد پلتفرم معتبر نیست.");
  return path;
}
function parseIssues(value: unknown): NativePlatformIssue[] {
  ensure(Array.isArray(value) && value.length <= 64, "INVALID_RESPONSE", "فهرست نیازهای پلتفرم معتبر نیست.");
  return value.map(input => {
    const row = object(input); exactKeys(row, ["code", "message", "paths"]);
    const code = string(row.code, 80);
    ensure(/^[A-Z][A-Z0-9_]+$/.test(code) && Array.isArray(row.paths) && row.paths.length <= 1000, "INVALID_RESPONSE", "ساختار شاهد پلتفرم معتبر نیست.");
    return { code, message: string(row.message, 1000), paths: row.paths.map(evidencePath) };
  });
}
export function parseNativePlatformInspection(value: unknown): NativePlatformInspection {
  const row = object(value);
  ensure(row.publishable === false, "INVALID_RESPONSE", "تشخیص ایستا شاهد آماده‌بودن انتشار نیست.");
  if (row.state === "not_applicable") { exactKeys(row, ["state", "publishable"]); return { state: "not_applicable", publishable: false }; }
  if (row.state === "unsupported") {
    exactKeys(row, ["state", "platform", "issues", "publishable"]);
    ensure(row.platform === null || isNativeLiaraPlatform(row.platform), "INVALID_RESPONSE", "پلتفرم پاسخ معتبر نیست.");
    return { state: "unsupported", platform: row.platform, issues: parseIssues(row.issues), publishable: false };
  }
  exactKeys(row, ["state", "descriptor", "publishable"]);
  const item = object(row.descriptor);
  exactKeys(item, ["platform", "runtimeVersion", "versionSource", "versionRequirement", "entry", "startCommand", "buildCommand", "port", "configuration", "evidence", "requirements", "publishable"]);
  ensure(row.state === "detected" && isNativeLiaraPlatform(item.platform) && item.publishable === false &&
    (item.runtimeVersion === null || isDocumentedLiaraVersion(item.platform, item.runtimeVersion)) &&
    (item.versionSource === "liara.json" || item.versionSource === "manifest" || item.versionSource === "unspecified") &&
    item.startCommand === null && item.buildCommand === null && Array.isArray(item.evidence) && item.evidence.length <= 1000,
    "INVALID_RESPONSE", "descriptor ایستای پلتفرم معتبر نیست.");
  const configuration = object(item.configuration), allowed = new Set(["version", "phpVersion", "pythonVersion", "mirror", "composerMirror", "collectStatic", "compileMessages", "modifySettings", "geospatial", "timezone", "mainFile", "csprojectFile", "finalDllName", "appModule", "dockerfile"]);
  const parsedConfiguration: Record<string, string | boolean> = {};
  for (const [key, value] of Object.entries(configuration)) {
    ensure(allowed.has(key) && (typeof value === "boolean" || typeof value === "string" && value.length <= 240 && !hasControl(value)), "INVALID_RESPONSE", "گزینهٔ پلتفرم معتبر نیست.");
    parsedConfiguration[key] = value;
  }
  const evidence = item.evidence.map<NativePlatformDescriptor["evidence"][number]>(input => {
    const entry = object(input); exactKeys(entry, ["path", "kind"]);
    ensure(entry.kind === "configuration" || entry.kind === "manifest" || entry.kind === "entry" || entry.kind === "dockerfile", "INVALID_RESPONSE", "نوع شاهد پلتفرم معتبر نیست.");
    return { path: evidencePath(entry.path), kind: entry.kind };
  });
  return { state: "detected", publishable: false, descriptor: { platform: item.platform,
    runtimeVersion: item.runtimeVersion === null ? null : string(item.runtimeVersion, 16), versionSource: item.versionSource,
    versionRequirement: item.versionRequirement === null ? null : string(item.versionRequirement, 160),
    entry: item.entry === null ? null : evidencePath(item.entry), startCommand: null, buildCommand: null,
    port: item.port === null ? null : integer(item.port, 1, 65535), configuration: parsedConfiguration, evidence,
    requirements: parseIssues(item.requirements), publishable: false } };
}
