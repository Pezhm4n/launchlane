import type { ProjectProfile } from "./domain.ts";
import { exactKeys, hash, hasControl, integer, object, string } from "./validation.ts";
import { ensure } from "../server/errors.ts";

export type DockerRuntime = Readonly<{
  kind: "docker";
  contextRoot: ".";
  dockerfile: string;
  dockerfileHash: string;
  port: number;
}>;

export function parseDockerRuntime(value: unknown): DockerRuntime {
  const row = object(value);
  exactKeys(row, ["kind", "contextRoot", "dockerfile", "dockerfileHash", "port"]);
  const dockerfile = string(row.dockerfile, 240);
  ensure(row.kind === "docker" && row.contextRoot === "." && !hasControl(dockerfile) && !/[\\:]/.test(dockerfile) &&
    dockerfile.split("/").every(part => part !== "" && part !== "." && part !== ".."),
    "DOCKER_RUNTIME_INVALID", "Dockerfile باید مسیر نسبی در ریشهٔ همین source داشته باشد؛ context بیرونی مجاز نیست.", 409);
  return { kind: "docker", contextRoot: ".", dockerfile, dockerfileHash: hash(row.dockerfileHash), port: integer(row.port, 1, 65535) };
}

/** Bind declarative runtime inputs to the selected immutable source; this is not build evidence. */
export function assertDockerRuntimeSource(profile: ProjectProfile, value: DockerRuntime): void {
  const runtime = parseDockerRuntime(value);
  ensure(profile.runtime === "docker" && profile.dockerRuntime, "DOCKER_RUNTIME_CHANGED", "مسیر Docker پروژه تغییر کرده است؛ برنامهٔ تازه لازم است.", 409);
  const selected = parseDockerRuntime(profile.dockerRuntime);
  ensure(selected.dockerfile === runtime.dockerfile && selected.dockerfileHash === runtime.dockerfileHash && selected.port === runtime.port &&
    profile.port === runtime.port && profile.manifest.some(file => file.path === runtime.dockerfile && file.sha256 === runtime.dockerfileHash && file.bytes > 0),
    "DOCKER_RUNTIME_CHANGED", "Dockerfile، بایت‌های source یا پورت با نسخهٔ مصوب برابر نیستند.", 409);
}
