import { createHash, randomUUID } from "node:crypto";
import { constants } from "node:fs";
import { link, lstat, mkdir, open, readdir, realpath, unlink } from "node:fs/promises";
import { join } from "node:path";
import { parseBuildOutputReceipt, type BuildOutputReceipt } from "../../contracts/build-output.ts";
import { exactKeys, hash, object } from "../../contracts/validation.ts";
import { AppError, ensure } from "../errors.ts";
import { decodeBuildOutputExport } from "./container-output.ts";
import { validateBuildOutput, type ValidatedBuildOutput } from "./build-output.ts";
import { readFile } from "node:fs/promises";
import { decodeComponentOutput, encodeComponentOutput, type ComponentOutput } from "./component-output.ts";

const digest = (bytes: Uint8Array) => createHash("sha256").update(bytes).digest("hex");
const writers = new Map<string, Promise<void>>();
// This installation has one writer process. Serialize quota checks and atomic publication together.
async function writeExclusively<T>(root: string, work: () => Promise<T>): Promise<T> {
  const previous = writers.get(root) ?? Promise.resolve();
  let release = () => {};
  const lease = new Promise<void>(done => { release = done; }); writers.set(root, lease);
  await previous;
  try { return await work(); }
  finally { release(); if (writers.get(root) === lease) writers.delete(root); }
}
async function directory(stateDir: string) {
  const root = await realpath(stateDir), target = join(root, "build-outputs");
  await mkdir(target, { recursive: true, mode: 0o700 });
  const stat = await lstat(target);
  ensure(stat.isDirectory() && !stat.isSymbolicLink() && await realpath(target) === target,
    "BUILD_OUTPUT_PATH_DENIED", "مسیر نگهداری خروجی ساخت امن نیست.", 503);
  return target;
}

export async function readBuildOutput(stateDir: string, value: BuildOutputReceipt,
  expected: Readonly<{ sourceHash: string; planHash: string }>): Promise<ValidatedBuildOutput> {
  const receipt = parseBuildOutputReceipt(value);
  ensure(receipt.version === 1, "BUILD_OUTPUT_BINDING_CHANGED", "رسید runtime جای خروجی frontend خوانده نمی‌شود.", 409);
  ensure(receipt.sourceHash === hash(expected.sourceHash) && receipt.planHash === hash(expected.planHash),
    "BUILD_OUTPUT_BINDING_CHANGED", "خروجی ساخت متعلق به همین نسخه و برنامهٔ مصوب نیست.", 409);
  const target = join(await directory(stateDir), `${receipt.artifactHash}.json`);
  try {
    const before = await lstat(target);
    ensure(before.isFile() && !before.isSymbolicLink() && before.nlink === 1 && before.size === receipt.bytes && await realpath(target) === target,
      "BUILD_OUTPUT_MISMATCH", "فایل خروجی ساخت تغییر کرده است.", 409);
    const file = await open(target, constants.O_RDONLY | (constants.O_NOFOLLOW || 0) | (constants.O_NONBLOCK || 0));
    let bytes: Buffer;
    try {
      const opened = await file.stat();
      ensure(opened.dev === before.dev && opened.ino === before.ino && opened.size === before.size,
        "BUILD_OUTPUT_MISMATCH", "فایل خروجی ساخت هنگام خواندن عوض شده است.", 409);
      const buffer = Buffer.alloc(receipt.bytes + 1); let length = 0;
      while (length < buffer.length) { const read = await file.read(buffer, length, buffer.length - length, null); if (!read.bytesRead) break; length += read.bytesRead; }
      bytes = buffer.subarray(0, length); const after = await file.stat();
      ensure(length === receipt.bytes && digest(bytes) === receipt.artifactHash && after.mtimeMs === before.mtimeMs && after.ctimeMs === before.ctimeMs && await realpath(target) === target,
        "BUILD_OUTPUT_MISMATCH", "بایت‌های خروجی ساخت با رسید برابر نیستند.", 409);
    } finally { await file.close(); }
    const row = object(JSON.parse(bytes.toString("utf8"))); exactKeys(row, ["version", "sourceHash", "planHash", "output"]);
    ensure(row.version === 1 && row.sourceHash === receipt.sourceHash && row.planHash === receipt.planHash,
      "BUILD_OUTPUT_BINDING_CHANGED", "تبار خروجی ساخت با نسخهٔ موردنظر برابر نیست.", 409);
    const result = decodeBuildOutputExport(Buffer.from(JSON.stringify(row.output)));
    ensure(result.files.length === receipt.fileCount && result.totalBytes === receipt.totalBytes,
      "BUILD_OUTPUT_MISMATCH", "فهرست خروجی ساخت با رسید پایدار برابر نیست.", 409);
    return result;
  } catch (error) {
    if (error instanceof AppError) throw error;
    throw new AppError("BUILD_OUTPUT_UNAVAILABLE", "خروجی ساخت در نگهداری پایدار در دسترس یا معتبر نیست.", 409);
  }
}

