import { createHash } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { join, resolve } from "node:path";
import { goRegistryRead, goToolchainUrl, type GoReader } from "../../src/server/agent/go-source.ts";

/** Exact public fixture bytes only; the real offline Go command still checks original go.sum. */
export const goFixtureReader: GoReader = async (url, signal, limit, take) => {
  if (url === goToolchainUrl && process.env.LAUNCHLANE_TEST_GO_TOOLCHAIN) return readFile(process.env.LAUNCHLANE_TEST_GO_TOOLCHAIN, { signal });
  const root = resolve(".local/runtime-components/go-public-proxy"), key = createHash("sha256").update(url).digest("hex"), path = join(root, `${key}.json`);
  try {
    const row = JSON.parse(await readFile(path, "utf8")), bytes = Buffer.from(row.base64, "base64");
    if (row.url !== url || bytes.length > limit || createHash("sha256").update(bytes).digest("hex") !== row.sha256) throw Error("Public Go test cache changed");
    return bytes;
  } catch (error) { if (!(error instanceof Error && "code" in error && error.code === "ENOENT")) throw error; }
  const bytes = await goRegistryRead(url, signal, limit, take); await mkdir(root, { recursive: true });
  await writeFile(path, JSON.stringify({ url, sha256: createHash("sha256").update(bytes).digest("hex"), base64: bytes.toString("base64") }), { flag: "wx" }); return bytes;
};
