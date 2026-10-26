import { sourceIgnore, type SourceIgnoreFile } from "../../contracts/source-ignore.ts";
import { excludedPath } from "../../contracts/source-paths.ts";
import { AppError } from "../errors.ts";
import type { SourceFile } from "./inspect.ts";

export function filterSourceFiles(files: readonly SourceFile[]): SourceFile[] {
  const inputs: SourceIgnoreFile[] = [];
  for (const file of files) {
    if (file.path.split("/").some(excludedPath) || file.path.split("/").at(-1) !== ".gitignore") continue;
    let content: string;
    try { content = new TextDecoder("utf-8", { fatal: true }).decode(file.content); }
    catch { throw new AppError("SOURCE_IGNORE_INVALID", "قواعد بسته‌بندی باید متن UTF-8 باشند.", 409); }
    inputs.push({ path: file.path, content });
  }
  const ignored = sourceIgnore(inputs);
  return files.filter(file => !file.path.split("/").some(excludedPath) && !ignored(file.path));
}