export async function readComponentOutput(stateDir: string, value: BuildOutputReceipt, expected: Readonly<{ sourceHash: string; planHash: string }>): Promise<ComponentOutput> {
  const receipt = parseBuildOutputReceipt(value);
  try {
  const target = join(await directory(stateDir), `${receipt.artifactHash}.component.gz`);
  ensure(receipt.version === 2 && receipt.sourceHash === expected.sourceHash && receipt.planHash === expected.planHash, "BUILD_OUTPUT_BINDING_CHANGED", "خروجی component با source و برنامه برابر نیست.", 409);
  const before = await lstat(target);
  ensure(before.isFile() && !before.isSymbolicLink() && before.nlink === 1 && before.size === receipt.bytes && await realpath(target) === target, "BUILD_OUTPUT_MISMATCH", "بستهٔ runtime عوض شده است.", 409);
  const file = await open(target, constants.O_RDONLY | (constants.O_NOFOLLOW || 0));
  try {
    const opened = await file.stat(); ensure(opened.dev === before.dev && opened.ino === before.ino && opened.size === before.size, "BUILD_OUTPUT_MISMATCH", "خروجی هنگام خواندن تغییر کرد.", 409);
    const bytes = await file.readFile(), after = await file.stat();
    ensure(bytes.length === receipt.bytes && digest(bytes) === receipt.artifactHash && after.mtimeMs === before.mtimeMs && after.ctimeMs === before.ctimeMs, "BUILD_OUTPUT_MISMATCH", "بایت‌های runtime با رسید برابر نیستند.", 409);
    const output = decodeComponentOutput(bytes);
    ensure(output.sourceHash === receipt.sourceHash && output.planHash === receipt.planHash && output.entries.length === receipt.fileCount && output.totalBytes === receipt.totalBytes,
      "BUILD_OUTPUT_BINDING_CHANGED", "تبار واقعی runtime با رسید برابر نیست.", 409); return output;
  } finally { await file.close(); }
  } catch (error) { if (error instanceof AppError) throw error; throw new AppError("BUILD_OUTPUT_UNAVAILABLE", "خروجی compiled در نگهداری پایدار در دسترس یا معتبر نیست.", 409); }
}
export async function persistComponentOutput(stateDir: string, output: ComponentOutput): Promise<BuildOutputReceipt> {
  const bytes = encodeComponentOutput(output), receipt = parseBuildOutputReceipt({ version: 2, sourceHash: output.sourceHash, planHash: output.planHash, artifactHash: digest(bytes), bytes: bytes.length,
    fileCount: output.entries.length, totalBytes: output.totalBytes }), root = await directory(stateDir), name = `${receipt.artifactHash}.component.gz`;
  return writeExclusively(root, async () => {
    const entries = await readdir(root);
    if (!entries.includes(name)) {
      let occupied = 0; for (const entry of entries) { const stat = await lstat(join(root, entry)); ensure(stat.isFile() && !stat.isSymbolicLink(), "BUILD_OUTPUT_PATH_DENIED", "فایل نگهداری خروجی معتبر نیست.", 503); occupied += stat.size; }
      ensure(entries.length < 32 && occupied + bytes.length <= 128 * 1024 * 1024, "BUILD_OUTPUT_STORAGE_LIMIT", "نگهداری خروجی به سقف رسید.", 413);
      const temporary = join(root, `${randomUUID()}.pending`), file = await open(temporary, "wx", 0o600);
      try { try { await file.writeFile(bytes); await file.sync(); } finally { await file.close(); } await link(temporary, join(root, name)); } finally { await unlink(temporary); }
    }
    await readComponentOutput(stateDir, receipt, output); return receipt;
  });
}
export async function componentOutputBytes(stateDir: string, receipt: BuildOutputReceipt): Promise<Buffer> {
  await readComponentOutput(stateDir, receipt, receipt); const bytes = await readFile(join(await directory(stateDir), `${receipt.artifactHash}.component.gz`));
  ensure(digest(bytes) === receipt.artifactHash, "BUILD_OUTPUT_MISMATCH", "بستهٔ runtime هنگام آماده‌سازی تغییر کرد.", 409); return bytes;
}

export async function persistBuildOutput(stateDir: string, output: ValidatedBuildOutput,
  binding: Readonly<{ sourceHash: string; planHash: string }>): Promise<BuildOutputReceipt> {
  const sourceHash = hash(binding.sourceHash), planHash = hash(binding.planHash),
    validated = validateBuildOutput({ version: 1, files: output.manifest }, new Map(output.files.map(file => [file.path, file.content])));
  const bytes = Buffer.from(JSON.stringify({ version: 1, sourceHash, planHash, output: { version: 1,
    manifest: { version: 1, files: validated.manifest }, contents: validated.files.map(file => ({ path: file.path, base64: file.content.toString("base64") })) } }));
  const receipt = parseBuildOutputReceipt({ version: 1, sourceHash, planHash, artifactHash: digest(bytes), bytes: bytes.length,
    fileCount: validated.files.length, totalBytes: validated.totalBytes });
  const root = await directory(stateDir), name = `${receipt.artifactHash}.json`;
  return writeExclusively(root, async () => {
  const entries = await readdir(root);
  if (entries.includes(name)) { await readBuildOutput(stateDir, receipt, binding); return receipt; }
  ensure(entries.length < 32, "BUILD_OUTPUT_STORAGE_LIMIT", "ظرفیت نگهداری خروجی‌های ساخت پر است.", 413);
  let occupied = 0;
  for (const entry of entries) {
    const stat = await lstat(join(root, entry));
    ensure(stat.isFile() && !stat.isSymbolicLink(), "BUILD_OUTPUT_PATH_DENIED", "نگهداری خروجی ساخت فایل نامعتبر دارد.", 503);
    occupied += stat.size;
  }
  ensure(occupied + bytes.length <= 128 * 1024 * 1024, "BUILD_OUTPUT_STORAGE_LIMIT", "حجم نگهداری خروجی‌های ساخت به سقف رسیده است.", 413);
  const temporary = join(root, `${randomUUID()}.pending`), file = await open(temporary, "wx", 0o600);
  try {
    try { await file.writeFile(bytes); await file.sync(); } finally { await file.close(); }
    await link(temporary, join(root, name)).catch((error: unknown) => {
      if (!(error instanceof Error && "code" in error && error.code === "EEXIST")) throw error;
    });
  } finally { await unlink(temporary); }
  await readBuildOutput(stateDir, receipt, binding);
  return receipt;
  });
}
