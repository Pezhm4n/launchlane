import assert from "node:assert/strict";
import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { test } from "node:test";
import { captureProject } from "../../src/server/workspace/inspect.ts";
import { createSourceArchive } from "../../src/server/workspace/archive.ts";
import { excludedPath, sourceFileAllowed } from "../../src/contracts/source-paths.ts";
import { gunzipSync } from "node:zlib";

test("runtime templates, SQL migrations and public assets survive capture while private agent history is never uploaded", async () => {
  const root = await mkdtemp(join(tmpdir(), "launchlane-runtime-assets-"));
  try {
    const files = { "package.json": JSON.stringify({ scripts: { start: "node server.js" }, engines: { node: "22.x" } }),
      "server.js": "require('node:http').createServer(()=>{}).listen(3000)",
      "server/migrations/0001.sql": "CREATE TABLE public.notes(id bigint PRIMARY KEY);",
      "guides/src/pages/index.astro": "---\nconst title='Guide';\n---\n<h1>{title}</h1>",
      "guides/src/content/intro.mdx": "# Guide\n<Widget />", "public/site.webmanifest": "{}", "public/sitemap.xml": "<urlset/>",
      "CONTINUITY.md": 'PRIVATE_OPERATOR_NOTE password="not-a-runtime-credential"',
      "AGENTS.md": "PRIVATE_OPERATOR_NOTE keep evidence", "MIGRATION_GUIDE_OLD_TO_NEW.md": 'password="PRIVATE_OPERATOR_NOTE"', ".codex/session.json": '{"private":"PRIVATE_OPERATOR_NOTE"}',
      "nested/CLAUDE.md": "PRIVATE_OPERATOR_NOTE", "dist-server/index.js": 'password="PRIVATE_OPERATOR_NOTE"',
      "guides/.astro/generated.json": '{"private":"PRIVATE_OPERATOR_NOTE"}', ".env": "DATABASE_PASSWORD=never-upload-this" };
    for (const [path, bytes] of Object.entries(files)) { await mkdir(dirname(join(root, path)), { recursive: true }); await writeFile(join(root, path), bytes); }
    const captured = await captureProject(root, ".");
    const paths = captured.profile.manifest.map(file => file.path);
    assert.ok(paths.includes("server/migrations/0001.sql")); assert.ok(paths.includes("guides/src/pages/index.astro")); assert.ok(paths.includes("guides/src/content/intro.mdx"));
    for (const path of paths) assert.equal(path.split("/").some(excludedPath), false);
    const archive = await createSourceArchive({ workspaceRoot: root, directory: ".", sourceHash: captured.profile.sourceHash });
    const tar = gunzipSync(archive.bytes);
    assert.equal(tar.includes(Buffer.from("PRIVATE_OPERATOR_NOTE")), false); assert.equal(tar.includes(Buffer.from("never-upload-this")), false);
    assert.equal(tar.includes(Buffer.from("CREATE TABLE public.notes")), true);
    assert.equal(await readFile(join(root, "CONTINUITY.md"), "utf8"), files["CONTINUITY.md"], "Import must not edit the original project");
  } finally { await rm(root, { recursive: true, force: true }); }
});
test("added deployment assets do not permit private credentials, databases or links by extension", () => {
  for (const path of ["page.astro", "intro.mdx", "migration.sql", "sitemap.xml", "site.webmanifest", "image.avif", "font.ttf", "font.otf"]) assert.equal(sourceFileAllowed(path), true);
  for (const path of ["AGENTS.md", "continuity.MD", ".codex", "database.sqlite3", "private.key", ".env.production", "secrets.sql"]) assert.equal(excludedPath(path), true);
});

test("authentication source filenames survive capture while credential data and credential-bearing code remain blocked", async () => {
  const root = await mkdtemp(join(tmpdir(), "launchlane-auth-source-"));
  try {
    const paths = ["ForgotPassword.tsx", "PasswordStrengthIndicator.tsx", "ResetPassword.tsx", "credentials.ts"];
    await writeFile(join(root,"package.json"),JSON.stringify({scripts:{start:"node server.mjs"},engines:{node:"22"}}));
    await writeFile(join(root,"server.mjs"),"// source inspection does not execute this program");
    for (const name of paths) {assert.equal(excludedPath(name),false);await writeFile(join(root,name),"export const label='Public account interface';");}
    await writeFile(join(root,"credentials.json"),JSON.stringify({password:"never-upload-this-data"}));
    const captured = await captureProject(root,".");
    for (const path of paths) assert.ok(captured.files.some(file=>file.path===path),path);
    assert.equal(captured.files.some(file=>file.path==="credentials.json"),false);
    await writeFile(join(root,"credentials.ts"),"export const password='never-upload-this-credential';");
    await assert.rejects(captureProject(root,"."),{code:"SENSITIVE_SOURCE"});
  } finally {await rm(root,{recursive:true,force:true});}
});
