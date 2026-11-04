import { readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { runnerBuildInput } from "./runner-fixture.ts";
import { object } from "../../src/contracts/validation.ts";

/** Derived fixture; original SQL and application oracle remain byte-for-byte unchanged. */
export async function addModuleRunner(project: string) {
  const original = await readFile(join(project, "migrate.cjs"), "utf8");
  const functionBody = original.slice(original.indexOf('    await client.query("BEGIN")'), original.indexOf('  finally { await client.end(); }'));
  await writeFile(join(project, "migrate.mjs"), `import {readFileSync} from 'node:fs';import {createHash} from 'node:crypto';
const sql=readFileSync('001_entries.sql','utf8'),checksum=createHash('sha256').update(sql).digest('hex');
const labels={'auth':'identity datum','profile':'profile datum'};
export async function migrate({pool,target}){const label=labels[target];if(!label)throw Error('unknown target');const client=await pool.connect();try{
${functionBody}
finally{client.release()}}
`);
  const path = join(project, "package.json"), pkg = object(JSON.parse(await readFile(path, "utf8"))), scripts = object(pkg.scripts);
  delete scripts["db:migrate"]; delete scripts["predb:migrate"]; await writeFile(path, JSON.stringify(pkg));
  return moduleRunnerBuildInput();
}
export async function moduleRunnerBuildInput() {
  const base = await runnerBuildInput(), { runnerScript: _runnerScript, ...database } = base.compatibilityDatabase;
  return { ...base, compatibilityDatabase: { ...database, runnerModule: { path: "migrate.mjs", exportName: "migrate", poolProperty: "pool",
    targets: ["auth", "profile"].map(id => ({ id, arguments: { target: id } })) } } };
}
