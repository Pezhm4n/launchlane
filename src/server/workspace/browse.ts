import { lstat, opendir, realpath } from "node:fs/promises";
import { basename, resolve } from "node:path";
import type { FolderListing } from "../../contracts/folders.ts";
import { integer } from "../../contracts/validation.ts";
import { ensure } from "../errors.ts";
import { checkName, excludedPath, filesystemError, under, workspaceDirectory } from "./paths.ts";

async function hasPackage(folder: string): Promise<boolean> {
  try {
    const stat = await lstat(resolve(folder, "package.json"));
    return stat.isFile() && !stat.isSymbolicLink();
  } catch (error) {
    if (typeof error === "object" && error !== null && "code" in error && error.code === "ENOENT")
      return false;
    throw error;
  }
}
export async function browseFolders(
  workspaceRoot: string,
  directory: string,
  offset: number,
  signal: AbortSignal,
): Promise<FolderListing> {
  integer(offset, 0, 500);
  ensure(!signal.aborted, "CANCELLED", "انتخاب پوشه لغو شد.", 409);
  const { root, target } = await workspaceDirectory(workspaceRoot, directory);
  try {
    const folders: FolderListing["folders"] = [];
    let entries = 0,
      hiddenCount = 0;
    for await (const entry of await opendir(target, { bufferSize: 32 })) {
      ensure(!signal.aborted, "CANCELLED", "انتخاب پوشه لغو شد.", 409);
      ensure(
        ++entries <= 500,
        "FOLDER_LIMIT",
        "تعداد موارد این پوشه بیش از حد است. محدوده مجاز را به پوشه پروژه‌ها محدودتر کنید.",
        413,
      );
      if (!entry.isDirectory()) continue;
      if (excludedPath(entry.name) || entry.isSymbolicLink()) {
        hiddenCount++;
        continue;
      }
      try {
        checkName(entry.name);
      } catch {
        hiddenCount++;
        continue;
      }
      const path = resolve(target, entry.name),
        stat = await lstat(path);
      if (stat.isSymbolicLink() || !under(root, await realpath(path))) {
        hiddenCount++;
        continue;
      }
      const selected = directory === "." ? entry.name : `${directory}/${entry.name}`;
      if (selected.length > 240) {
        hiddenCount++;
        continue;
      }
      folders.push({ name: entry.name, directory: selected, hasPackage: await hasPackage(path) });
    }
    folders.sort((a, b) => a.name.localeCompare(b.name, "fa"));
    ensure(!signal.aborted, "CANCELLED", "انتخاب پوشه لغو شد.", 409);
    const checked = await workspaceDirectory(workspaceRoot, directory);
    ensure(
      checked.target === target,
      "SOURCE_CHANGED",
      "پوشه هنگام خواندن تغییر کرده است. دوباره انتخاب کنید.",
      409,
    );
    return {
      directory,
      name: basename(target),
      parent:
        directory === "."
          ? null
          : directory.includes("/")
            ? directory.slice(0, directory.lastIndexOf("/"))
            : ".",
      hasPackage: await hasPackage(target),
      folders: folders.slice(offset, offset + 50),
      nextOffset: offset + 50 < folders.length ? offset + 50 : null,
      hiddenCount,
    };
  } catch (error) {
    throw filesystemError(error);
  }
}
