import assert from "node:assert/strict";
import { test } from "node:test";
import { mcpClients, mcpSetupGuide } from "../../src/components/mcp-setup-guide.ts";

const id = "0123456789abcdef0123456789abcdef";
test("the setup guide binds the current installation and gives every host a distinct generated snippet", () => {
  const snippets = new Set<string>();
  for (const client of mcpClients) {
    const guide = mcpSetupGuide("https://launchlane.example", id, client.id, "powershell");
    assert.ok(guide.command.includes("--origin 'https://launchlane.example'"));
    assert.ok(guide.command.includes(`--output '.local/mcp-${id}.json'`));
    assert.ok(guide.command.includes('--from-file "$HOME/Downloads/launchlane-mcp-access.json"'));
    snippets.add(guide.snippet);
  }
  assert.equal(snippets.size, 3);
});
test("guide generation rejects remote plaintext origins and path injection through the access identifier", () => {
  for (const origin of ["http://public.example", "https://user:pass@example.com", "https://example.com/path", "https://example.com?token=x"]) {
    assert.throws(() => mcpSetupGuide(origin, id, "codex", "powershell"));
  }
  for (const invalid of ["../escape", "x';echo bad", "bad\nidentifier", "a".repeat(65)]) {
    assert.throws(() => mcpSetupGuide("https://launchlane.example", invalid, "codex", "posix"));
  }
});
test("public origins containing shell metacharacters stay literal for the chosen terminal", () => {
  const origin = "https://a'b$test.example";
  assert.ok(mcpSetupGuide(origin, id, "codex", "powershell").command.includes("--origin 'https://a''b$test.example'"));
  assert.ok(mcpSetupGuide(origin, id, "codex", "posix").command.includes("--origin 'https://a'\\''b$test.example'"));
  assert.ok(mcpSetupGuide("http://127.0.0.1:3000", id, "codex", "powershell").command.includes("'http://127.0.0.1:3000'"));
});
