import { object } from "../../contracts/validation.ts";
import { ensure } from "../errors.ts";

/** Interpret only the reviewed CLI target; never execute a script to inspect it. */
export function angularOutput(projects: Record<string, unknown>, command: string): string {
  const applications = Object.entries(projects).map(([name, value]) => ({ name, project: object(value) })).filter(row => row.project.projectType === "application");
  ensure(applications.length === 1, "FRONTEND_AMBIGUOUS", "این workspace چند برنامه Angular دارد؛ انتخاب مستقل componentهای آن لازم است.", 409);
  const application = applications[0]; ensure(application, "FRONTEND_ROOT_REQUIRED", "برنامه Angular در تنظیمات موجود نیست.", 409);
  const args = command.trim().split(/\s+/), flags = new Map<string, string>(); let project: string | undefined;
  function valid(condition: unknown): asserts condition { ensure(condition, "FRONTEND_COMMAND_UNSUPPORTED", "target، configuration و خروجی باید از فرمان اصلی ng build به‌صورت صریح و یکتا مشخص باشند.", 409); }
  valid(args.shift() === "ng" && args.shift() === "build");
  for (let index = 0; index < args.length; index++) {
    const token = args[index]; valid(token);
    if (!token.startsWith("-")) { valid(index === 0 && project === undefined && /^[A-Za-z0-9_.-]+$/.test(token)); project = token; continue; }
    const match = /^(--configuration|-c|--output-path|--project)(?:=(.*))?$/.exec(token); valid(match);
    const key = match[1] === "-c" ? "--configuration" : match[1], value = match[2] ?? args[++index];
    valid(key && value && !flags.has(key) && (key === "--output-path" ? /^[A-Za-z0-9_./-]+$/ : /^[A-Za-z0-9_.-]+(?:,[A-Za-z0-9_.-]+)*$/).test(value)); flags.set(key, value);
  }
  valid(!(project && flags.has("--project")) && (project ?? flags.get("--project") ?? application.name) === application.name);
  const target = object(object(application.project.architect ?? application.project.targets).build), modern = target.builder === "@angular-devkit/build-angular:application" || target.builder === "@angular/build:application";
  ensure(modern || target.builder === "@angular-devkit/build-angular:browser" || target.builder === "@angular-devkit/build-angular:browser-esbuild", "FRONTEND_BUILDER_UNSUPPORTED", "builder اختصاصی Angular باید قرارداد خروجی و اجرای جدا داشته باشد.", 409);
  const configurations = object(target.configurations ?? {}), selection = flags.get("--configuration") ?? target.defaultConfiguration;
  valid(selection === undefined || typeof selection === "string" && /^[A-Za-z0-9_.-]+(?:,[A-Za-z0-9_.-]+)*$/.test(selection));
  let options = object(target.options ?? {});
  for (const name of typeof selection === "string" ? selection.split(",") : []) { valid(Object.hasOwn(configurations, name)); options = { ...options, ...object(configurations[name]) }; }
  ensure(!options.server && !options.ssr && options.outputMode !== "server", "FRONTEND_SSR_REQUIRED", "این برنامه Angular بخش سرور هم دارد؛ artifact مرورگر پذیرش آن را کامل نمی‌کند.", 409);
  const output = flags.get("--output-path") ?? options.outputPath, base = typeof output === "string" ? output : object(output).base, browser = typeof output === "string" ? undefined : object(output).browser;
  ensure(typeof base === "string" && (browser === undefined || typeof browser === "string"), "FRONTEND_OUTPUT_REQUIRED", "مسیر خروجی مرورگر Angular باید مشخص باشد.", 409);
  return modern ? `${base}${browser === "" ? "" : `/${browser ?? "browser"}`}` : base;
}
