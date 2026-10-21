import { ensure } from "../server/errors.ts";
import { integer, object, string } from "./validation.ts";

export type FolderListing = {
  directory: string;
  name: string;
  parent: string | null;
  hasPackage: boolean;
  folders: { name: string; directory: string; hasPackage: boolean }[];
  nextOffset: number | null;
  hiddenCount: number;
};
export function parseFolders(value: unknown): FolderListing {
  const raw = object(value);
  ensure(
    typeof raw.hasPackage === "boolean" && Array.isArray(raw.folders) && raw.folders.length <= 50,
    "INVALID_RESPONSE",
    "فهرست پوشه‌ها معتبر نیست.",
  );
  return {
    directory: string(raw.directory, 240),
    name: string(raw.name, 160),
    parent: raw.parent === null ? null : string(raw.parent, 240),
    hasPackage: raw.hasPackage,
    hiddenCount: integer(raw.hiddenCount, 0, 500),
    nextOffset: raw.nextOffset === null ? null : integer(raw.nextOffset, 0, 500),
    folders: raw.folders.map((value: unknown) => {
      const item = object(value);
      ensure(typeof item.hasPackage === "boolean", "INVALID_RESPONSE", "نوع پوشه معتبر نیست.");
      return {
        name: string(item.name, 160),
        directory: string(item.directory, 240),
        hasPackage: item.hasPackage,
      };
    }),
  };
}
