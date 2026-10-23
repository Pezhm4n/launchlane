import { randomUUID } from "node:crypto";
import { parseProjectBuildPlan, pythonBuildImage, type PythonBuildPlan } from "../../contracts/project-build.ts";
import { environmentVariables, isApplicationEnvironmentKey, type EnvironmentVariable } from "../../contracts/environment.ts";
import { ensure } from "../errors.ts";
import { docker, containerState, type CommandResult } from "./container.ts";

const program = `import os,sys,json,shutil,subprocess,threading,time,urllib.request,hashlib,unittest,re
plan=json.loads(sys.argv[1]); tests=json.loads(sys.argv[2]); stage='cache'
threading.Timer(110,lambda:os._exit(124)).start()
started=time.monotonic()
def progress(): print('Launchlane Python stage:',stage,round((time.monotonic()-started)*1000),'ms',flush=True)
env={'PATH':'/usr/local/bin:/usr/bin:/bin','HOME':'/work','TMPDIR':'/work','PYTHONDONTWRITEBYTECODE':'1','PYTHONUNBUFFERED':'1','PORT':str(plan['port']),'PYTHONPATH':'/work/site:/work/project'}
for row in json.load(sys.stdin): env[row['key']]=row['value']
shutil.copytree('/source','/work/project');os.chdir('/work/project')
try:
 progress();os.mkdir('/work/wheels')
 for row in json.load(open('/wheels/manifest.json')):
  if not re.fullmatch(r'[A-Za-z0-9_.+-]+[.]whl',row['filename']): raise RuntimeError('invalid wheel path')
  data=open('/wheels/'+row['filename'],'rb').read()
  if len(data)!=row['size'] or hashlib.sha256(data).hexdigest()!=row['sha256']: raise RuntimeError('wheel checksum changed')
  with open('/work/wheels/'+row['filename'],'wb') as copied: copied.write(data)
 shutil.copyfile('/wheels/requirements.txt','/work/wheels/requirements.txt')
 stage='install'
 progress()
 subprocess.run(['/usr/local/bin/python3','-m','pip','install','--disable-pip-version-check','--no-compile','--no-index','--no-deps','--only-binary=:all:','--require-hashes','--find-links=/work/wheels','--target=/work/site','-r','/work/wheels/requirements.txt'],env=env,check=True,timeout=45)
 subprocess.run(['/usr/local/bin/python3','-m','pip','check'],env=env,check=True,timeout=10)
 stage='build'
 progress()
 subprocess.run(['/usr/local/bin/python3','-m','compileall','-q','.'],env=env,check=True,timeout=15)
 stage='test'
 progress()
 if tests:
  os.environ.clear();os.environ.update(env);sys.path[:0]=['/work/site','/work/project']
  suite=unittest.TestSuite(unittest.defaultTestLoader.loadTestsFromName(path[:-3].replace('/','.')) for path in tests)
  result=unittest.TextTestRunner(verbosity=2).run(suite)
  if result.testsRun<1 or not result.wasSuccessful() or result.skipped: raise RuntimeError('unchanged acceptance tests did not pass')
 stage='workload'
 progress()
 child=subprocess.Popen(plan['runtime']['command'],env=env,stdin=subprocess.DEVNULL)
 try:
  deadline=time.monotonic()+20; matched=False
  while time.monotonic()<deadline:
   try:
    with urllib.request.urlopen('http://127.0.0.1:'+str(plan['port'])+plan['workload']['path'],timeout=1) as response:
     data=response.read(65537)
     if len(data)>65536: raise RuntimeError('response too large')
     body=data.decode('utf8');a=plan['workload']['assertion']
     value=json.loads(body) if a['kind']=='json' else None
     matches=(a['contains'] in body) if a['kind']=='text' else isinstance(value,dict) and a['field'] in value and type(value[a['field']]) is type(a['equals']) and value[a['field']]==a['equals']
     if response.status==plan['workload']['status'] and matches: matched=True;break
   except Exception: pass
   time.sleep(.25)
  if not matched: raise RuntimeError('original workload expectation not met')
 finally:
  child.terminate()
  try: child.wait(timeout=3)
  except subprocess.TimeoutExpired: child.kill();child.wait()
 print('Launchlane: locked Python install, unchanged tests and original workload verified',flush=True)
 os._exit(0)
except Exception as error:
 print('Launchlane Python check failed:',stage,str(error),file=sys.stderr,flush=True)
 os._exit({'cache':74,'install':71,'build':72,'test':76,'workload':73}.get(stage,75))
`;

export async function runPythonBuild(workspace: string, wheels: string, value: PythonBuildPlan, testFiles: readonly string[],
  signal: AbortSignal, onCreated?: (id: string) => void, environment: readonly EnvironmentVariable[] = []): Promise<CommandResult & { containerId: string; image: string }> {
  const plan = parseProjectBuildPlan(value), values = environmentVariables(environment);
  ensure(plan.version === 2, "BUILD_RUNTIME_UNSUPPORTED", "برنامه اجرای Python معتبر نیست.", 409);
  ensure(values.every(row => isApplicationEnvironmentKey(row.key)) && values.map(row => row.key).sort().join("\0") === [...(plan.environment?.keys ?? [])].sort().join("\0"),
    "ENV_REFERENCE_CHANGED", "اطلاعات اجرای Python با تصمیم برابر نیست.", 409);
  ensure(!workspace.includes(",") && !wheels.includes(","), "SANDBOX_PATH_DENIED", "مسیر ورودی محیط ایزوله معتبر نیست.", 403);
  let id: string | null = null;
  try {
    const created = await docker(["create", "--interactive", "--log-driver", "none", "--pull=never", "--name", `launchlane-python-${randomUUID()}`, "--label", "ir.launchlane.worker=python-build-v1",
      "--network", "none", "--read-only", "--cap-drop", "ALL", "--security-opt", "no-new-privileges", "--user", "1000:1000",
      "--cpus", "1", "--memory", "768m", "--memory-swap", "768m", "--pids-limit", "64",
      // Native wheels mmap executable shared objects. Containment is supplied by user/caps/network/mount isolation.
      "--tmpfs", "/work:rw,exec,nosuid,nodev,size=536870912,uid=1000,gid=1000,mode=0700",
      "--mount", `type=bind,source=${workspace},target=/source,readonly`, "--mount", `type=bind,source=${wheels},target=/wheels,readonly`,
      pythonBuildImage, "python3", "-c", program, JSON.stringify(plan), JSON.stringify(testFiles)], signal, 4096);
    ensure(created.exitCode === 0 && /^[a-f0-9]{64}$/.test(created.output.trim()), "SANDBOX_UNAVAILABLE", "محیط Python با image تثبیت‌شده ایجاد نشد؛ کد روی میزبان اجرا نشد.", 503);
    id = created.output.trim(); onCreated?.(id);
    const input = Buffer.from(JSON.stringify(values)); let result: CommandResult;
    try { result = await docker(["start", "--attach", "--interactive", id], signal, 32768, input); } finally { input.fill(0); }
    const state = await containerState(id), stopped = result.signal ?? (state.oom ? "OOM" : null);
    return { ...result, signal: stopped, exitCode: signal.aborted || stopped ? null : state.exitCode, containerId: id, image: pythonBuildImage };
  } finally {
    if (id) {
      const removed = await docker(["rm", "--force", id], AbortSignal.timeout(5000), 4096);
      ensure(removed.exitCode === 0, "SANDBOX_CLEANUP_UNCONFIRMED", "پایان محیط همین آزمون Python تأیید نشد.", 503);
    }
  }
}
