import { ensure } from "../server/errors.ts";
import { exactKeys, integer, object, string } from "./validation.ts";

export type FrameworkPythonRuntime = Readonly<{
  kind: "flask" | "django"; version: "3.12"; module: string; port: number;
  command: readonly string[];
}>;
export function parseFrameworkPythonRuntime(value: unknown): FrameworkPythonRuntime {
  const row = object(value); exactKeys(row, ["kind", "version", "module", "port", "command"]);
  const module = string(row.module, 160), port = integer(row.port, 1024, 65535);
  ensure((row.kind === "flask" || row.kind === "django") && row.version === "3.12" && /^[A-Za-z_]\w*(?:\.[A-Za-z_]\w*)*:[A-Za-z_]\w*(?:\(\))?$/.test(module),
    "FRAMEWORK_PYTHON_UNSUPPORTED", "ورودی WSGI و Python 3.12 باید صریح و به source متصل باشند.", 409);
  const command = ["python3", "-m", "gunicorn", module, "--bind", `0.0.0.0:${port}`];
  ensure(Array.isArray(row.command) && JSON.stringify(row.command) === JSON.stringify(command), "FRAMEWORK_START_CHANGED", "فرمان WSGI با ورودی مصوب برابر نیست.", 409);
  return { kind: row.kind, version: "3.12", module, port, command };
}
