import { spawn } from "node:child_process";
import { randomUUID } from "node:crypto";
import { AppError, ensure } from "../errors.ts";

export const node22Image = "node:22.23.3-bookworm-slim@sha256:3ed98443660ff48413b5af19ecefce3b9d50845a901a43420d47cc63a9fddbe9";
export type CommandResult = { output: string; exitCode: number | null; signal: string | null };
function docker(args: string[], signal: AbortSignal, maxBytes = 32768): Promise<CommandResult> {
  ensure(!signal.aborted, "CANCELLED", "اجرای ایزوله متوقف شد.", 409);
  return new Promise((resolve, reject) => {
    const child = spawn("docker", args, { windowsHide: true, stdio: ["ignore", "pipe", "pipe"] });
    let output = "", limited = false;
    const stop = () => child.kill();
    signal.addEventListener("abort", stop, { once: true });
    for (const pipe of [child.stdout, child.stderr]) pipe.on("data", (bytes: Buffer) => {
      output += bytes.toString("utf8");
      if (Buffer.byteLength(output) > maxBytes) { limited = true; child.kill(); }
    });
    child.once("error", () => {
      signal.removeEventListener("abort", stop);
      reject(new AppError("SANDBOX_UNAVAILABLE", "Docker این نصب برای اجرای ایزوله در دسترس نیست؛ هیچ script روی میزبان اجرا نشد.", 503));
    });
    child.once("close", (exitCode, killed) => {
      signal.removeEventListener("abort", stop);
      resolve({ output: output.slice(0, maxBytes), exitCode: limited || signal.aborted ? null : exitCode, signal: limited ? "OUTPUT_LIMIT" : killed });
    });
  });
}

// Source and dependencies never receive the Docker socket or host credentials. The only mount is read-only.
const testProgram = `const fs=require('node:fs'),{spawn}=require('node:child_process');
const watchdog=setTimeout(()=>process.exit(124),20000);
fs.cpSync('/source','/work/project',{recursive:true,dereference:false});
const child=spawn('/usr/local/bin/node',['--test-reporter=tap','--test','--',...process.argv.slice(1)],{
cwd:'/work/project',stdio:['ignore','pipe','pipe'],env:{PATH:'/usr/local/bin:/usr/bin:/bin',HOME:'/work',TMPDIR:'/work',NODE_ENV:'test'}});
child.stdout.pipe(process.stdout);child.stderr.pipe(process.stderr);
child.once('error',()=>process.exit(125));child.once('exit',code=>{clearTimeout(watchdog);process.exit(code??125)});`;

export async function runContainerTests(workspace: string, testFiles: readonly string[], signal: AbortSignal,
  onCreated?: (id: string) => void): Promise<CommandResult & { containerId: string; image: string }> {
  ensure(!workspace.includes(","), "SANDBOX_PATH_DENIED", "مسیر workspace برای mount ایزوله معتبر نیست.", 403);
  let id: string | null = null;
  try {
    const created = await docker(["create", "--pull=never", "--name", `launchlane-repair-${randomUUID()}`, "--label", "ir.launchlane.worker=scoped-test-v1",
      "--network", "none", "--read-only", "--cap-drop", "ALL", "--security-opt", "no-new-privileges", "--user", "1000:1000",
      "--cpus", "1", "--memory", "256m", "--memory-swap", "256m", "--pids-limit", "64",
      "--tmpfs", "/work:rw,nosuid,nodev,size=67108864,uid=1000,gid=1000,mode=0700",
      "--mount", `type=bind,source=${workspace},target=/source,readonly`, node22Image,
      "node", "-e", testProgram, "--", ...testFiles], signal, 4096);
    ensure(created.exitCode === 0 && /^[a-f0-9]{64}$/.test(created.output.trim()),
      "SANDBOX_UNAVAILABLE", "محیط ایزوله با image تأییدشده ایجاد نشد؛ script روی میزبان اجرا نشده است.", 503);
    id = created.output.trim();
    onCreated?.(id);
    const result = await docker(["start", "--attach", id], signal);
    const inspected = await docker(["inspect", "--format", "{{.State.ExitCode}}", id], AbortSignal.timeout(5000), 128);
    ensure(inspected.exitCode === 0 && /^\d+$/.test(inspected.output.trim()), "SANDBOX_UNCERTAIN", "رسید پایان اجرای ایزوله قابل بررسی نیست.", 409);
    return { ...result, exitCode: signal.aborted || result.signal ? null : Number(inspected.output.trim()), containerId: id, image: node22Image };
  } finally {
    // Only a full identity returned by this create is removable; never enumerate or stop other containers.
    if (id) {
      const removed = await docker(["rm", "--force", id], AbortSignal.timeout(5000), 4096);
      ensure(removed.exitCode === 0, "SANDBOX_CLEANUP_UNCONFIRMED", "پایان محیط همین آزمون تأیید نشد؛ رسید آن برای بررسی باقی می‌ماند.", 503);
    }
  }
}
