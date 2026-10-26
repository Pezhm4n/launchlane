import { exactKeys, integer, object, string } from "./validation.ts";
import { ensure } from "../server/errors.ts";
import { parseFullstackPreparation, type FullstackPreparation } from "./fullstack.ts";

export type NodePreparation = Readonly<{ version: 1; entryFile: string; port: number; startCommand: string }> | FullstackPreparation;
export function nodePreparation(entryFile: unknown, port: unknown): NodePreparation {
  const path = string(entryFile, 512);
  ensure(/^[A-Za-z0-9_][A-Za-z0-9_./-]*\.[cm]?js$/.test(path) &&
    path.split("/").every((part) => part.length > 0 && part !== "." && part !== "..") && !/\.(?:test|spec)\.[cm]?js$/.test(path),
    "PREPARATION_ENTRY_DENIED", "فایل ورودی باید مسیر مستقیم یک فایل JavaScript باشد؛ گزینه یا فرمان shell مجاز نیست.", 403);
  return { version: 1, entryFile: path, port: integer(port, 1, 65535), startCommand: `node ${path}` };
}
export function parseNodePreparation(value: unknown): NodePreparation {
  const row = object(value);
  if (row.version === 2) return parseFullstackPreparation(row);
  exactKeys(row, ["version", "entryFile", "port", "startCommand"]);
  const plan = nodePreparation(row.entryFile, row.port);
  ensure(row.version === 1 && row.startCommand === plan.startCommand, "INVALID_INPUT", "فرمان آماده‌سازی با فایل ورودی برابر نیست.");
  return plan;
}
