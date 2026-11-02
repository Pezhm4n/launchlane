import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";

// Public tool/dist bytes only. Production still validates tool hashes and original Composer lock.
export function publicPhpFixture(url) {
  if (url.href === "https://getcomposer.org/download/2.11.1/composer.phar" && process.env.LAUNCHLANE_PHP_FIXTURE_PHAR) return readFileSync(process.env.LAUNCHLANE_PHP_FIXTURE_PHAR);
  if (!["security.debian.org", "codeload.github.com"].includes(url.hostname)) return null;
  try { const key = createHash("sha256").update(url.href).digest("hex"), row = JSON.parse(readFileSync(`.local/runtime-components/php-public-cache/${key}.json`, "utf8")), bytes = Buffer.from(row.base64, "base64"); if (row.url !== url.href || createHash("sha256").update(bytes).digest("hex") !== row.sha256) throw Error("Public PHP fixture cache changed"); return bytes; }
  catch (error) { if (error.code === "ENOENT") return null; throw error; }
}
