import { ensure } from "../server/errors.ts";
import { exactKeys, hash, object, string } from "./validation.ts";
import { applicationSourcePath } from "./application-requirements.ts";

// Official registry bytes checked on 2026-10-28. A source pin must match exactly.
export const pnpmTool = {
  name: "pnpm", version: "11.19.0", nodeRequirement: ">=22.13",
  integrity: "sha512-eIHz7VkNRyxKlV4riLISF5ERYGbcyIy8o4SeybYPG7qm0syyIfqR2k4cZb7yvL43k2Wup6xTnHv4be3DobItzg==",
} as const;
export type WorkspacePackage = Readonly<{
  root: string; name: string; dependencies: readonly string[];
  build: string | null; test: string | null; start: string | null;
}>;
export type PnpmWorkspace = Readonly<{
  version: 1; manager: typeof pnpmTool; nodeVersion: "22" | "24";
  files: readonly Readonly<{ path: string; sha256: string }>[];
  packages: readonly WorkspacePackage[];
}>;
export function parsePnpmWorkspace(value: unknown): PnpmWorkspace {
  const row = object(value); exactKeys(row, ["version", "manager", "nodeVersion", "files", "packages"]);
  const manager = object(row.manager); exactKeys(manager, ["name", "version", "nodeRequirement", "integrity"]);
  ensure(row.version === 1 && (row.nodeVersion === "22" || row.nodeVersion === "24") &&
    Object.entries(pnpmTool).every(([key, value]) => manager[key] === value), "PNPM_VERSION_UNSUPPORTED", "نسخهٔ دقیق pnpm و محیط سازگار باید در این نصب آماده باشند؛ lock با npm جایگزین نمی‌شود.", 409);
  ensure(Array.isArray(row.files) && row.files.length >= 2 && row.files.length <= 67 && Array.isArray(row.packages) && row.packages.length > 0 && row.packages.length <= 64,
    "PNPM_WORKSPACE_INVALID", "فهرست محدود بسته‌ها و شاهد lock لازم است.", 409);
  const files = row.files.map(input => { const file = object(input); exactKeys(file, ["path", "sha256"]); return { path: applicationSourcePath(file.path), sha256: hash(file.sha256) }; });
  const names = new Set<string>(), roots = new Set<string>();
  const command = (value: unknown) => value === null ? null : string(value, 1000);
  const packages = row.packages.map<WorkspacePackage>(input => {
    const item = object(input); exactKeys(item, ["root", "name", "dependencies", "build", "test", "start"]);
    const root = applicationSourcePath(item.root, true), name = string(item.name, 214);
    ensure(/^(?:@[a-z0-9_.-]+\/)?[a-z0-9_][a-z0-9_.-]*$/.test(name) && !names.has(name) && !roots.has(root) && Array.isArray(item.dependencies) && item.dependencies.length <= 64,
      "PNPM_WORKSPACE_INVALID", "نام و مسیر بسته باید یکتا و قابل تشخیص باشند.", 409);
    names.add(name); roots.add(root);
    return { root, name, dependencies: item.dependencies.map(value => string(value, 214)), build: command(item.build), test: command(item.test), start: command(item.start) };
  });
  ensure(packages[0]?.root === "." && packages.every(pkg => pkg.dependencies.every(name => names.has(name))) && new Set(files.map(file => file.path)).size === files.length,
    "PNPM_WORKSPACE_INVALID", "ریشه و وابستگی داخلی بسته‌ها باید در همان source باشند.", 409);
  return { version: 1, manager: pnpmTool, nodeVersion: row.nodeVersion, files, packages };
}
