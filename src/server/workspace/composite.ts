import { createHash } from "node:crypto";
import { SOURCE_MAX_BYTES, SOURCE_MAX_FILES, sourceFileByteLimit } from "../../contracts/source-limits.ts";
import { hasControl, object } from "../../contracts/validation.ts";
import { lockedTarballs } from "../agent/npm-source.ts";
import { pythonRequirements, type PythonRequirement } from "../agent/python-source.ts";
import { AppError, ensure } from "../errors.ts";
import { fingerprint } from "../policy/action.ts";
import type { SourceFile } from "./inspect.ts";

type Backend = Readonly<{ entryPath: string; module: string; exportName: string; framework: "fastapi" | "starlette"; staticMountDetected: boolean }>;
export type CompositePreparationDescriptor = Readonly<{
  version: 1;
  kind: "python-asgi-vite";
  sourceRoot: ".";
  sourceHash: string;
  publishable: false;
  backend: Backend & Readonly<{
    requirements: Readonly<{ sourcePath: string; sha256: string; manifestSha256: string | null; targetPath: "requirements.txt"; requiresCopy: boolean; pins: readonly PythonRequirement[] }>;
  }>;
  frontend: Readonly<{
    directory: string; packagePath: string; packageSha256: string; lockPath: string; lockSha256: string;
    configPath: string | null; configSha256: string | null; buildCommand: string; outputDirectory: string;
    lockedTarballs: number; nodeRequirement: string | null;
  }>;
  preparation: Readonly<{
    preserveSourceRoot: true; generatedEntryPath: "launchlane_main.py"; publicDirectory: "launchlane-public";
    command: readonly ["python3", "launchlane_main.py"]; port: 8000; accessLog: false;
    requiredChecks: readonly ["frontend-build-and-export", "generated-entry", "python-build-and-workload", "artifact-capture"];
  }>;
}>;
export type CompositeInspection = Readonly<{ status: "not_applicable" }> |
  Readonly<{ status: "unsupported"; code: string; message: string; paths: readonly string[] }> |
  Readonly<{ status: "detected"; descriptor: CompositePreparationDescriptor }>;

function digest(content: Buffer): string { return createHash("sha256").update(content).digest("hex"); }
function text(file: SourceFile): string {
  const value = file.content.toString("utf8");
  ensure(Buffer.from(value).equals(file.content), "COMPOSITE_ENCODING_UNSUPPORTED", "فایل تنظیمات پروژه باید متن UTF-8 معتبر باشد.", 409);
  return value.replace(/^\uFEFF/, "");
}

// Python strings and comments are evidence, never executable declarations.
function pythonCode(source: string): string {
  let result = "", quote = "", triple = false, comment = false;
  for (let index = 0; index < source.length; index++) {
    const character = source[index] ?? "";
    if (character === "\n") { result += character; comment = false; continue; }
    if (comment) { result += " "; continue; }
    if (quote) {
      if (character === "\\") { result += " "; if (source[index + 1] !== "\n") { result += " "; index++; } continue; }
      if (character === quote && (!triple || source.slice(index, index + 3) === quote.repeat(3))) {
        if (triple) { result += "   "; index += 2; } else result += " ";
        quote = "";
      } else result += " ";
    } else if (character === "#") { comment = true; result += " "; }
    else if (character === "'" || character === '"') {
      quote = character; triple = source.slice(index, index + 3) === character.repeat(3);
      result += triple ? "   " : " "; if (triple) index += 2;
    } else result += character;
  }
  return result;
}

