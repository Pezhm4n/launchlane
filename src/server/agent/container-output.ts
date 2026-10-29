import { spawn } from "node:child_process";
import { exactKeys, object, string } from "../../contracts/validation.ts";
import { AppError, ensure } from "../errors.ts";
import { dockerEndpointHost, type LocalDockerEndpoint } from "./docker-engine.ts";
import {
  BUILD_OUTPUT_MAX_BYTES, BUILD_OUTPUT_MAX_FILE_BYTES, BUILD_OUTPUT_MAX_FILES,
  validateBuildOutput, type ValidatedBuildOutput,
} from "./build-output.ts";

const maximumWireBytes = Math.ceil(BUILD_OUTPUT_MAX_BYTES / 3) * 4 + 4 * 1024 * 1024;
const maximumEncodedFile = Math.ceil(BUILD_OUTPUT_MAX_FILE_BYTES / 3) * 4;
const exportFailureMessage = "دریافت بایت‌های خروجی ساخت کامل و قابل‌تأیید نشد؛ بسته‌ای از این خروجی ساخته نشد.";
const exportFailureCodes = new Set(["BUILD_OUTPUT_LIMIT", "BUILD_OUTPUT_TYPE_DENIED", "BUILD_OUTPUT_PATH_DENIED", "BUILD_OUTPUT_CHANGED"]);

function privateBytes(values: readonly string[]): Buffer[] {
  ensure(Array.isArray(values) && values.length <= 256 && values.every(value => typeof value === "string" && Buffer.byteLength(value) <= 65536) &&
    values.reduce((total, value) => total + Buffer.byteLength(value), 0) <= 256 * 1024,
    "BUILD_OUTPUT_PRIVATE_SCOPE", "محدودهٔ بررسی اطلاعات خصوصی خروجی ساخت معتبر نیست.", 409);
  return values.filter(Boolean).map(value => Buffer.from(value));
}

/** Decode untrusted container transport, then independently validate actual bytes against its manifest. */
export function decodeBuildOutputExport(wire: Uint8Array, privateValues: readonly string[] = []): ValidatedBuildOutput {
  ensure(wire instanceof Uint8Array && wire.byteLength <= maximumWireBytes,
    "BUILD_OUTPUT_LIMIT", "حجم انتقال خروجی ساخت از سقف مجاز بیشتر است.", 413);
  const secrets = privateBytes(privateValues);
  try {
    const row = object(JSON.parse(new TextDecoder("utf-8", { fatal: true }).decode(wire)));
    exactKeys(row, ["version", "manifest", "contents"]);
    ensure(row.version === 1 && Array.isArray(row.contents) && row.contents.length > 0 && row.contents.length <= BUILD_OUTPUT_MAX_FILES,
      "BUILD_OUTPUT_INVALID", "قرارداد انتقال خروجی ساخت معتبر نیست.", 409);
    const contents = new Map<string, Buffer>(); let totalBytes = 0;
    for (const value of row.contents) {
      const file = object(value); exactKeys(file, ["path", "base64"]);
      const path = string(file.path, 512), encoded = file.base64;
      ensure(typeof encoded === "string" && encoded.length <= maximumEncodedFile && encoded.length % 4 === 0 && !/[^A-Za-z0-9+/=]/.test(encoded),
        "BUILD_OUTPUT_INVALID", "کدگذاری بایت‌های خروجی ساخت معتبر نیست.", 409);
      const bytes = Buffer.from(encoded, "base64");
      ensure(bytes.toString("base64") === encoded, "BUILD_OUTPUT_INVALID", "کدگذاری بایت‌های خروجی ساخت یکتا نیست.", 409);
      ensure(bytes.byteLength <= BUILD_OUTPUT_MAX_FILE_BYTES && totalBytes + bytes.byteLength <= BUILD_OUTPUT_MAX_BYTES,
        "BUILD_OUTPUT_LIMIT", "حجم بایت‌های خروجی ساخت با قرارداد برابر نیست.", 413);
      ensure(!contents.has(path), "BUILD_OUTPUT_INVALID", "فهرست بایت‌های خروجی ساخت مسیر تکراری دارد.", 409);
      contents.set(path, bytes); totalBytes += bytes.byteLength;
    }
    const result = validateBuildOutput(row.manifest, contents);
    ensure(!result.files.some(file => secrets.some(secret => file.content.includes(secret))),
      "BUILD_OUTPUT_SENSITIVE", "خروجی عمومی ساخت شامل مقدار خصوصی همین مأموریت است؛ انتشار متوقف شد.", 409);
    return result;
  } catch (error) {
    if (error instanceof AppError && error.code !== "INVALID_INPUT") throw error;
    throw new AppError("BUILD_OUTPUT_INVALID", "ساختار انتقال خروجی ساخت قابل‌تأیید نیست.", 409);
  } finally { for (const secret of secrets) secret.fill(0); }
}

