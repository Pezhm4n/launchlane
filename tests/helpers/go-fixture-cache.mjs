import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";

// Test-only public bytes. The actual downloader and offline Go still validate their identities.
export function publicGoFixture(url) {
  if (url.href === "https://dl.google.com/go/go1.25.14.linux-amd64.tar.gz" && process.env.LAUNCHLANE_GO_FIXTURE_ARCHIVE)
    return readFileSync(process.env.LAUNCHLANE_GO_FIXTURE_ARCHIVE);
  if (url.origin !== "https://proxy.golang.org") return null;
  try {
    const key = createHash("sha256").update(url.href).digest("hex"), row = JSON.parse(readFileSync(`.local/runtime-components/go-public-proxy/${key}.json`, "utf8")), bytes = Buffer.from(row.base64, "base64");
    if (row.url !== url.href || createHash("sha256").update(bytes).digest("hex") !== row.sha256) throw Error("Public Go fixture cache changed"); return bytes;
  } catch (error) { if (error.code === "ENOENT") return null; throw error; }
}
