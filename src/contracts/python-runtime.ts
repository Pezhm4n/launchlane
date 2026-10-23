import { ensure } from "../server/errors.ts";
import { exactKeys, object, string } from "./validation.ts";

export type PythonRuntime = Readonly<{
  kind: "python";
  version: "3.12";
  command: readonly string[];
}>;

export function parsePythonRuntime(value: unknown): PythonRuntime {
  const row = object(value);
  exactKeys(row, ["kind", "version", "command"]);
  ensure(row.kind === "python" && row.version === "3.12", "PYTHON_VERSION_UNSUPPORTED", "محیط آزموده‌شده پایتون در این نصب نسخه ۳٫۱۲ است.", 409);
  ensure(Array.isArray(row.command) && row.command.length >= 2 && row.command.length <= 12,
    "PYTHON_START_REQUIRED", "فرمان اجرای مشخص پایتون لازم است.", 409);
  const command = row.command.map(part => string(part, 160));
  // Release args are parsed by the platform. Accept argv with no shell syntax, never an arbitrary command.
  ensure(command[0] === "python3" && command.every(part => /^[A-Za-z0-9_./:=@+-]+$/.test(part)) &&
    (command.length === 2 && /^[A-Za-z_][A-Za-z0-9_/-]*\.py$/.test(command[1] ?? "") && !command[1]?.split("/").includes("..") ||
      command[1] === "-m" && command[2] === "uvicorn" && /^[A-Za-z_][A-Za-z0-9_.]*:[A-Za-z_][A-Za-z0-9_]*$/.test(command[3] ?? "") &&
      command.length === 8 && command[4] === "--host" && command[5] === "0.0.0.0" && command[6] === "--port" && /^\d{1,5}$/.test(command[7] ?? "") && Number(command[7]) >= 1 && Number(command[7]) <= 65535),
    "PYTHON_START_UNSUPPORTED", "فرمان مستقیم فایل پایتون یا uvicorn با host و port مشخص لازم است.", 409);
  return { kind: "python", version: "3.12", command };
}

export function pythonStart(runtime: PythonRuntime): string { return runtime.command.join(" "); }