// Fixed host-owned program; project scripts, environment values and shell text are never interpolated.
const exportProgram = `const fs=require('node:fs'),path=require('node:path'),{createHash}=require('node:crypto');
const maxFiles=${BUILD_OUTPUT_MAX_FILES},maxBytes=${BUILD_OUTPUT_MAX_BYTES},maxFileBytes=${BUILD_OUTPUT_MAX_FILE_BYTES};
function deny(code){const error=new Error();error.exportCode=code;throw error}
function same(left,right){return left.dev===right.dev&&left.ino===right.ino&&left.size===right.size&&left.nlink===right.nlink&&left.mtimeNs===right.mtimeNs&&left.ctimeNs===right.ctimeNs}
const directories=new Map();
function directory(target){const stat=fs.lstatSync(target,{bigint:true});if(!stat.isDirectory()||stat.isSymbolicLink()||fs.realpathSync(target)!==target)deny('BUILD_OUTPUT_PATH_DENIED');const prior=directories.get(target);if(prior&&!same(prior,stat))deny('BUILD_OUTPUT_CHANGED');directories.set(target,stat)}
try{
const relative=process.argv[1];
if(typeof relative!=='string'||relative.length>240||!relative.split('/').every(part=>/^[A-Za-z0-9][A-Za-z0-9._-]{0,159}$/.test(part)&&part!=='.'&&part!=='..')||relative.split('/').length>10)deny('BUILD_OUTPUT_PATH_DENIED');
directory('/work');directory('/work/project');let root='/work/project';
for(const part of relative.split('/')){root=path.join(root,part);directory(root)}
const files=[],contents=[];let total=0,entries=0;
function visit(folder,depth){
if(depth>16)deny('BUILD_OUTPUT_LIMIT');directory(folder);
const handle=fs.opendirSync(folder,{bufferSize:32});
try{for(let entry;(entry=handle.readSync())!==null;){
if(++entries>maxFiles*4)deny('BUILD_OUTPUT_LIMIT');
const file=path.join(folder,entry.name),relative=path.relative(root,file);
if(!relative||relative.length>512||entry.name.length>160||!file.startsWith(root+'/'))deny('BUILD_OUTPUT_PATH_DENIED');
const before=fs.lstatSync(file,{bigint:true});
if(before.isSymbolicLink())deny('BUILD_OUTPUT_TYPE_DENIED');
if(before.isDirectory()){visit(file,depth+1);continue}
if(!before.isFile()||before.nlink!==1n)deny('BUILD_OUTPUT_TYPE_DENIED');
if(files.length>=maxFiles||before.size>BigInt(maxFileBytes)||BigInt(total)+before.size>BigInt(maxBytes))deny('BUILD_OUTPUT_LIMIT');
const descriptor=fs.openSync(file,fs.constants.O_RDONLY|fs.constants.O_NOFOLLOW|fs.constants.O_NONBLOCK);
let bytes;
try{
const opened=fs.fstatSync(descriptor,{bigint:true});
if(!opened.isFile()||opened.nlink!==1n||!same(before,opened))deny('BUILD_OUTPUT_CHANGED');
const buffer=Buffer.alloc(Number(before.size)+1);let length=0;
while(length<buffer.length){const count=fs.readSync(descriptor,buffer,length,buffer.length-length,null);if(count===0)break;length+=count}
if(BigInt(length)!==before.size||!same(before,fs.fstatSync(descriptor,{bigint:true}))||!same(before,fs.lstatSync(file,{bigint:true}))||fs.realpathSync(file)!==file)deny('BUILD_OUTPUT_CHANGED');
bytes=buffer.subarray(0,length);
}finally{fs.closeSync(descriptor)}
files.push({path:relative,type:'file',bytes:bytes.length,sha256:createHash('sha256').update(bytes).digest('hex')});
contents.push({path:relative,base64:bytes.toString('base64')});total+=bytes.length;
}}finally{handle.closeSync()}}
visit(root,0);
for(const [target,before] of directories){const after=fs.lstatSync(target,{bigint:true});if(!after.isDirectory()||after.isSymbolicLink()||!same(before,after)||fs.realpathSync(target)!==target)deny('BUILD_OUTPUT_CHANGED')}
process.stdout.write(JSON.stringify({version:1,manifest:{version:1,files},contents}));
}catch(error){process.stderr.write(['BUILD_OUTPUT_LIMIT','BUILD_OUTPUT_TYPE_DENIED','BUILD_OUTPUT_PATH_DENIED','BUILD_OUTPUT_CHANGED'].includes(error.exportCode)?error.exportCode:'BUILD_OUTPUT_EXPORT_FAILED');process.exitCode=73}`;

