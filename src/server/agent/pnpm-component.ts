import { posix } from "node:path";
import { parsePnpmComponent, type PnpmComponent } from "../../contracts/pnpm-component.ts";
import type { PnpmWorkspace } from "../../contracts/pnpm-workspace.ts";
import type { SourceFile } from "../workspace/inspect.ts";
import { object } from "../../contracts/validation.ts";
import { ensure } from "../errors.ts";
import { frontendRuntime } from "../workspace/frontend.ts";

export function sourcePnpmComponent(files: readonly SourceFile[], workspace: PnpmWorkspace, root: string, port = 3000): PnpmComponent {
  const member = workspace.packages.find(pkg => pkg.root === root); ensure(member, "COMPONENT_ROOT_REQUIRED", "component باید یکی از rootهای همین workspace باشد.", 409);
  const prefix = root === "." ? "" : `${root}/`, source = files.find(file => file.path === `${prefix}package.json`); ensure(source, "COMPONENT_ROOT_REQUIRED", "manifest بخش انتخاب‌شده موجود نیست.", 409);
  const pkg = object(JSON.parse(source.content.toString())), scripts = object(pkg.scripts ?? {}), localFiles = files.filter(file => file.path.startsWith(prefix)).map(file => ({ ...file, path: file.path.slice(prefix.length) }));
  ensure(!["prestart", "poststart"].some(name => scripts[name] !== undefined), "COMPONENT_START_UNSUPPORTED", "hook شروع موجود به قرارداد مستقل نیاز دارد؛ حذف نمی‌شود.", 409);
  const frontend = frontendRuntime(pkg, {}, localFiles); let outputDirectory: string, argv: string[];
  if (frontend) {
    outputDirectory = frontend.builder === "vite" ? "dist" : frontend.outputDirectory; argv = [];
    const configs = localFiles.filter(file => /^vite\.config\.[cm]?[jt]s$/.test(file.path));
    for (const config of configs) { const text = config.content.toString(); if (/\boutDir\s*:/.test(text)) { const match = /\boutDir\s*:\s*['"]([A-Za-z0-9_./-]+)['"]/.exec(text); ensure(match?.[1], "COMPONENT_OUTPUT_UNSUPPORTED", "outDir باید از تنظیمات واقعی قابل تعیین باشد.", 409); outputDirectory = match[1]; } }
    const command = member.build ?? "", flags = [...command.matchAll(/(?:^|\s)--outDir(?:=|\s+)([^\s]+)/g)];
    ensure(!command.includes("--outDir") || flags.length === 1 && [...command.matchAll(/--outDir\b/g)].length === 1 && /^[A-Za-z0-9_./-]+$/.test(flags[0]?.[1] ?? ""),
      "COMPONENT_OUTPUT_UNSUPPORTED", "مسیر خروجی Vite باید یک مقدار صریح و یکتا در فرمان اصلی باشد.", 409);
    if (flags[0]?.[1]) outputDirectory = flags[0][1];
  } else {
    const start = typeof scripts.start === "string" ? /^node ([A-Za-z0-9_./-]+\.[cm]?js)$/.exec(scripts.start) : null;
    ensure(start?.[1], "COMPONENT_START_UNSUPPORTED", "فرمان start مستقیم Node روی خروجی compiled باید در source موجود باشد.", 409);
    argv = [start[1]]; outputDirectory = posix.dirname(start[1]);
    ensure(outputDirectory !== ".", "COMPONENT_OUTPUT_UNSUPPORTED", "entry باید در پوشهٔ خروجی compiled باشد؛ source خام خروجی ساخت نیست.", 409);
  }
  const dependencies = new Set(member.dependencies); let previous = -1;
  while (previous !== dependencies.size) { previous = dependencies.size; for (const pkg of workspace.packages) if (dependencies.has(pkg.name)) for (const name of pkg.dependencies) dependencies.add(name); }
  return parsePnpmComponent({ root, name: member.name, kind: frontend ? "static" : "node", outputDirectory, argv, internalPort: port, testCommand: member.test,
    remainingRoots: workspace.packages.filter(pkg => pkg.root !== "." && pkg.root !== root && (pkg.start !== null || !dependencies.has(pkg.name))).map(pkg => pkg.root) });
}
