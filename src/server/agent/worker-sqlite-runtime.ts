/** Fixed runtime for the prepare/bind/first/all/run/batch surface used by a reviewed Worker.
 * It does not implement Cloudflare sessions, replication, bookmarks, exec or remote D1 access.
 * This source is shipped only by an approved preparation; project inspection never executes it.
 */
export const workerSqliteDatabaseProgram = String.raw`'use strict';
const {createHash}=require('node:crypto');
function fail(code){throw Error(code)}
function migrationCode(sql){
 let output='',quote='',line=false,block=false;
 for(let i=0;i<sql.length;i++){
  const c=sql[i],n=sql[i+1];
  if(line){if(c==='\n'){line=false;output+='\n'}continue}
  if(block){if(c==='*'&&n==='/'){i++;block=false;output+=' '}continue}
  if(quote){if(c===quote){if(n===quote)i++;else{quote='';output+=' '}}continue}
  if(c==='-'&&n==='-'){i++;line=true;output+=' ';continue}
  if(c==='/'&&n==='*'){i++;block=true;output+=' ';continue}
  if(c==="'"||c==='"'||c==='\x60'||c==='['){quote=c==='['?']':c;output+=' ';continue}
  output+=c;
 }
 if(quote||block)fail('D1_MIGRATION_INVALID');return output;
}
function parameters(sql){
 if(typeof sql!=='string'||!sql.trim()||Buffer.byteLength(sql)>1048576)fail('D1_SQL_INVALID');
 let output='',quote='',line=false,block=false,terminal=false,highest=0;const indexes=[];
 for(let i=0;i<sql.length;i++){
  const c=sql[i],n=sql[i+1];
  if(line){output+=c;if(c==='\n')line=false;continue}
  if(block){output+=c;if(c==='*'&&n==='/'){output+=n;i++;block=false}continue}
  if(quote){output+=c;if(c===quote){if(n===quote){output+=n;i++}else quote=''}continue}
  if(c==='-'&&n==='-'){output+='--';i++;line=true;continue}
  if(c==='/'&&n==='*'){output+='/*';i++;block=true;continue}
  if(terminal&&!/\s/.test(c))fail('D1_SINGLE_STATEMENT_REQUIRED');
  if(c==="'"||c==='"'||c==='\x60'||c==='['){quote=c==='['?']':c;output+=c;continue}
  if(c===';'){terminal=true;output+=c;continue}
  if(c==='?' ){
   let end=i+1;while(end<sql.length&&/[0-9]/.test(sql[end]))end++;
   const index=end===i+1?highest+1:Number(sql.slice(i+1,end));
   if(!Number.isSafeInteger(index)||index<1||index>32766)fail('D1_PARAMETER_INVALID');
   highest=Math.max(highest,index);indexes.push(index-1);output+='?';i=end-1;continue;
  }
  if((c===':'||c==='@'||c==='$')&&/[A-Za-z_]/.test(n||''))fail('D1_NAMED_PARAMETER_UNSUPPORTED');
  output+=c;
 }
 if(quote||block)fail('D1_SQL_INVALID');
 return {sql:output,indexes,count:highest};
}
function value(input){
 if(input===null||typeof input==='string')return input;
 if(typeof input==='number'&&Number.isFinite(input))return input;
 if(typeof input==='boolean')return input?1:0;
 if(input instanceof ArrayBuffer)return new Uint8Array(input.slice(0));
 if(input instanceof Uint8Array)return new Uint8Array(input);
 fail('D1_BIND_TYPE_UNSUPPORTED');
}
class Statement{
 #owner;#query;#values;
 constructor(owner,query,values=[]){this.#owner=owner;this.#query=query;this.#values=values}
 bind(...args){if(args.length!==this.#query.count)fail('D1_BIND_COUNT_MISMATCH');return new Statement(this.#owner,this.#query,args.map(value))}
 execute(owner){
  if(owner!==this.#owner)fail('D1_STATEMENT_OWNER_MISMATCH');
  if(this.#values.length!==this.#query.count)fail('D1_BIND_COUNT_MISMATCH');
  const db=owner.database(),start=performance.now(),before=db.prepare('SELECT total_changes() AS n').get().n;
  const results=db.prepare(this.#query.sql).all(...this.#query.indexes.map(index=>this.#values[index])).map(row=>({...row}));
  const meta=db.prepare('SELECT total_changes() AS n,last_insert_rowid() AS id').get();
  return {success:true,results,meta:{changes:meta.n-before,last_row_id:meta.id,duration:performance.now()-start}};
 }
 async all(){return this.execute(this.#owner)}
 async run(){return this.execute(this.#owner)}
 async first(column){const row=this.execute(this.#owner).results[0];if(!row)return null;if(column===undefined)return row;if(typeof column!=='string'||!Object.hasOwn(row,column))fail('D1_COLUMN_NOT_FOUND');return row[column]}
}
class DatabaseBinding{
 #db;#sequence=0;
 constructor(database){this.#db=database}
 database(){return this.#db}
 prepare(sql){return new Statement(this,parameters(sql))}
 async batch(statements){
  if(!Array.isArray(statements)||statements.length<1||statements.length>1000||statements.some(s=>!(s instanceof Statement)))fail('D1_BATCH_INVALID');
  const name='launchlane_d1_'+(++this.#sequence),db=this.#db;db.exec('SAVEPOINT '+name);
  try{const results=statements.map(statement=>statement.execute(this));db.exec('RELEASE '+name);return results}
  catch(error){db.exec('ROLLBACK TO '+name);db.exec('RELEASE '+name);throw error}
 }
}
function migrate(db,inputs){
 if(!Array.isArray(inputs)||!inputs.length||inputs.length>128)fail('D1_MIGRATION_INVALID');
 const migrations=inputs.map(row=>{
  if(!row||typeof row.name!=='string'||!/^\d{4}_[A-Za-z0-9_-]+\.sql$/.test(row.name)||typeof row.sql!=='string'||Buffer.byteLength(row.sql)>4194304||!row.sql.trim()||typeof row.sha256!=='string'||!/^[a-f0-9]{64}$/.test(row.sha256)||createHash('sha256').update(row.sql).digest('hex')!==row.sha256)fail('D1_MIGRATION_INVALID');
  return {...row};
 }).sort((a,b)=>a.name<b.name?-1:a.name>b.name?1:0);
 if(new Set(migrations.map(row=>row.name)).size!==migrations.length)fail('D1_MIGRATION_INVALID');
 const table='_launchlane_d1_migrations',exists=db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name=?").get(table);
 const prior=exists?db.prepare('SELECT name,sha256 FROM '+table+' ORDER BY name').all():[];
 const tables=db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%' AND name!=?").all(table);
 if(!prior.length&&tables.length)fail('D1_MIGRATION_UNOWNED_DATABASE');
 if(prior.length>migrations.length||prior.some((row,index)=>row.name!==migrations[index].name||row.sha256!==migrations[index].sha256))fail('D1_MIGRATION_CHANGED');
 db.exec('SAVEPOINT launchlane_d1_migrate');
 try{
  db.exec('CREATE TABLE IF NOT EXISTS '+table+' (name TEXT PRIMARY KEY,sha256 TEXT NOT NULL,applied_at INTEGER NOT NULL)');
  for(const row of migrations.slice(prior.length)){
   const code=migrationCode(row.sql);
   if(/\b(?:BEGIN|COMMIT|ROLLBACK|SAVEPOINT|RELEASE|ATTACH|DETACH|VACUUM|PRAGMA|load_extension)\b/i.test(code)||/(?:^|;)\s*END\b/i.test(code))fail('D1_MIGRATION_SCOPE_UNSUPPORTED');
   db.exec(row.sql);db.prepare('INSERT INTO '+table+' VALUES (?,?,?)').run(row.name,row.sha256,Date.now());
  }
  db.exec('RELEASE launchlane_d1_migrate');return {applied:migrations.length-prior.length,total:migrations.length};
 }catch(error){db.exec('ROLLBACK TO launchlane_d1_migrate');db.exec('RELEASE launchlane_d1_migrate');throw error}
}
module.exports={DatabaseBinding,migrate};
`;