function readContainerOutput(id: string, directory: string, signal: AbortSignal, endpoint?: LocalDockerEndpoint): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const child = spawn("docker", [...(endpoint ? ["--host", dockerEndpointHost(endpoint)] : []), "exec", "--env", "NODE_OPTIONS=", "--env", "NODE_PATH=", "--env", "LD_PRELOAD=", "--env", "LD_LIBRARY_PATH=",
      id, "/usr/local/bin/node", "--no-addons", "--disable-proto=throw", "-e", exportProgram, "--", directory],
      { windowsHide: true, stdio: ["ignore", "pipe", "pipe"] });
    const stdout: Buffer[] = [], stderr: Buffer[] = []; let outputBytes = 0, errorBytes = 0, limited = false, timedOut = false;
    const stop = () => { child.kill(); }, timeout = setTimeout(() => { timedOut = true; stop(); }, 30000);
    const cleanup = () => { clearTimeout(timeout); signal.removeEventListener("abort", stop); };
    signal.addEventListener("abort", stop, { once: true });
    if (signal.aborted) stop();
    child.stdout.on("data", (bytes: Buffer) => {
      outputBytes += bytes.byteLength;
      if (outputBytes > maximumWireBytes) { limited = true; stop(); } else stdout.push(bytes);
    });
    child.stderr.on("data", (bytes: Buffer) => {
      errorBytes += bytes.byteLength;
      if (errorBytes > 8192) { limited = true; stop(); } else stderr.push(bytes);
    });
    child.once("error", () => { cleanup(); reject(new AppError("BUILD_OUTPUT_EXPORT_UNAVAILABLE", exportFailureMessage, 503)); });
    child.once("close", (status) => {
      cleanup();
      if (signal.aborted) return reject(new AppError("CANCELLED", "دریافت خروجی ساخت متوقف شد؛ بایت ناقص قابل انتشار نیست.", 409));
      if (limited) return reject(new AppError("BUILD_OUTPUT_LIMIT", exportFailureMessage, 413));
      if (timedOut || status !== 0) {
        const reported = Buffer.concat(stderr).toString("utf8").trim(), code = exportFailureCodes.has(reported) ? reported : "BUILD_OUTPUT_EXPORT_FAILED";
        return reject(new AppError(code, exportFailureMessage, code === "BUILD_OUTPUT_LIMIT" ? 413 : 409));
      }
      resolve(Buffer.concat(stdout, outputBytes));
    });
  });
}

/** Caller owns the live container and its cleanup; this read neither stops it nor mounts host storage. */
export async function exportBuildOutput(containerId: string, outputDirectory: string, signal: AbortSignal,
  optionalPrivateValues: readonly string[] = [], endpoint?: LocalDockerEndpoint): Promise<ValidatedBuildOutput> {
  ensure(typeof containerId === "string" && /^[a-f0-9]{64}$/.test(containerId), "SANDBOX_ID_DENIED", "شناسهٔ کامل محیط ساخت برای دریافت خروجی لازم است.", 403);
  ensure(typeof outputDirectory === "string" && outputDirectory.length <= 240 && outputDirectory.split("/").length <= 10 &&
    outputDirectory.split("/").every(part => /^[A-Za-z0-9][A-Za-z0-9._-]{0,159}$/.test(part) && part !== "." && part !== ".."),
    "BUILD_OUTPUT_PATH_DENIED", "پوشهٔ خروجی باید مسیری نسبی و محدود در همان پروژه باشد.", 403);
  ensure(!signal.aborted, "CANCELLED", "دریافت خروجی ساخت متوقف شد.", 409);
  const secrets = privateBytes(optionalPrivateValues); for (const secret of secrets) secret.fill(0);
  const wire = await readContainerOutput(containerId, outputDirectory, signal, endpoint);
  ensure(!signal.aborted, "CANCELLED", "دریافت خروجی ساخت متوقف شد.", 409);
  return decodeBuildOutputExport(wire, optionalPrivateValues);
}
