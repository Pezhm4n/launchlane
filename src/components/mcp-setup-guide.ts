import { mcpOrigin } from "../contracts/mcp-access-file.ts";

export const mcpClients = [
  { id: "codex", name: "Codex", format: "TOML", destination: "~/.codex/config.toml", docs: "https://learn.chatgpt.com/docs/extend/mcp" },
  { id: "claude", name: "Claude Code", format: "JSON", destination: ".mcp.json", docs: "https://code.claude.com/docs/en/mcp" },
  { id: "opencode", name: "OpenCode", format: "JSON", destination: "opencode.json", docs: "https://opencode.ai/docs/mcp-servers/" },
] as const;
export type McpClient = typeof mcpClients[number]["id"];
export type McpShell = "powershell" | "posix";

/** Public installation metadata only; never accepts or emits a grant token. */
export function mcpSetupGuide(origin: string, id: string, client: McpClient, shell: McpShell) {
  const trusted = mcpOrigin(origin);
  if (!/^[A-Za-z0-9_-]{16,64}$/.test(id)) throw new Error("Invalid access identifier");
  const quote = (value: string) => `'${value.replaceAll("'", shell === "powershell" ? "''" : "'\\''")}'`;
  const output = `.local/mcp-${id}.json`;
  return {
    command: `node scripts/setup-mcp.mjs --from-file "$HOME/Downloads/launchlane-mcp-access.json" --origin ${quote(trusted)} --output ${quote(output)}`,
    snippet: `${output}.${client}.${client === "codex" ? "toml" : "json"}`,
  };
}
export const mcpCheckPrompt = "ابزار launchlane_context را فراخوانی کن و پروژهٔ انتخاب‌شده و محدودهٔ دسترسی را گزارش کن. هیچ مأموریت تازه‌ای شروع نکن.";
