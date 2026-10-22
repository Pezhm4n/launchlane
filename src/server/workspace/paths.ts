import { lstat, realpath } from "node:fs/promises";
import { isAbsolute, parse, relative, resolve, sep } from "node:path";
import { AppError, ensure } from "../errors.ts";

const excludedNames = new Set([
  ".git",
  ".hg",
  ".svn",
  "node_modules",
  ".next",
  ".data",
  ".local",
  ".artifacts",
  ".agents",
  ".cache",
  ".npm",
  ".yarn",
  "coverage",
  "dist",
  "build",
  "out",
  "vendor",
  ".vercel",
  ".liara",
  ".ssh",
  ".aws",
  "__pycache__",
]);
export function excludedPath(name: string): boolean {
  return (
    excludedNames.has(name.toLowerCase()) ||
    /^\.env/i.test(name) ||
    /(?:credential|password|secret|access[-_]?token|api[-_]?key)/i.test(name) ||
    /\.(?:pem|key|p12|pfx|db|sqlite\d*|log|gz|zip|tar)$/i.test(name) ||
    /^(?:\.npmrc|\.netrc|id_rsa|id_ed25519)$/i.test(name)
  );
}
export function sourceFileAllowed(name: string): boolean {
  return (
    /\.(?:[cm]?[jt]sx?|json|lock|md|txt|html?|css|scss|svg|png|jpe?g|webp|ico|woff2?|ya?ml)$/i.test(
      name,
    ) || ["Dockerfile", "Procfile", ".dockerignore", ".gitignore"].includes(name)
  );
}
export function under(root: string, target: string): boolean {
  const path = relative(root, target);
  return path === "" || (!isAbsolute(path) && path !== ".." && !path.startsWith(`..${sep}`));
}
export function checkName(name: string): void {
  ensure(
    name.length > 0 && name.length <= 160 && /^[\p{L}\p{N}._ @()+[\]-]+$/u.test(name),
    "UNSAFE_PATH",
    "نام یکی از فایل‌ها پشتیبانی نمی‌شود؛ نام ساده‌تری انتخاب کنید.",
  );
}
export function filesystemError(error: unknown, changed = false): AppError {
  if (error instanceof AppError) return error;
  const code = typeof error === "object" && error !== null && "code" in error ? error.code : null;
  if (code === "ENOENT")
    return new AppError(
      changed ? "SOURCE_CHANGED" : "FOLDER_NOT_FOUND",
      changed
        ? "یکی از فایل‌های پروژه حذف یا جابه‌جا شده است. پروژه را دوباره بررسی کنید."
        : "این پوشه پیدا نشد. پوشه دیگری انتخاب کنید.",
      changed ? 409 : 404,
    );
  if (code === "EACCES" || code === "EPERM")
    return new AppError(
      "FOLDER_ACCESS_DENIED",
      "اجازه خواندن این پوشه یا فایل‌های آن را نداریم. دسترسی پوشه را بررسی کنید یا پوشه دیگری انتخاب کنید.",
      403,
    );
  if (code === "ENOTDIR")
    return new AppError("INVALID_FOLDER", "این مسیر یک پوشه نیست. پوشه پروژه را انتخاب کنید.");
  if (code === "ELOOP")
    return new AppError(
      "UNSAFE_PATH",
      "این پوشه دارای پیوند نامعتبر است. پوشه اصلی پروژه را انتخاب کنید.",
      403,
    );
  return new AppError(
    "FILESYSTEM_UNAVAILABLE",
    "خواندن پوشه کامل نشد. دسترسی و اتصال دیسک را بررسی و دوباره تلاش کنید.",
    503,
  );
}
export async function workspaceDirectory(
  workspaceRoot: string,
  directory: string,
): Promise<{ root: string; target: string }> {
  ensure(
    directory === "." ||
      (directory.length > 0 &&
        directory.length <= 240 &&
        !isAbsolute(directory) &&
        !directory.includes("\\") &&
        !directory.includes(":") &&
        directory
          .split("/")
          .every((part) => part && part !== ".." && part !== "." && !excludedPath(part))),
    "UNSAFE_PATH",
    "این پوشه در محدوده مجاز نیست. پوشه‌ای از فهرست انتخاب کنید.",
    403,
  );
  try {
    const root = await realpath(workspaceRoot);
    ensure(
      root !== parse(root).root,
      "WORKSPACE_TOO_BROAD",
      "برای حفظ امنیت، یک پوشه پروژه‌ها را به‌جای کل دیسک مجاز کنید.",
      503,
    );
    const target = resolve(root, directory);
    ensure(under(root, target), "UNSAFE_PATH", "این پوشه در محدوده مجاز نیست.", 403);
    let cursor = root;
    for (const part of directory === "." ? [] : directory.split("/")) {
      checkName(part);
      cursor = resolve(cursor, part);
      const stat = await lstat(cursor);
      ensure(
        !stat.isSymbolicLink() && under(root, await realpath(cursor)),
        "UNSAFE_PATH",
        "پوشه اصلی پروژه را انتخاب کنید؛ پیوند به پوشه دیگر مجاز نیست.",
        403,
      );
      ensure(
        stat.isDirectory(),
        "INVALID_FOLDER",
        "این مسیر یک پوشه نیست. پوشه پروژه را انتخاب کنید.",
      );
    }
    return { root, target };
  } catch (error) {
    throw filesystemError(error);
  }
}
