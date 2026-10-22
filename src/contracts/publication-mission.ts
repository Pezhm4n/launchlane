import { ensure } from "../server/errors.ts";
import { exactKeys, hash, object, string, text } from "./validation.ts";

export type PublicationInput = {
  projectId: string;
  sourceHash: string;
  path: string;
  expectedText: string | null;
};
export type PublicationMission = PublicationInput & {
  kind: "publication";
  identity: string;
};
export function parsePublicationInput(value: unknown): PublicationInput {
  const row = object(value);
  exactKeys(row, ["projectId", "sourceHash", "path", "expectedText"]);
  const projectId = string(row.projectId, 36), path = string(row.path, 200);
  ensure(/^[a-f0-9-]{36}$/.test(projectId), "INVALID_INPUT", "پروژه انتخاب‌شده معتبر نیست.");
  ensure(/^\/(?!\/)[^?#\\\s]*$/.test(path) && [...path].every(char => char.charCodeAt(0) >= 32 && char.charCodeAt(0) !== 127), "INVALID_INPUT", "مسیر صفحه باید با / شروع شود و نشانی کامل یا پارامتر نداشته باشد.");
  const expectedText = row.expectedText === null ? null : text(row.expectedText, 240).trim();
  ensure(expectedText === null || expectedText.length >= 3, "INVALID_INPUT", "نشانه پاسخ باید دست‌کم سه نویسه باشد؛ یا انتخاب خودکار را نگه دارید.");
  return { projectId, sourceHash: hash(row.sourceHash), path, expectedText };
}
export function parsePublicationMission(value: unknown): PublicationMission {
  const row = object(value);
  exactKeys(row, ["kind", "identity", "projectId", "sourceHash", "path", "expectedText"]);
  ensure(row.kind === "publication", "STORAGE_INVALID", "نوع مأموریت انتشار معتبر نیست.");
  return { ...parsePublicationInput({ projectId: row.projectId, sourceHash: row.sourceHash, path: row.path, expectedText: row.expectedText }), kind: "publication", identity: hash(row.identity) };
}
