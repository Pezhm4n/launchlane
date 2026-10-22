// Source assets can be larger than configuration; both import and capture use these bounds.
export const SOURCE_MAX_FILE_BYTES = 4 * 1024 * 1024;
export const SOURCE_MAX_CONFIG_BYTES = 512 * 1024;
export const SOURCE_MAX_BYTES = 20 * 1024 * 1024;
export const SOURCE_MAX_FILES = 1000;
export const SOURCE_MAX_ENTRIES = 5000;

export function sourceFileByteLimit(path: string): number {
  return path === "package.json" || path === "liara.json"
    ? SOURCE_MAX_CONFIG_BYTES
    : SOURCE_MAX_FILE_BYTES;
}

export function sourceFileLimitMessage(path: string): string {
  const limit = sourceFileByteLimit(path) / 1024;
  return `فایل «${path}» از سقف ${limit} کیلوبایت بزرگ‌تر است. حجم آن را کم کنید یا پوشه یک برنامه کوچک‌تر را انتخاب کنید.`;
}