function backends(files: readonly SourceFile[]): Backend[] {
  const found: Backend[] = [];
  for (const file of files) {
    if (!file.path.endsWith(".py") || /(?:^|\/)(?:tests?|test_[^/]+|conftest)\b/.test(file.path)) continue;
    const code = pythonCode(text(file)), constructors = new Map<string, Backend["framework"]>();
    for (const match of code.matchAll(/^from\s+(fastapi|starlette\.applications)\s+import\s+([^\n]+)/gm)) {
      const name = match[1] === "fastapi" ? "FastAPI" : "Starlette", imported = match[2] ?? "";
      const selected = new RegExp(`\\b${name}(?:\\s+as\\s+([A-Za-z_]\\w*))?(?:\\s*[,)]|\\s*$)`).exec(imported);
      if (selected) constructors.set(selected[1] ?? name, match[1] === "fastapi" ? "fastapi" : "starlette");
    }
    ensure(constructors.size <= 8, "COMPOSITE_ASGI_COMPLEXITY_LIMIT", "تعداد aliasهای ASGI از محدودهٔ تشخیص ساده بیشتر است؛ تحلیل جدا لازم است.", 409);
    for (const [constructorName, framework] of constructors) {
      const factoryNames = new Set<string>();
      for (const factory of code.matchAll(/^def\s+([A-Za-z_]\w*)\s*\([\s\S]*?(?=^\S|(?![\s\S]))/gm)) {
        const body = factory[0], local = new RegExp(`^([ \\t]+)([A-Za-z_]\\w*)\\s*=\\s*${constructorName}\\s*\\(`, "m").exec(body);
        if (local && new RegExp(`^${local[1]}return\\s+${local[2]}\\s*$`, "m").test(body)) factoryNames.add(factory[1] ?? "");
      }
      for (const assignment of code.matchAll(/^([A-Za-z_]\w*)\s*=\s*([A-Za-z_]\w*)\s*\(/gm)) {
        if (assignment[2] !== constructorName && !factoryNames.has(assignment[2] ?? "")) continue;
        const module = file.path.slice(0, -3).split("/");
        if (module.at(-1) === "__init__") module.pop();
        ensure(module.length > 0, "COMPOSITE_ASGI_MODULE_UNSUPPORTED", "ورودی ASGI باید در یک ماژول قابل import باشد.", 409);
        ensure(module.every(part => /^[A-Za-z_]\w*$/.test(part)), "COMPOSITE_ASGI_MODULE_UNSUPPORTED", "مسیر ماژول Python برای import مستقیم معتبر نیست.", 409);
        found.push({ entryPath: file.path, module: module.join("."), exportName: assignment[1] ?? "", framework,
          staticMountDetected: /\.mount\s*\(/.test(code) && /\bStaticFiles\s*\(/.test(code) });
        ensure(found.length <= 1, "COMPOSITE_ASGI_AMBIGUOUS", "بیش از یک ورودی ASGI پیدا شد؛ مقصد انتشار باید مشخص شود.", 409);
      }
    }
  }
  return found;
}

function requirements(files: readonly SourceFile[]): CompositePreparationDescriptor["backend"]["requirements"] {
  const manifest = files.find(file => file.path === "requirements.txt"), lock = files.find(file => file.path === "requirements.lock.txt"), source = lock ?? manifest;
  ensure(source, "COMPOSITE_REQUIREMENTS_REQUIRED", "فهرست وابستگی‌های قفل‌شدهٔ Python در ریشهٔ پروژه پیدا نشد؛ پوشهٔ کامل پروژه لازم است.", 409);
  const parse = (file: SourceFile) => pythonRequirements([{ path: "requirements.txt", content: file.content }]);
  const pins = parse(source);
  ensure(pins.length > 0 && pins.some(pin => pin.name === "uvicorn") && pins.some(pin => pin.name === "fastapi" || pin.name === "starlette"),
    "COMPOSITE_ASGI_DEPENDENCIES_REQUIRED", "وابستگی‌های ASGI و Uvicorn باید با نسخهٔ دقیق در manifest موجود باشند.", 409);
  const include = manifest ? text(manifest).split(/\r?\n/).map(line => line.trim()).filter(line => line && !line.startsWith("#")) : [];
  const referencesLock = !!lock && include.length === 1 && include[0] === "-r requirements.lock.txt";
  if (manifest && lock && !referencesLock) ensure(fingerprint([...parse(manifest)].sort((a, b) => a.name.localeCompare(b.name, "en"))) === fingerprint([...pins].sort((a, b) => a.name.localeCompare(b.name, "en"))),
    "COMPOSITE_REQUIREMENTS_CONFLICT", "نسخه‌های requirements.txt با قفل Python برابر نیستند؛ انتخاب نسخه باید روشن شود.", 409);
  return { sourcePath: source.path, sha256: digest(source.content), manifestSha256: manifest ? digest(manifest.content) : null,
    targetPath: "requirements.txt", requiresCopy: !manifest || referencesLock, pins };
}

function frontend(file: SourceFile, pkg: Record<string, unknown>, files: readonly SourceFile[]): CompositePreparationDescriptor["frontend"] {
  const directory = file.path.slice(0, -"/package.json".length), prefix = `${directory}/`, build = object(pkg.scripts ?? {}).build;
  ensure(typeof build === "string" && build.length <= 1000 && build.split("&&").at(-1)?.trim() === "vite build",
    "COMPOSITE_VITE_BUILD_UNSUPPORTED", "فرمان build باید ساخت مشخص Vite با خروجی قابل‌بررسی باشد؛ فرمان یا تنظیم پویا به بررسی جدا نیاز دارد.", 409);
  ensure(pkg.workspaces === undefined, "COMPOSITE_FRONTEND_WORKSPACE_UNSUPPORTED", "فرانت انتخاب‌شده خودش workspace چندبخشی است؛ ریشهٔ دقیق build لازم است.", 409);
  const leaf = files.filter(row => row.path.startsWith(prefix)).map(row => ({ path: row.path.slice(prefix.length), content: row.content }));
  const lock = leaf.find(row => row.path === "package-lock.json"), index = leaf.find(row => row.path === "index.html");
  ensure(lock && index, "COMPOSITE_VITE_SOURCE_REQUIRED", "index.html و package-lock.json همان پوشهٔ فرانت برای ساخت لازم‌اند.", 409);
  const locked = object(JSON.parse(text(lock))), lockedRoot = object(object(locked.packages)[""]);
  for (const field of ["dependencies", "devDependencies", "optionalDependencies"]) ensure(fingerprint(object(pkg[field] ?? {})) === fingerprint(object(lockedRoot[field] ?? {})),
    "COMPOSITE_FRONTEND_LOCK_CHANGED", "وابستگی‌های package.json با lockfile همان فرانت برابر نیستند.", 409);
  const tarballs = lockedTarballs(leaf), configs = leaf.filter(row => /^vite\.config\.[cm]?[jt]s$/.test(row.path));
  ensure(configs.length <= 1, "COMPOSITE_VITE_CONFIG_AMBIGUOUS", "بیش از یک تنظیم Vite وجود دارد؛ فایل مؤثر build باید مشخص شود.", 409);
  const config = configs[0], configText = config ? text(config).replace(/\/\*[\s\S]*?\*\/|(^|\s)\/\/[^\r\n]*/g, "$1") : "";
  ensure(!config || /\bexport\s+default\s+(?:defineConfig\s*\(\s*)?\{/.test(configText),
    "COMPOSITE_VITE_CONFIG_UNSUPPORTED", "تنظیم Vite باید یک object صریح باشد؛ تنظیم تولیدشده یا تابعی بدون اجرا قابل تعیین نیست.", 409);
  ensure(!/(['"])(?:build|outDir|root|ssr|lib)\1\s*\]?\s*:/.test(configText),
    "COMPOSITE_VITE_CONFIG_UNSUPPORTED", "کلیدهای محاسبه‌شده یا نقل‌قول‌شدهٔ build در این تشخیص محدود، بدون حدس به بررسی جدا واگذار می‌شوند.", 409);
  ensure(!/\b(?:root|ssr|lib)\s*:|\.\.\.|\boutDir\s*[=\]]/.test(configText), "COMPOSITE_VITE_CONFIG_UNSUPPORTED", "ریشه، SSR، library یا تنظیم محاسبه‌شدهٔ Vite به آماده‌سازی جدا نیاز دارد.", 409);
  ensure(!/\bbuild\s*:\s*(?!\{)\S/.test(configText), "COMPOSITE_VITE_CONFIG_UNSUPPORTED", "تنظیم build باید object صریح باشد؛ مقدار محاسبه‌شده خودکار حدس زده نمی‌شود.", 409);
  const outputs = [...configText.matchAll(/\boutDir\s*:\s*(['"])([^'"\r\n]+)\1(?=\s*[,}])/g)];
  ensure(outputs.length <= 1 && ((configText.match(/\boutDir\s*:/g) ?? []).length === outputs.length),
    "COMPOSITE_VITE_OUTPUT_UNSUPPORTED", "مسیر خروجی Vite باید یک مقدار ثابت و روشن باشد.", 409);
  const outputDirectory = outputs[0]?.[2] ?? "dist";
  ensure(outputDirectory.split("/").every(part => /^[A-Za-z_][A-Za-z0-9_.-]*$/.test(part)) && !["src", "public", "node_modules"].includes(outputDirectory),
    "COMPOSITE_VITE_OUTPUT_UNSUPPORTED", "مسیر خروجی فرانت باید پوشه‌ای مستقل داخل همان برنامه باشد.", 409);
  const engines = object(pkg.engines ?? {});
  ensure(engines.node === undefined || typeof engines.node === "string" && engines.node.length <= 160, "COMPOSITE_NODE_REQUIREMENT_UNSUPPORTED", "نیاز نسخهٔ Node باید یک محدودهٔ متنی مشخص باشد.", 409);
  return { directory, packagePath: file.path, packageSha256: digest(file.content), lockPath: prefix + lock.path, lockSha256: digest(lock.content),
    configPath: config ? prefix + config.path : null, configSha256: config ? digest(config.content) : null, buildCommand: build,
    outputDirectory, lockedTarballs: tarballs.length, nodeRequirement: typeof engines.node === "string" ? engines.node : null };
}

/** Static preparation evidence only. No scripts, imports, build, or publication run here. */
export function inspectCompositeProject(files: readonly SourceFile[]): CompositeInspection {
  const paths: string[] = [];
  try {
    ensure(files.length <= SOURCE_MAX_FILES && files.reduce((sum, row) => sum + row.content.length, 0) <= SOURCE_MAX_BYTES,
      "COMPOSITE_SOURCE_LIMIT", "حجم یا تعداد فایل‌ها از محدودهٔ بررسی پروژه بیشتر است.", 413);
    const names = new Set<string>();
    for (const file of files) {
      ensure(file.path.length <= 512 && file.path.split("/").every(part => part && part !== "." && part !== "..") && !/[\\:]/.test(file.path) && !hasControl(file.path) && !names.has(file.path) && file.content.length <= sourceFileByteLimit(file.path),
        "COMPOSITE_SOURCE_INVALID", "مسیر، اندازه یا یکتایی فایل‌های source معتبر نیست.", 409);
      names.add(file.path);
    }
    if (!files.some(row => row.path.endsWith(".py")) || !files.some(row => row.path.endsWith("/package.json"))) return { status: "not_applicable" };
    const packages = files.filter(row => row.path.endsWith("/package.json")).map(file => ({ file, pkg: object(JSON.parse(text(file))) }));
    const candidates = packages.filter(({ pkg }) => typeof { ...object(pkg.devDependencies ?? {}), ...object(pkg.dependencies ?? {}) }.vite === "string");
    if (!candidates.length) return { status: "not_applicable" };
    paths.push(...candidates.map(row => row.file.path));
    ensure(candidates.length === 1, "COMPOSITE_FRONTEND_AMBIGUOUS", "بیش از یک فرانت Vite پیدا شد؛ برنامهٔ موردنظر باید مشخص شود.", 409);
    ensure(!names.has("package.json"), "COMPOSITE_ROOT_WORKSPACE_UNSUPPORTED", "ریشهٔ Python هم manifest Node دارد؛ نقش هر برنامه باید پیش از آماده‌سازی روشن شود.", 409);
    const entries = backends(files);
    paths.push(...entries.map(row => row.entryPath));
    ensure(entries.length === 1, entries.length ? "COMPOSITE_ASGI_AMBIGUOUS" : "COMPOSITE_ASGI_REQUIRED",
      entries.length ? "بیش از یک ورودی ASGI پیدا شد؛ مقصد انتشار باید مشخص شود." : "ورودی قابل‌ردیابی ASGI پیدا نشد؛ نام فایل به‌تنهایی برای انتخاب start کافی نیست.", 409);
    const backend = entries[0], selected = candidates[0];
    ensure(backend && selected, "COMPOSITE_SOURCE_INVALID", "ورودی کامل پروژه در دسترس نیست.", 409);
    const code = pythonCode(text(files.find(row => row.path === backend.entryPath) ?? { path: backend.entryPath, content: Buffer.alloc(0) }));
    for (const match of code.matchAll(/^from\s+([A-Za-z_]\w*(?:\.[A-Za-z_]\w*)+)\s+import\s/gm)) {
      const imported = match[1] ?? "", expected = `${imported.replaceAll(".", "/")}.py`, sibling = `${imported.split(".").at(-1)}.py`;
      ensure(!names.has(sibling) || names.has(expected), "COMPOSITE_SOURCE_ROOT_REQUIRED", "importهای Python به پوشه‌های بالاتر وابسته‌اند؛ ریشهٔ کامل مخزن را انتخاب کنید.", 409);
    }
    ensure(!files.some(row => row.path === "launchlane_main.py" || row.path === "launchlane-public" || row.path.startsWith("launchlane-public/")),
      "COMPOSITE_GENERATED_PATH_CONFLICT", "مسیر آماده‌سازی از قبل در source وجود دارد؛ فایل موجود خودکار بازنویسی نمی‌شود.", 409);
    const dependency = requirements(files), web = frontend(selected.file, selected.pkg, files);
    ensure(dependency.pins.some(pin => pin.name === backend.framework), "COMPOSITE_ASGI_DEPENDENCIES_REQUIRED", "فریم‌ورک ورودی ASGI باید در وابستگی‌های قفل‌شده وجود داشته باشد.", 409);
    paths.push(dependency.sourcePath, web.lockPath);
    const manifest = files.map(file => ({ path: file.path, bytes: file.content.length, sha256: digest(file.content) })).sort((a, b) => a.path.localeCompare(b.path, "en"));
    return { status: "detected", descriptor: { version: 1, kind: "python-asgi-vite", sourceRoot: ".", sourceHash: fingerprint(manifest), publishable: false,
      backend: { ...backend, requirements: dependency }, frontend: web,
      preparation: { preserveSourceRoot: true, generatedEntryPath: "launchlane_main.py", publicDirectory: "launchlane-public", command: ["python3", "launchlane_main.py"], port: 8000, accessLog: false,
        requiredChecks: ["frontend-build-and-export", "generated-entry", "python-build-and-workload", "artifact-capture"] } } };
  } catch (error) {
    return { status: "unsupported", code: error instanceof AppError ? error.code : "COMPOSITE_MANIFEST_INVALID",
      message: error instanceof AppError ? error.message : "ساختار manifest پروژه معتبر نیست؛ آماده‌سازی و انتشار تأیید نشد.", paths: [...new Set(paths)].sort() };
  }
}
