import semver from "semver";
import { isDocumentedLiaraVersion, isLiaraPlatform, isNativeLiaraPlatform, liaraPlatformDocumentation,
  type NativeLiaraPlatform, type NativePlatformDescriptor, type NativePlatformInspection, type NativePlatformIssue } from "../../contracts/liara-platform.ts";
import { SOURCE_MAX_BYTES, SOURCE_MAX_FILES, sourceFileByteLimit } from "../../contracts/source-limits.ts";
import { hasControl } from "../../contracts/validation.ts";
import type { SourceFile } from "./inspect.ts";

class UnsupportedNative extends Error {
  readonly issue: NativePlatformIssue;
  constructor(code: string, message: string, paths: readonly string[]) {
    super(message); this.issue = { code, message, paths };
  }
}
function reject(code: string, message: string, paths: readonly string[] = []): never { throw new UnsupportedNative(code, message, paths); }
function record(value: unknown, path: string): Record<string, unknown> {
  if (typeof value !== "object" || value === null || Array.isArray(value)) reject("NATIVE_MANIFEST_INVALID", "ساختار فایل تنظیمات معتبر نیست.", [path]);
  return Object.fromEntries(Object.entries(value));
}
function safePath(value: unknown): value is string {
  return typeof value === "string" && value.length > 0 && value.length <= 512 && !/[\\:]/.test(value) && !hasControl(value) &&
    value.split("/").every(part => part !== "" && part !== "." && part !== "..");
}
function localPath(value: unknown, source: string): string {
  const path = typeof value === "string" ? value.replace(/^\.\//, "") : value;
  if (!safePath(path) || path.length > 240) reject("NATIVE_ENTRY_PATH_INVALID", "مسیر اجرا باید داخل همین ریشهٔ پروژه باشد.", [source]);
  return path;
}
// Remove comments and string bodies before looking for declarations, not executable behavior.
function codeShape(text: string, python = false): string {
  let out = "", quote = "", triple = false, block = false, line = false;
  for (let i = 0; i < text.length; i++) {
    const char = text[i] ?? "", next = text[i + 1];
    if (line) { if (char === "\n") { line = false; out += "\n"; } else out += " "; continue; }
    if (block) { if (char === "*" && next === "/") { block = false; out += "  "; i++; } else out += char === "\n" ? "\n" : " "; continue; }
    if (quote) {
      if (char === "\\" && (python || quote !== "`")) { out += "  "; i++; continue; }
      if (triple && text.slice(i, i + 3) === quote.repeat(3)) { quote = ""; triple = false; out += "   "; i += 2; }
      else if (!triple && char === quote) { quote = ""; out += " "; }
      else out += char === "\n" ? "\n" : " ";
      continue;
    }
    if (python ? char === "#" : char === "/" && next === "/") { line = true; out += " "; continue; }
    if (!python && char === "/" && next === "*") { block = true; out += "  "; i++; continue; }
    if (char === '"' || char === "'" || !python && char === "`") {
      quote = char; triple = python && text.slice(i, i + 3) === char.repeat(3);
      out += triple ? "   " : " "; if (triple) i += 2; continue;
    }
    out += char;
  }
  return out;
}
const notApplicable: NativePlatformInspection = { state: "not_applicable", publishable: false };

/** Bounded source evidence only. No filesystem access, imports of project code, scripts or cloud calls. */
export function inspectNativePlatform(files: readonly SourceFile[], liaraValue?: unknown): NativePlatformInspection {
  let platform: NativeLiaraPlatform | null = null;
  try {
    if (files.length > SOURCE_MAX_FILES) reject("NATIVE_SOURCE_LIMIT", "تعداد فایل‌ها از سقف بررسی بیشتر است.");
    const index = new Map<string, SourceFile>(); let total = 0;
    for (const file of files) {
      if (!safePath(file.path) || index.has(file.path)) reject("NATIVE_SOURCE_PATH_INVALID", "مسیرهای source باید یکتا و داخل ریشهٔ انتخاب‌شده باشند.");
      if (!Buffer.isBuffer(file.content)) reject("NATIVE_SOURCE_LIMIT", "source باید شامل بایت‌های محدود فایل باشد.");
      total += file.content.length;
      if (file.content.length > sourceFileByteLimit(file.path) || total > SOURCE_MAX_BYTES)
        reject("NATIVE_SOURCE_LIMIT", "حجم source از سقف بررسی بیشتر است.");
      index.set(file.path, file);
    }
    const text = (path: string): string => {
      const file = index.get(path);
      if (!file) reject("NATIVE_ENTRY_MISSING", "فایل اشاره‌شده در همین source موجود نیست.", [path]);
      try { return new TextDecoder("utf-8", { fatal: true }).decode(file.content); }
      catch { return reject("NATIVE_SOURCE_ENCODING", "فایل متنی قابل بررسی نیست.", [path]); }
    };
    const json = (path: string): Record<string, unknown> => {
      try { return record(JSON.parse(text(path)), path); }
      catch (cause) { if (cause instanceof UnsupportedNative) throw cause; return reject("NATIVE_MANIFEST_INVALID", "فایل JSON معتبر نیست.", [path]); }
    };
    const liara = record(liaraValue ?? (index.has("liara.json") ? json("liara.json") : {}), "liara.json");
    if (liara.platform !== undefined) {
      if (!isLiaraPlatform(liara.platform)) reject("NATIVE_PLATFORM_UNKNOWN", "پلتفرم تنظیم‌شده در فهرست رسمی این بازبینی نیست.", ["liara.json"]);
      if (!isNativeLiaraPlatform(liara.platform)) return notApplicable;
      platform = liara.platform;
    }
    const composer = index.has("composer.json") ? json("composer.json") : null;
    const require = composer ? record(composer.require ?? {}, "composer.json") : {};
    const laravel = typeof require["laravel/framework"] === "string" || typeof require["laravel/lumen-framework"] === "string";
    const php = laravel || composer !== null || [...index.keys()].some(path => /\.php$/i.test(path) && !/(?:^|\/)(?:tests?|examples?|fixtures?)\//i.test(path));
    const pythonFiles = [...index.keys()].filter(path => /\.py$/.test(path) && !/(?:^|\/)(?:tests?|examples?|fixtures?)\//i.test(path));
    const shapes = new Map(pythonFiles.map(path => [path, codeShape(text(path), true)]));
    const requirements = index.has("requirements.txt") ? text("requirements.txt").replace(/#.*$/gm, "") : "";
    const django = /^\s*django(?:[\s[<>=!~;]|$)/im.test(requirements) || [...shapes.values()].some(code => /^\s*(?:from\s+django(?:\.|\s)|import\s+django\b)/m.test(code));
    const flask = /^\s*flask(?:[\s[<>=!~;]|$)/im.test(requirements) || [...shapes.values()].some(code => /^\s*(?:from\s+flask\s|import\s+flask\b)/m.test(code));
    const projects = [...index.keys()].filter(path => /\.(?:cs|fs|vb)proj$/i.test(path));
    const candidates: NativeLiaraPlatform[] = [
      ...(php ? [laravel ? "laravel" as const : "php" as const] : []),
      ...(django ? ["django" as const] : []), ...(flask ? ["flask" as const] : []),
      ...(projects.length ? ["dotnet" as const] : []), ...(index.has("go.mod") ? ["go" as const] : []),
    ];
    if (!platform && candidates.length > 1) reject("NATIVE_PLATFORM_AMBIGUOUS", "بیش از یک محیط مستقل پیدا شد؛ ریشه یا مسیر انتشار را مشخص کنید.");
    if (!platform && !candidates.length && (index.has("package.json") || pythonFiles.length > 0)) return notApplicable;
    // An existing Dockerfile is an alternative, not permission to override a language's native route.
    platform ??= candidates[0] ?? (index.has("Dockerfile") ? "docker" : null);
    if (!platform) return notApplicable;
    const selectedPlatform = platform;
    if (platform !== "docker" && index.has("package.json") && !liara.platform && !laravel) {
      const scripts = record(json("package.json").scripts ?? {}, "package.json");
      if (typeof scripts.start === "string" && scripts.start.trim()) reject("NATIVE_PLATFORM_AMBIGUOUS", "فرانت یا سرور مستقل Node هم در این ریشه موجود است؛ انتخاب مسیر انتشار لازم است.", ["package.json"]);
    }
    const options = record(liara[platform] ?? {}, "liara.json");
    const configuration: Record<string, string | boolean> = {};
    const evidence: Array<{ path: string; kind: "configuration" | "manifest" | "entry" | "dockerfile" }> = [];
    const needs: NativePlatformIssue[] = [];
    const note = (code: string, message: string, paths: readonly string[] = []) => { needs.push({ code, message, paths }); };
    const proof = (path: string, kind: typeof evidence[number]["kind"]) => { if (!evidence.some(row => row.path === path && row.kind === kind)) evidence.push({ path, kind }); };
    if (index.has("liara.json")) proof("liara.json", "configuration");
    else if (liaraValue !== undefined) note("NATIVE_CONFIGURATION_BINDING", "تنظیمات ارائه‌شده باید به بایت‌های source و برنامهٔ مصوب بسته شوند؛ فایل تنظیمی در این ورودی وجود ندارد.");
    let runtimeVersion: string | null = null, versionSource: NativePlatformDescriptor["versionSource"] = "unspecified", versionRequirement: string | null = null;
    let entry: string | null = null, port: number | null = null;
    if (liara.port !== undefined) {
      if (!Number.isInteger(liara.port) || typeof liara.port !== "number" || liara.port < 1 || liara.port > 65535) reject("NATIVE_PORT_INVALID", "پورت صریح باید عددی بین ۱ و ۶۵۵۳۵ باشد.", ["liara.json"]);
      port = liara.port;
    }
    const versionKey = platform === "laravel" ? "phpVersion" : platform === "django" || platform === "flask" ? "pythonVersion" : "version";
    const setVersion = (value: unknown, source: NativePlatformDescriptor["versionSource"]) => {
      if (!isDocumentedLiaraVersion(selectedPlatform, value)) reject("NATIVE_VERSION_UNDOCUMENTED", "نسخهٔ درخواست‌شده در مستندات این پلتفرم ارائه نشده است.", source === "liara.json" ? ["liara.json"] : entry ? [entry] : []);
      runtimeVersion = String(value); versionSource = source; configuration[versionKey] = runtimeVersion;
    };
    if (platform !== "docker" && options[versionKey] !== undefined) setVersion(options[versionKey], "liara.json");
    const booleanOptions = platform === "django" ? ["mirror", "collectStatic", "compileMessages", "modifySettings", "geospatial"]
      : platform === "flask" ? ["mirror"] : platform === "php" || platform === "laravel" ? ["composerMirror"] : [];
    for (const key of booleanOptions) {
      if (options[key] === undefined) continue;
      if (typeof options[key] !== "boolean") reject("NATIVE_CONFIGURATION_INVALID", "گزینهٔ پلتفرم باید مقدار روشن یا خاموش داشته باشد.", ["liara.json"]);
      configuration[key] = options[key];
    }
    if (options.timezone !== undefined) {
      if (typeof options.timezone !== "string" || !/^[A-Za-z_+-]+(?:\/[A-Za-z0-9_+-]+){0,2}$/.test(options.timezone) || options.timezone.length > 80)
        reject("NATIVE_CONFIGURATION_INVALID", "منطقهٔ زمانی پلتفرم معتبر نیست.", ["liara.json"]);
      configuration.timezone = options.timezone;
    }
    const knownOptions = new Set([...booleanOptions, versionKey, "timezone", ...(platform === "go" ? ["mainFile"] : platform === "dotnet" ? ["csprojectFile", "finalDllName"] : platform === "flask" ? ["appModule"] : [])]);
    if (Object.keys(options).some(key => !knownOptions.has(key))) note("NATIVE_CONFIGURATION_REVIEW", "گزینه‌های دیگر پلتفرم در این descriptor منتقل نشده‌اند و نیاز به بررسی دارند.", ["liara.json"]);
    if (liara.args !== undefined || liara.build !== undefined) note("NATIVE_CUSTOM_COMMAND_REVIEW", "فرمان یا تنظیم ساخت اختصاصی به برنامهٔ اجرای مستقل نیاز دارد.", ["liara.json"]);
    if (platform === "php" || platform === "laravel") {
      if (!php || platform === "laravel" && !laravel || platform === "php" && laravel) reject("NATIVE_PLATFORM_MISMATCH", "پلتفرم PHP و framework موجود در source برابر نیستند.", ["composer.json"]);
      if (composer) {
        proof("composer.json", "manifest");
        if (!index.has("composer.lock")) note("NATIVE_DEPENDENCY_LOCK", "نسخهٔ وابستگی‌ها باید پیش از ساخت تثبیت شود؛ lock موجود حذف نمی‌شود.", ["composer.json"]);
        else proof("composer.lock", "manifest");
        if (require.php !== undefined) {
          if (typeof require.php !== "string" || require.php.length > 160 || !/^[0-9.*xX<>=!~^|, \t-]+$/.test(require.php)) reject("NATIVE_VERSION_REQUIREMENT", "قید نسخه PHP باید به‌صورت مستقل بررسی شود.", ["composer.json"]);
          const range = semver.validRange(require.php.replace(/\|{1,2}/g, "||").replaceAll(",", " "));
          if (!range) reject("NATIVE_VERSION_REQUIREMENT", "قید نسخه PHP قابل تطبیق نیست.", ["composer.json"]);
          versionRequirement = require.php;
          const compatible = (liaraPlatformDocumentation[platform].versions ?? []).filter(version => semver.intersects(`${version}.x`, range));
          if (!compatible.length || runtimeVersion && !compatible.includes(runtimeVersion)) reject("NATIVE_VERSION_CONFLICT", "نسخه PHP با composer.json سازگار نیست.", ["composer.json", "liara.json"]);
          if (!runtimeVersion && compatible.length === 1) setVersion(compatible[0], "manifest");
          if (runtimeVersion && !semver.subset(`${runtimeVersion}.x`, range)) note("NATIVE_PATCH_VERSION_CHECK", "نسخهٔ جزئی واقعی PHP هم باید با قید پروژه برابر باشد.", ["composer.json"]);
        }
        if (Object.keys(require).some(key => key.startsWith("ext-"))) note("NATIVE_EXTENSIONS_CHECK", "اکستنشن‌های PHP موردنیاز باید در محیط ساخت بررسی شوند.", ["composer.json"]);
        if (composer.scripts !== undefined || composer.config !== undefined) note("NATIVE_COMPOSER_EXECUTION_REVIEW", "script و pluginهای Composer در برنامهٔ ساخت مصوب بررسی شوند.", ["composer.json"]);
      }
      if (platform === "laravel") {
        if (!index.has("artisan") || !index.has("public/index.php")) reject("NATIVE_ENTRY_MISSING", "ریشهٔ Laravel باید artisan و public/index.php داشته باشد.", ["artisan", "public/index.php"]);
        entry = "public/index.php"; proof("artisan", "entry");
        note("NATIVE_LARAVEL_RESOURCES", "تنظیمات، کلید برنامه، storage و نیاز احتمالی DB یا queue باید بررسی شوند؛ migration مجوز جدا می‌خواهد.", ["composer.json"]);
        if (index.has("package.json")) note("NATIVE_FRONTEND_BUILD", "ساخت و فایل‌های رابط Laravel هم باید در artifact نهایی باشند.", ["package.json"]);
      } else {
        const entries = [...index.keys()].filter(path => /(?:^|\/)index\.php$/i.test(path));
        entry = index.has("index.php") ? "index.php" : entries.length === 1 ? entries[0] ?? null : null;
        if (!entry) note("NATIVE_WEB_ROOT_REQUIRED", "مسیر document root و صفحهٔ ورودی PHP باید مشخص شود.");
        else if (entry !== "index.php") note("NATIVE_WEB_ROOT_REQUIRED", "وب‌سرور باید به ریشهٔ همین front controller متصل شود.", [entry]);
      }
    } else if (platform === "go") {
      if (!index.has("go.mod")) reject("NATIVE_ENTRY_MISSING", "فایل go.mod در ریشهٔ انتخابی موجود نیست.", ["go.mod"]);
      proof("go.mod", "manifest");
      const manifest = codeShape(text("go.mod")), declared = /^\s*go\s+(\d+\.\d+)(?:\.\d+)?\s*$/m.exec(manifest)?.[1];
      const toolchain = /^\s*toolchain\s+go(\d+\.\d+)(?:\.\d+)?\s*$/m.exec(manifest)?.[1];
      if (!declared) reject("NATIVE_VERSION_REQUIREMENT", "نسخهٔ go در go.mod باید مشخص باشد.", ["go.mod"]);
      versionRequirement = declared;
      if (!runtimeVersion) setVersion(declared, "manifest");
      if (runtimeVersion && semver.lt(`${runtimeVersion}.0`, `${declared}.0`) || toolchain && runtimeVersion && semver.lt(`${runtimeVersion}.0`, `${toolchain}.0`)) reject("NATIVE_VERSION_CONFLICT", "نسخهٔ Go از نیاز module یا toolchain قدیمی‌تر است.", ["go.mod", "liara.json"]);
      const mains = [...index.keys()].filter(path => path.endsWith(".go") && !path.endsWith("_test.go") && /^\s*package\s+main\b/m.test(codeShape(text(path))) && /\bfunc\s+main\s*\(/.test(codeShape(text(path))));
      if (options.mainFile !== undefined) { entry = localPath(options.mainFile, "liara.json"); if (!mains.includes(entry)) reject("NATIVE_ENTRY_MISSING", "فایل اصلی Go باید یک package main واقعی در source باشد.", [entry]); }
      else if (mains.length === 1) entry = mains[0] ?? null;
      else reject("NATIVE_ENTRY_AMBIGUOUS", "یک entry اصلی Go لازم است؛ مقدار go.mainFile یا ریشهٔ برنامه را مشخص کنید.", ["go.mod"]);
      if (!entry) reject("NATIVE_ENTRY_MISSING", "فایل اصلی Go پیدا نشد.", ["go.mod"]);
      configuration.mainFile = entry;
      if (/\bimport\s+(?:\(\s*)?"C"/.test(`${manifest}\n${[...index.keys()].filter(path => path.endsWith(".go")).map(text).join("\n")}`)) note("NATIVE_CGO_CHECK", "این source به بررسی toolchain و کتابخانه‌های cgo نیاز دارد.");
      note("NATIVE_GO_TOOLCHAIN_CHECK", "نسخهٔ دقیق compiler، go.sum و وابستگی‌های module باید در محیط ایزوله بررسی شوند.", ["go.mod"]);
    } else if (platform === "dotnet") {
      const web = projects.filter(path => /<Project\b[^>]*\bSdk\s*=\s*["']Microsoft\.NET\.Sdk\.Web["']|<Sdk\b[^>]*\bName\s*=\s*["']Microsoft\.NET\.Sdk\.Web["']|<FrameworkReference\b[^>]*\bInclude\s*=\s*["']Microsoft\.AspNetCore\.App["']/i.test(text(path).replace(/<!--[\s\S]*?-->/g, "")));
      if (options.csprojectFile !== undefined) { entry = localPath(options.csprojectFile, "liara.json"); if (!web.includes(entry)) reject("NATIVE_ENTRY_MISSING", "پروژهٔ وب NET. انتخاب‌شده در source موجود نیست.", [entry]); }
      else if (web.length === 1) entry = web[0] ?? null;
      else reject("NATIVE_ENTRY_AMBIGUOUS", "پروژهٔ وب NET. را با csprojectFile انتخاب کنید؛ solution به‌تنهایی entry نیست.", projects);
      if (!entry) reject("NATIVE_ENTRY_MISSING", "پروژهٔ وب NET. پیدا نشد.", projects);
      const project = text(entry).replace(/<!--[\s\S]*?-->/g, "");
      const frameworks = [...project.matchAll(/<TargetFrameworks?>\s*([^<]+)\s*<\/TargetFrameworks?>/g)].flatMap(match => (match[1] ?? "").trim().split(";").map(value => value.trim()));
      if (frameworks.length !== 1 || !/^net(?:coreapp)?\d+\.\d+$/.test(frameworks[0] ?? "")) reject("NATIVE_DOTNET_TARGET_REQUIRED", "target framework یکتای وب و قابل اجرا روی Linux لازم است؛ پروژهٔ چندهدفه یا وابسته به Windows به آماده‌سازی نیاز دارد.", [entry]);
      const target = frameworks[0]?.replace(/^net(?:coreapp)?/, "") ?? "";
      versionRequirement = target;
      if (!runtimeVersion) setVersion(target, "manifest");
      if (runtimeVersion !== target) reject("NATIVE_VERSION_CONFLICT", "runtime نسخهٔ NET. با target framework برابر نیست.", [entry, "liara.json"]);
      configuration.csprojectFile = entry;
      if (options.finalDllName !== undefined) {
        if (typeof options.finalDllName !== "string" || !/^[A-Za-z0-9_][A-Za-z0-9_.-]{0,159}$/.test(options.finalDllName)) reject("NATIVE_ENTRY_PATH_INVALID", "نام assembly خروجی معتبر نیست.", ["liara.json"]);
        configuration.finalDllName = options.finalDllName;
      }
      if (index.has("global.json")) { proof("global.json", "manifest"); note("NATIVE_DOTNET_SDK_CHECK", "SDK و سیاست rollForward در global.json باید با محیط provider تطبیق داشته باشد.", ["global.json"]); }
      note("NATIVE_DOTNET_RESTORE_CHECK", "restore، publish، assembly و binding واقعی برنامهٔ وب باید بررسی شوند.", [entry]);
    } else if (platform === "django" || platform === "flask") {
      if (!(platform === "django" ? django : flask)) reject("NATIVE_PLATFORM_MISMATCH", "framework Python انتخاب‌شده در source پیدا نشد.");
      if (index.has("requirements.txt")) proof("requirements.txt", "manifest");
      else note("NATIVE_PYTHON_REQUIREMENTS", "برای مسیر بومی، requirements.txt تثبیت‌شده باید از manifest واقعی آماده شود.", ["pyproject.toml"]);
      if (platform === "django") {
        const management = pythonFiles.filter(path => /\bexecute_from_command_line\s*\(/.test(shapes.get(path) ?? "") && /\bdjango\.core\.management\b/.test(shapes.get(path) ?? ""));
        if (management.length !== 1) reject("NATIVE_ENTRY_AMBIGUOUS", "فایل مدیریت یکتای Django در ریشهٔ همین برنامه لازم است.", management);
        entry = management[0] ?? null;
        if (entry !== "manage.py") note("NATIVE_DJANGO_ROOT", "فایل مدیریت باید در مسیر مورد انتظار پلتفرم آماده شود.", entry ? [entry] : []);
        const gateways = pythonFiles.filter(path => /\bget_(?:wsgi|asgi)_application\s*\(/.test(shapes.get(path) ?? ""));
        if (!gateways.length) note("NATIVE_PYTHON_GATEWAY", "ورودی WSGI یا ASGI و settings قابل import باید مشخص شود.");
        else for (const path of gateways) proof(path, "entry");
        note("NATIVE_DJANGO_RESOURCES", "settings، collectstatic، media، DB و migration جداگانه بررسی شوند؛ تشخیص framework مجوز migration نیست.");
      } else {
        const apps: Array<{ path: string; module: string }> = [];
        for (const [path, shape] of shapes) {
          const aliases = [...shape.matchAll(/^from\s+flask\s+import\s+(\([^)]*\)|[^\n]+)/gm)]
            .flatMap(statement => [...(statement[1] ?? "").replace(/[()]/g, " ").matchAll(/(?:^|[,\s])Flask(?:\s+as\s+(\w+))?(?=$|[,\s])/g)].map(match => match[1] ?? "Flask"));
          const moduleAliases = [...shape.matchAll(/^import\s+flask(?:\s+as\s+(\w+))?/gm)].map(match => match[1] ?? "flask");
          for (const match of shape.matchAll(/^(\w+)\s*(?::[^=\n]+)?=\s*([\w.]+)\s*\(/gm)) {
            if (aliases.includes(match[2] ?? "") || moduleAliases.some(alias => match[2] === `${alias}.Flask`))
              apps.push({ path, module: `${path.replace(/\/__init__\.py$/, "").replace(/\.py$/, "").replaceAll("/", ".")}:${match[1]}` });
          }
        }
        if (options.appModule !== undefined) {
          if (typeof options.appModule !== "string" || !/^[A-Za-z_]\w*(?:\.[A-Za-z_]\w*)*:[A-Za-z_]\w*(?:\(\))?$/.test(options.appModule)) reject("NATIVE_ENTRY_PATH_INVALID", "ورودی Flask باید module و نام برنامه یا factory بدون آرگومان باشد.", ["liara.json"]);
          const module = options.appModule.split(":")[0] ?? "";
          const matches = [`${module.replaceAll(".", "/")}.py`, `${module.replaceAll(".", "/")}/__init__.py`].filter(path => index.has(path));
          if (matches.length !== 1) reject("NATIVE_ENTRY_MISSING", "ماژول Flask انتخاب‌شده در source به‌طور یکتا موجود نیست.", matches);
          entry = matches[0] ?? null; configuration.appModule = options.appModule;
          note("NATIVE_PYTHON_IMPORT_CHECK", "وجود callable یا factory باید در محیط ایزوله تأیید شود.", entry ? [entry] : []);
        } else if (apps.length === 1) { entry = apps[0]?.path ?? null; configuration.appModule = apps[0]?.module ?? ""; }
        else reject("NATIVE_ENTRY_AMBIGUOUS", "appModule یکتای Flask لازم است؛ factory یا چند برنامه به انتخاب صریح نیاز دارد.", apps.map(app => app.path));
      }
      if (index.has("pyproject.toml")) { proof("pyproject.toml", "manifest"); note("NATIVE_PYTHON_VERSION_CHECK", "requires-python و وابستگی‌های pyproject باید با محیط و requirements برابر باشند.", ["pyproject.toml"]); }
    } else {
      const build = record(liara.build ?? {}, "liara.json");
      entry = build.dockerfile === undefined ? "Dockerfile" : localPath(build.dockerfile, "liara.json");
      if (!index.has(entry)) reject("NATIVE_ENTRY_MISSING", "Dockerfile انتخاب‌شده در source موجود نیست.", [entry]);
      const lines = text(entry).replace(/\\\r?\n/g, " ").split(/\r?\n/).map(line => line.trim()).filter(line => line && !line.startsWith("#"));
      const stages = lines.map((line, at) => /^FROM\s+/i.test(line) ? at : -1).filter(at => at >= 0), finalStage = stages.at(-1);
      if (finalStage === undefined) reject("NATIVE_DOCKERFILE_INVALID", "Dockerfile باید مرحلهٔ FROM داشته باشد.", [entry]);
      for (const line of lines) {
        const instruction = /^(COPY|ADD)\s+(.+)$/i.exec(line);
        if (!instruction) continue;
        let operands = instruction[2] ?? "";
        if (/^(?:--[\w-]+(?:=[^\s]+)?\s+)*--from(?:=|\s)/i.test(operands)) continue;
        operands = operands.replace(/^(?:--[A-Za-z][\w-]*(?:=[^\s]+)?\s+)+/, "");
        let sources: string[];
        if (operands.startsWith("[")) {
          let parsed: unknown;
          try { parsed = JSON.parse(operands); } catch { reject("NATIVE_DOCKERFILE_INVALID", "آرگومان JSON در Dockerfile معتبر نیست.", [entry]); }
          if (!Array.isArray(parsed) || parsed.length < 2 || !parsed.every(value => typeof value === "string")) reject("NATIVE_DOCKERFILE_INVALID", "COPY یا ADD باید source و مقصد مشخص داشته باشد.", [entry]);
          sources = parsed.slice(0, -1);
        } else if (/["'`$*?[\]]/.test(operands)) {
          note("NATIVE_DOCKER_CONTEXT_REVIEW", "source پویا یا الگوی COPY/ADD باید با context واقعی بررسی شود.", [entry]); continue;
        } else {
          sources = operands.trim().split(/\s+/).slice(0, -1);
          if (!sources.length) reject("NATIVE_DOCKERFILE_INVALID", "COPY یا ADD باید source و مقصد مشخص داشته باشد.", [entry]);
        }
        for (const source of sources) {
          if (/^(?:[a-z][a-z0-9+.-]*:\/\/|git@)/i.test(source)) reject("NATIVE_DOCKER_REMOTE_INPUT", "ورودی دوردست ساخت باید پیش از اجرا جداگانه تثبیت و بررسی شود.", [entry]);
          if (source === "." || source === "./") continue;
          const path = localPath(source.replace(/\/+$/, ""), entry);
          if (!index.has(path) && ![...index.keys()].some(file => file.startsWith(`${path}/`))) reject("NATIVE_DOCKER_CONTEXT_MISSING", "یکی از ورودی‌های Dockerfile در بستهٔ source وجود ندارد؛ بستهٔ ناقص آمادهٔ ساخت نیست.", [entry]);
        }
      }
      const exposed = lines.slice(finalStage + 1).filter(line => /^EXPOSE\s+/i.test(line)).flatMap(line => line.replace(/\s+#.*$/, "").replace(/^EXPOSE\s+/i, "").split(/\s+/));
      if (port === null && exposed.length === 1 && /^\d+(?:\/tcp)?$/.test(exposed[0] ?? "")) {
        const value = Number(exposed[0]?.replace(/\/tcp$/, "")); if (value > 0 && value <= 65535) port = value;
      }
      configuration.dockerfile = entry; proof(entry, "dockerfile");
      note("NATIVE_DOCKER_BUILD_CHECK", "Dockerfile باید در builder محدود و با image و context مشخص ساخته شود؛ کد آن روی میزبان اجرا نمی‌شود.", [entry]);
      note("NATIVE_DOCKER_START_CHECK", "CMD یا ENTRYPOINT و binding واقعی image نهایی هنوز آزموده نشده است.", [entry]);
      if ([...index.keys()].some(path => /(?:^|\/)(?:docker-)?compose\.ya?ml$/.test(path))) note("NATIVE_COMPOSE_SERVICES", "سرویس‌ها، شبکه‌ها و volumeهای Compose به برنامهٔ چندمنبعی مستقل نیاز دارند.");
    }
    if (entry) proof(entry, "entry");
    if (!runtimeVersion && platform !== "docker") note("NATIVE_VERSION_REQUIRED", "نسخهٔ صریح و سازگار با manifest لازم است؛ default مستند به‌جای محیط تأییدشده انتخاب نشد.");
    if (port === null) note("NATIVE_PORT_REQUIRED", "پورت HTTP و binding از source قطعی نشد؛ باید در برنامهٔ اجرا تعیین و بررسی شود.");
    note("NATIVE_EXECUTION_REQUIRED", "ساخت، شروع و معیار واقعی پاسخ سایت در این بررسی ایستا اجرا نشده‌اند.");
    return { state: "detected", publishable: false, descriptor: { platform, runtimeVersion, versionSource, versionRequirement, entry,
      startCommand: null, buildCommand: null, port, configuration, evidence, requirements: needs, publishable: false } };
  } catch (cause) {
    return { state: "unsupported", platform, issues: [cause instanceof UnsupportedNative ? cause.issue : { code: "NATIVE_INSPECTION_FAILED", message: "بررسی ایستای این ریشه کامل نشد؛ تنظیمات و ورودی را بررسی کنید.", paths: [] }], publishable: false };
  }
}
