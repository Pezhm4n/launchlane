import { ensure } from "../server/errors.ts";
import { exactKeys, object, string } from "./validation.ts";

export type FrontendRuntime = Readonly<{
  kind: "react" | "vue" | "angular";
  builder: "vite" | "react-scripts" | "vue-cli" | "angular-cli";
  nodeVersion: "20";
  outputDirectory: string;
  mirror: boolean;
}>;
export function parseFrontendRuntime(value: unknown): FrontendRuntime {
  const row = object(value); exactKeys(row, ["kind", "builder", "nodeVersion", "outputDirectory", "mirror"]);
  const outputDirectory = string(row.outputDirectory, 160);
  ensure((row.kind === "react" && (row.builder === "vite" || row.builder === "react-scripts") && outputDirectory === "build" ||
    row.kind === "vue" && (row.builder === "vite" || row.builder === "vue-cli") && outputDirectory === "dist" ||
    row.kind === "angular" && row.builder === "angular-cli" && outputDirectory.startsWith("dist/")) &&
    outputDirectory.split("/").every(part => /^[A-Za-z0-9_][A-Za-z0-9_.-]*$/.test(part)) &&
    row.nodeVersion === "20" && typeof row.mirror === "boolean", "FRONTEND_RUNTIME_UNSUPPORTED", "روش ساخت یا پوشه خروجی این رابط با مسیر بومی لیارا سازگار نیست.", 409);
  return { kind: row.kind, builder: row.builder, nodeVersion: "20", outputDirectory, mirror: row.mirror };
}
