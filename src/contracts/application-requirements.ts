import { ensure } from "../server/errors.ts";
import { exactKeys, hash, hasControl, integer, object, string } from "./validation.ts";

export const applicationRequirementKinds = ["backend_api", "cloudflare_worker", "wordpress_host", "background_worker", "scheduler", "relational_database", "postgresql", "mysql", "redis", "sqlite", "duckdb", "persistent_storage", "supabase", "cloudflare_d1", "external_model", "external_exchange"] as const;
export type ApplicationRequirementKind = typeof applicationRequirementKinds[number];
export type ApplicationRequirementNeed = "required" | "optional" | "unknown";
export type ApplicationRequirementEvidence = Readonly<{
  path: string;
  sha256: string;
  line: number;
  kind: "source" | "configuration" | "manifest";
}>;
export type ApplicationRequirement = Readonly<{
  kind: ApplicationRequirementKind;
  consumerRoot: string;
  need: ApplicationRequirementNeed;
  environmentKeys: readonly string[];
  bindingNames: readonly string[];
  evidence: readonly ApplicationRequirementEvidence[];
}>;
export type ApplicationRequirementsInspection = Readonly<{
  version: 1;
  sourceHash: string;
  verification: "source_only";
  requirements: readonly ApplicationRequirement[];
  diagnostics: readonly Readonly<{ code: "CONFIG_INVALID" | "ENTRY_MISSING" | "SOURCE_PARSE_FAILED" | "ANALYSIS_LIMIT"; paths: readonly string[] }>[];
}>;

export function applicationSourcePath(value: unknown, root = false): string {
  const path = string(value, 512);
  ensure(root && path === "." || !hasControl(path) && !/[\\:]/.test(path) && path.split("/").every(part => part && part !== "." && part !== ".."),
    "APPLICATION_REQUIREMENTS_INVALID", "مسیر شاهد یا بخش برنامه معتبر نیست.", 409);
  return path;
}
export function parseApplicationRequirements(value: unknown): ApplicationRequirementsInspection {
  const row = object(value); exactKeys(row, ["version", "sourceHash", "verification", "requirements", "diagnostics"]);
  ensure(row.version === 1 && row.verification === "source_only" && Array.isArray(row.requirements) && row.requirements.length <= 128 && Array.isArray(row.diagnostics) && row.diagnostics.length <= 128,
    "APPLICATION_REQUIREMENTS_INVALID", "بررسی source فقط شاهد نیازهاست؛ وضعیت آماده یا تأییدشده از آن ساخته نمی‌شود.", 409);
  const names = (value: unknown) => {
    ensure(Array.isArray(value) && value.length <= 128 && value.every(name => typeof name === "string" && /^[A-Za-z_][A-Za-z0-9_]{0,127}$/.test(name)) && new Set(value).size === value.length,
      "APPLICATION_REQUIREMENTS_INVALID", "نام ورودی برنامه معتبر نیست.", 409);
    return value.map(name => string(name, 128));
  };
  const identities = new Set<string>();
  const requirements = row.requirements.map<ApplicationRequirement>(input => {
    const item = object(input); exactKeys(item, ["kind", "consumerRoot", "need", "environmentKeys", "bindingNames", "evidence"]);
    ensure(applicationRequirementKinds.some(kind => kind === item.kind) && (item.need === "required" || item.need === "optional" || item.need === "unknown") &&
      Array.isArray(item.evidence) && item.evidence.length > 0 && item.evidence.length <= 32, "APPLICATION_REQUIREMENTS_INVALID", "نیاز برنامه یا شاهد آن معتبر نیست.", 409);
    const consumerRoot = applicationSourcePath(item.consumerRoot, true), identity = `${consumerRoot}\0${item.kind}`;
    ensure(!identities.has(identity), "APPLICATION_REQUIREMENTS_INVALID", "نیاز یک بخش تکراری است.", 409); identities.add(identity);
    const kind = applicationRequirementKinds.find(kind => kind === item.kind);
    ensure(kind, "APPLICATION_REQUIREMENTS_INVALID", "نوع نیاز معتبر نیست.", 409);
    return { kind, consumerRoot, need: item.need, environmentKeys: names(item.environmentKeys), bindingNames: names(item.bindingNames),
      evidence: item.evidence.map<ApplicationRequirementEvidence>(value => {
        const evidence = object(value); exactKeys(evidence, ["path", "sha256", "line", "kind"]);
        ensure(evidence.kind === "source" || evidence.kind === "configuration" || evidence.kind === "manifest", "APPLICATION_REQUIREMENTS_INVALID", "نوع شاهد برنامه معتبر نیست.", 409);
        return { path: applicationSourcePath(evidence.path), sha256: hash(evidence.sha256), line: integer(evidence.line, 1, 4000000), kind: evidence.kind };
      }) };
  });
  const diagnostics = row.diagnostics.map<ApplicationRequirementsInspection["diagnostics"][number]>(input => {
    const item = object(input); exactKeys(item, ["code", "paths"]);
    ensure((item.code === "CONFIG_INVALID" || item.code === "ENTRY_MISSING" || item.code === "SOURCE_PARSE_FAILED" || item.code === "ANALYSIS_LIMIT") && Array.isArray(item.paths) && item.paths.length <= 32,
      "APPLICATION_REQUIREMENTS_INVALID", "تشخیص source معتبر نیست.", 409);
    return { code: item.code, paths: item.paths.map(path => applicationSourcePath(path)) };
  });
  return { version: 1, sourceHash: hash(row.sourceHash), verification: "source_only", requirements, diagnostics };
}
