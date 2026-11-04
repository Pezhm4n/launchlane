import { ensure } from "../server/errors.ts";

export const nugetConfigLimit = 16 * 1024;

export function isNugetConfig(path: string): boolean {
  return /(?:^|\/)nuget\.config$/i.test(path);
}

// Retain original config bytes only for this small, public subset of NuGet XML.
// Credentials, config inheritance directives and expansion never become source data.
export function assertPublicNugetConfig(source: string): void {
  function supported(ok: unknown): asserts ok {
    ensure(ok, "NUGET_CONFIG_UNSUPPORTED", "برای این مسیر، NuGet.Config باید فقط packageSources عمومی و صریح داشته باشد. تنظیمات خصوصی به اتصال جدا نیاز دارند.", 409);
  }
  supported(source.length <= nugetConfigLimit);
  const xml = source.trim().replace(/^<\?xml\s+version="1\.0"(?:\s+encoding="utf-8")?\s*\?>\s*/i, "");
  const body = /^<configuration>\s*<packageSources>([\s\S]*?)<\/packageSources>\s*<\/configuration>$/.exec(xml);
  supported(body);
  let rest = (body[1] ?? "").trim().replace(/^<clear\s*\/>\s*/, "");
  const feeds = new Set<string>();
  while (rest) {
    const tag = /^<add((?:\s+[A-Za-z]+\s*=\s*"[^"<>&]*")+)\s*\/>/.exec(rest);
    supported(tag);
    const fields = new Map<string, string>();
    for (const attribute of (tag[1] ?? "").matchAll(/([A-Za-z]+)\s*=\s*"([^"]*)"/g)) {
      const [, key, value] = attribute;
      supported(key && value && ["key", "value", "protocolVersion"].includes(key) && !fields.has(key));
      fields.set(key, value);
    }
    const name = fields.get("key"), url = fields.get("value");
    supported(name && !feeds.has(name) && (!fields.has("protocolVersion") || fields.get("protocolVersion") === "3"));
    supported(name === "nuget.org" && url === "https://api.nuget.org/v3/index.json" ||
      name === "dotnet-public" && url === "https://pkgs.dev.azure.com/dnceng/public/_packaging/dotnet-public/nuget/v3/index.json");
    feeds.add(name);
    rest = rest.slice(tag[0].length).trimStart();
  }
}
