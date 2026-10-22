import { ensure } from "../server/errors.ts";
import { exactKeys, integer, object, string, text } from "./validation.ts";

export type IncidentHandoff = {
  version: 1;
  runId: string;
  mode: "live" | "sample";
  generatedAt: number;
  filename: string;
  markdown: string;
};

export function parseIncidentHandoff(value: unknown): IncidentHandoff {
  const row = object(value);
  exactKeys(row, ["version", "runId", "mode", "generatedAt", "filename", "markdown"]);
  ensure(
    row.version === 1 && (row.mode === "live" || row.mode === "sample"),
    "HANDOFF_INVALID",
    "گزارش دریافتی معتبر نیست.",
  );
  const runId = string(row.runId, 36),
    filename = string(row.filename, 100);
  ensure(
    /^[a-f0-9-]{36}$/.test(runId) && filename === `launchlane-incident-${runId}.md`,
    "HANDOFF_INVALID",
    "شناسه گزارش دریافتی معتبر نیست.",
  );
  const markdown = text(row.markdown, 131_072);
  ensure(
    new TextEncoder().encode(markdown).byteLength <= 131_072,
    "HANDOFF_LIMIT",
    "حجم گزارش از سقف دریافت بیشتر است.",
    413,
  );
  return {
    version: 1,
    runId,
    mode: row.mode,
    generatedAt: integer(row.generatedAt, 0, 8_640_000_000_000_000),
    filename,
    markdown,
  };
}
