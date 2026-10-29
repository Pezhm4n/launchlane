import { createHash } from "node:crypto";
import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { gzipSync } from "node:zlib";
import { pack } from "tar-stream";
import type { SourceFile } from "../../src/server/workspace/inspect.ts";

export async function pnpmFixtureFiles(runtime = false): Promise<{ files: SourceFile[]; dependency: Buffer }> {
  const archive = pack(), chunks: Buffer[] = [];
  const collected = (async () => { for await (const part of archive) { if (!Buffer.isBuffer(part)) throw Error("invalid fixture archive"); chunks.push(part); } return gzipSync(Buffer.concat(chunks)); })();
  for (const [name, content] of Object.entries({ "package/package.json": JSON.stringify({ name: "launchlane-fixture-value", version: "1.0.0", main: "index.js" }), "package/index.js": "module.exports=73;\n" })) archive.entry({ name, size: Buffer.byteLength(content), mtime: new Date(0) }, content);
  archive.finalize(); const dependency = await collected, integrity = `sha512-${createHash("sha512").update(dependency).digest("base64")}`;
  const rows: Record<string, string> = {
    "package.json": JSON.stringify({ name: "workspace-fixture", private: true, packageManager: "pnpm@11.19.0", engines: { node: "24.x" },
      scripts: { build: "pnpm -r build", ...(runtime ? { test: "pnpm -r test", start: "pnpm --filter @fixture/api start" } : {}) }, devDependencies: { "launchlane-fixture-value": "1.0.0" } }),
    "pnpm-workspace.yaml": "packages:\n  - packages/*\n  - apps/*\n",
    "pnpm-lock.yaml": `lockfileVersion: '9.0'\nsettings:\n  autoInstallPeers: true\n  excludeLinksFromLockfile: false\nimporters:\n  .:\n    devDependencies:\n      launchlane-fixture-value:\n        specifier: 1.0.0\n        version: 1.0.0\n  apps/api:\n    dependencies:\n      '@fixture/shared':\n        specifier: workspace:*\n        version: link:../../packages/shared\n  packages/shared: {}\npackages:\n  launchlane-fixture-value@1.0.0:\n    resolution: {integrity: ${integrity}}\nsnapshots:\n  launchlane-fixture-value@1.0.0: {}\n`,
    "packages/shared/package.json": JSON.stringify({ name: "@fixture/shared", version: "1.0.0", main: "dist/value.cjs", scripts: { build: "node build.cjs", test: "node --test value.test.cjs" } }),
    "packages/shared/build.cjs": "const fs=require('node:fs');fs.mkdirSync('dist',{recursive:true});fs.writeFileSync('dist/value.cjs','module.exports='+require('launchlane-fixture-value')+';');\n",
    "packages/shared/value.test.cjs": "const{test}=require('node:test'),assert=require('node:assert/strict');test('built shared value is preserved',()=>assert.equal(require('./dist/value.cjs'),73));\n",
    "apps/api/package.json": JSON.stringify({ name: "@fixture/api", version: "1.0.0", dependencies: { "@fixture/shared": "workspace:*" }, scripts: { build: "node build.cjs", test: "node --test api.test.cjs", start: "node server.cjs" } }),
    "apps/api/build.cjs": "const fs=require('node:fs');fs.mkdirSync('dist',{recursive:true});fs.writeFileSync('dist/value.cjs','module.exports='+require('@fixture/shared')+';');\n",
    "apps/api/api.test.cjs": "const{test}=require('node:test'),assert=require('node:assert/strict');test('API uses the compiled workspace package',()=>assert.equal(require('./dist/value.cjs'),73));\n",
    "apps/api/server.cjs": "require('node:http').createServer((req,res)=>{res.setHeader('content-type','application/json');res.end(JSON.stringify({total:require('./dist/value.cjs')}))}).listen(Number(process.env.PORT||3000),'0.0.0.0');\n",
  };
  return { dependency, files: Object.entries(rows).map(([path, content]) => ({ path, content: Buffer.from(content) })) };
}
export function writePnpmFixture(root: string, files: readonly SourceFile[]) {
  for (const file of files) { const target = join(root, file.path); mkdirSync(join(target, ".."), { recursive: true }); writeFileSync(target, file.content); }
}
