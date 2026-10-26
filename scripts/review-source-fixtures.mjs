import { randomUUID, createHash } from "node:crypto";
import { closeSync, existsSync, fsyncSync, lstatSync, mkdirSync, openSync, renameSync, unlinkSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { readConfig } from "../src/server/config.ts";
import { publicTestFixturePath } from "../src/contracts/source-fixture-review.ts";
import { readSafeFile } from "../src/server/workspace/inspect.ts";
import { readFixtureReviewRegistry, signFixtureReview, sourceReviewFilename } from "../src/server/policy/source-fixture-review.ts";
const args = process.argv.slice(2), files = []; let project;
for (let i = 0; i < args.length; i++) {
  if (args[i] === "--project" && !project) project = args[++i];
  else if (args[i] === "--file") files.push(publicTestFixturePath(args[++i]));
  else if (args[i] !== "--confirmed-public-test-fixtures") throw Error("Unknown review option");
}
if (!project || !files.length || files.length > 64 || !args.includes("--confirmed-public-test-fixtures")) throw Error("An explicit confirmed public-fixture review and exact test files are required");
const config = readConfig(), root = resolve(project), selected = [];
for (const path of files) { const bytes = await readSafeFile(root, resolve(root, path)); selected.push({ path, sha256: createHash("sha256").update(bytes).digest("hex") }); }
selected.sort((a,b)=>a.path.localeCompare(b.path,"en"));
mkdirSync(config.stateDir,{recursive:true,mode:0o700});
if (!lstatSync(config.stateDir).isDirectory() || lstatSync(config.stateDir).isSymbolicLink()) throw Error("Unsafe operator state directory");
const lock = join(config.stateDir,"source-fixture-reviews.lock"), handle = openSync(lock,"wx",0o600), temporary = join(config.stateDir,`.fixture-review-${randomUUID()}.tmp`);
try {
  const prior = readFixtureReviewRegistry(config.stateDir,config.sessionSecret), now = Date.now(), existing = prior.find(review => review.expiresAt > now && JSON.stringify(review.files) === JSON.stringify(selected));
  if (existing) console.log(JSON.stringify({reviewId:existing.id,files:existing.files,expiresAt:existing.expiresAt,reused:true}));
  else {
    if (prior.length >= 32 || prior.reduce((total,review)=>total+review.files.length,0)+selected.length>256) throw Error("Review registry capacity reached");
    const review = signFixtureReview(config.sessionSecret,{version:1,id:randomUUID(),reviewedAt:now,expiresAt:now+7*86400000,files:selected}), bytes = Buffer.from(JSON.stringify({version:1,reviews:[...prior,review]},null,2)+"\n");
    if (bytes.length > 65536) throw Error("Review registry byte limit reached");
    const output = openSync(temporary,"wx",0o600);try{writeFileSync(output,bytes);fsyncSync(output)}finally{closeSync(output)}
    renameSync(temporary,join(config.stateDir,sourceReviewFilename));
    readFixtureReviewRegistry(config.stateDir,config.sessionSecret);
    console.log(JSON.stringify({reviewId:review.id,files:review.files,expiresAt:review.expiresAt,reused:false}));
  }
}finally{closeSync(handle);unlinkSync(lock);if(existsSync(temporary))unlinkSync(temporary)}
