import { createHash } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { join, resolve } from "node:path";
import { composerToolUrl, phpRegistryRead, type PhpReader } from "../../src/server/agent/php-source.ts";

export const phpFixtureReader: PhpReader = async (url, signal, limit, take) => {
  if (url === composerToolUrl && process.env.LAUNCHLANE_TEST_COMPOSER_PHAR) return readFile(process.env.LAUNCHLANE_TEST_COMPOSER_PHAR, { signal });
  const root = resolve(".local/runtime-components/php-public-cache"), key = createHash("sha256").update(url).digest("hex"), path = join(root, `${key}.json`);
  try {
    const row = JSON.parse(await readFile(path, "utf8")), bytes = Buffer.from(row.base64, "base64");
    if (row.url !== url || bytes.length > limit || createHash("sha256").update(bytes).digest("hex") !== row.sha256) throw Error("Public PHP cache changed"); return bytes;
  } catch (error) { if (!(error instanceof Error && "code" in error && error.code === "ENOENT")) throw error; }
  const bytes = await phpRegistryRead(url, signal, limit, take); await mkdir(root, { recursive: true }); await writeFile(path, JSON.stringify({ url, sha256: createHash("sha256").update(bytes).digest("hex"), base64: bytes.toString("base64") }), { flag: "wx" }); return bytes;
};
