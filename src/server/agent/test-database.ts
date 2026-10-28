import { parseDisposableTestDatabase, type DisposableTestDatabase } from "../../contracts/test-database.ts";
import type { ProjectProfile } from "../../contracts/domain.ts";
import type { SourceFile } from "../workspace/inspect.ts";
import { sourceEnvironmentNames } from "../workspace/environment-names.ts";
import { ensure } from "../errors.ts";
import { exactKeys, object } from "../../contracts/validation.ts";
import type { PostgresFixtureBinding } from "./postgres-fixture.ts";
import { migrationSource } from "./postgres-migration-test.ts";

export function validateTestDatabaseSource(files: readonly SourceFile[], profile: ProjectProfile, value: DisposableTestDatabase): DisposableTestDatabase {
  const plan = parseDisposableTestDatabase(value);
  ensure(profile.fullstack && profile.applicationRequirements?.requirements.some(row => row.kind === "postgresql" && row.consumerRoot === "."),
    "TEST_DATABASE_SOURCE_REQUIRED","source باید مصرف PostgreSQL در همین برنامهٔ کامل را مشخص کند.",409);
  const names = new Set(files.filter(file => /\.[cm]?[jt]sx?$/.test(file.path)).flatMap(file => sourceEnvironmentNames(file.content.toString("utf8"),file.path)));
  ensure(plan.environmentKeys.every(key => names.has(key)),"TEST_DATABASE_SOURCE_REQUIRED","نام ورودی دیتابیس باید در source یا آزمون همان نسخه خوانده شود.",409);
  const pkg = files.find(file => file.path === "package.json");
  ensure(pkg && typeof object(object(JSON.parse(pkg.content.toString("utf8"))).dependencies ?? {}).pg === "string",
    "TEST_DATABASE_DRIVER_REQUIRED","این برش آزمون به driver موجود pg در dependencyهای اصلی پروژه نیاز دارد؛ بسته‌ای خودکار اضافه نمی‌شود.",409);
  const declarations = new Set(files.filter(file => /\.(?:sql|[cm]?[jt]s)$/.test(file.path)).flatMap(file => [...file.content.toString("utf8").matchAll(/\bCREATE\s+TABLE\s+(?:IF\s+NOT\s+EXISTS\s+)?(public\.[a-z_][a-z0-9_]*)\b/gi)].map(match => match[1]?.toLowerCase())));
  ensure(plan.requiredRelations.every(name => declarations.has(name)),"TEST_DATABASE_SOURCE_REQUIRED","جدول آزمون باید در schema همین source تعریف شده باشد.",409);
  if (plan.version === 2) migrationSource(files, plan.migration);
  return plan;
}

export function assertPostgresWorkerBinding(binding: PostgresFixtureBinding, jobId: string | undefined, sourceHash: string | undefined, migration = false): void {
  exactKeys(object(binding),["jobId","sourceHash","containerId","networkMode","host","port","database","user","authentication"]);
  ensure(typeof jobId === "string" && /^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/.test(jobId) && typeof sourceHash === "string" && /^[a-f0-9]{64}$/.test(sourceHash) &&
    binding.jobId === jobId && binding.sourceHash === sourceHash && /^[a-f0-9]{64}$/.test(binding.containerId) && binding.networkMode === `container:${binding.containerId}` &&
    binding.host === "127.0.0.1" && binding.port === 5432 && binding.database === "launchlane_fixture" && binding.user === (migration ? "launchlane_migration_app" : "launchlane_fixture") && binding.authentication === "isolated_trust",
    "TEST_DATABASE_BINDING_CHANGED","namespace دیتابیس آزمون باید متعلق به همین job و source باشد.",409);
}

// Fixed worker code: input is JSON data; neither project SQL nor credentials enter this program.
export const disposableDatabaseProgram = String.raw`function disposableDatabaseValues(plan,payload){
const db=payload.testDatabase;if(!db||db.host!=='127.0.0.1'||db.port!==5432||db.database!=='launchlane_fixture'||db.user!==(plan.testDatabase.version===2?'launchlane_migration_app':'launchlane_fixture')||db.authentication!=='isolated_trust'||!Array.isArray(payload.environment)||payload.environment.length)throw Error('invalid isolated database input');
const url='postgresql://'+db.user+'@127.0.0.1:5432/launchlane_fixture',values=Object.fromEntries(plan.testDatabase.environmentKeys.map(key=>[key,url]));
if(plan.testDatabase.version===2)return values;
return {...values,JWT_SECRET:require('node:crypto').randomBytes(32).toString('hex'),DB_MIGRATIONS_ENABLED:'true',AI_HISTORY_ENABLED:'true',SCRAPER_SYNC_ENABLED:'false',ALLOW_INSECURE_TLS:'true'};
}
async function waitForDisposableRelations(plan,values){
const {Client}=require('/work/project/node_modules/pg'),deadline=Date.now()+30000;let healthy=false;
while(Date.now()<deadline&&!healthy){const client=new Client({connectionString:values[plan.testDatabase.environmentKeys[0]],ssl:false,connectionTimeoutMillis:1000,query_timeout:2000,statement_timeout:1500,application_name:'launchlane-disposable-test'});
try{await client.connect();const result=await client.query('SELECT name, pg_catalog.to_regclass(name) IS NOT NULL AS ready FROM unnest($1::text[]) AS requested(name)',[plan.testDatabase.requiredRelations]);
healthy=Array.isArray(result.rows)&&result.rows.length===plan.testDatabase.requiredRelations.length&&result.rows.every(row=>row.ready===true&&plan.testDatabase.requiredRelations.includes(row.name))&&new Set(result.rows.map(row=>row.name)).size===result.rows.length;
}catch{}finally{await client.end().catch(()=>{})}if(!healthy)await new Promise(resolve=>setTimeout(resolve,250));}
if(!healthy)throw Error('disposable database schema did not become ready');
}`;
