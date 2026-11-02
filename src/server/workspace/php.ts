import semver from "semver";
import { parsePhpRuntime, type PhpRuntime } from "../../contracts/php-runtime.ts";
import type { NativePlatformInspection } from "../../contracts/liara-platform.ts";
import type { SourceFile } from "./inspect.ts";
import { object } from "../../contracts/validation.ts";
import { ensure } from "../errors.ts";

export function sourcePhpRuntime(files: readonly SourceFile[], inspection: NativePlatformInspection, liara: Record<string, unknown>): PhpRuntime | undefined {
  if (inspection.state !== "detected" || !["php", "laravel"].includes(inspection.descriptor.platform) || liara.platform !== inspection.descriptor.platform) return;
  const descriptor = inspection.descriptor, options = object(liara[descriptor.platform] ?? {});
  if (descriptor.runtimeVersion !== "8.3" || descriptor.port === null || options.composerMirror !== false) return;
  const manifest = files.find(file => file.path === "composer.json"), lock = files.find(file => file.path === "composer.lock");
  ensure(manifest && lock, "PHP_LOCK_REQUIRED", "composer.json و composer.lock اصلی هر دو لازم‌اند؛ lock تولید یا جایگزین نمی‌شود.", 409);
  const pkg = object(JSON.parse(manifest.content.toString("utf8"))), config = object(pkg.config ?? {}), dependencies = object(pkg.require ?? {});
  ensure(pkg.repositories === undefined && config["vendor-dir"] === undefined && config["bin-dir"] === undefined && config.platform === undefined && config["disable-tls"] !== true && config["secure-http"] !== false,
    "PHP_COMPOSER_CONFIGURATION_UNSUPPORTED", "repository، مسیر vendor یا platform جعلی Composer باید مستقل بررسی شوند.", 409);
  ensure(typeof dependencies.php === "string" && semver.satisfies("8.3.36", dependencies.php.replace(/\|{1,2}/g, "||").replaceAll(",", " ")), "PHP_VERSION_CONFLICT", "نسخهٔ واقعی PHP با قید اصلی Composer برابر نیست.", 409);
  ensure(!files.some(file => file.path !== "composer.json" && file.path.endsWith("/composer.json")), "PHP_COMPONENT_SCOPE_REQUIRED", "چند component Composer به برنامهٔ اجرای مستقل نیاز دارند.", 409);
  const node = files.find(file => file.path === "package.json");
  if (node) { const scripts = object(object(JSON.parse(node.content.toString())).scripts ?? {}); ensure(!scripts.build && !scripts.start, "PHP_FRONTEND_BUILD_REQUIRED", "ساخت یا سرور مستقل Node این پروژه باید به artifact مشترک متصل شود؛ حذف نمی‌شود.", 409); }
  const tests = files.filter(file => ["phpunit.xml", "phpunit.xml.dist"].includes(file.path));
  ensure(tests.length === 1 && object(pkg["require-dev"] ?? {})["phpunit/phpunit"], "PHP_TEST_CONFIGURATION_REQUIRED", "یک تنظیم اصلی PHPUnit و dependency تست تثبیت‌شده لازم است.", 409);
  ensure(!files.some(file => ["php.ini", ".user.ini"].includes(file.path)), "PHP_INI_UNSUPPORTED", "تنظیمات PHP خصوصی یا سفارشی به بررسی مستقل نیاز دارند.", 409);
  const documentRoot = descriptor.entry === "index.php" ? "." : descriptor.entry === "public/index.php" ? "public" : null;
  ensure(documentRoot, "PHP_DOCUMENT_ROOT_REQUIRED", "document root صریح این مسیر باید root یا public باشد.", 409);
  return parsePhpRuntime({ kind: descriptor.platform, version: "8.3.36", documentRoot, testConfiguration: tests[0]?.path, port: descriptor.port });
}
