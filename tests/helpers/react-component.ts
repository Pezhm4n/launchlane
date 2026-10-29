import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { transpileModule, ModuleKind, JsxEmit } from "typescript";

/** Trusted repository test components only. Node cannot import TSX/CSS without this test loader. */
export async function componentUrl(path: string): Promise<string> {
  const absolute = resolve(path), source = await readFile(absolute, "utf8");
  if (absolute.endsWith(".module.css")) {
    const classes = Object.fromEntries([...source.matchAll(/\.([A-Za-z][A-Za-z0-9_-]*)/g)].map(match => [match[1], match[1]]));
    return `data:text/javascript;base64,${Buffer.from(`export default ${JSON.stringify(classes)}`).toString("base64")}`;
  }
  let code = transpileModule(source, { compilerOptions: { module: ModuleKind.ESNext, jsx: JsxEmit.ReactJSX } }).outputText;
  for (const match of [...code.matchAll(/from ["']([^"']+)["']/g)]) {
    const specifier = match[1]; assert.ok(specifier);
    const target = specifier.startsWith(".") ? resolve(dirname(absolute), specifier) : null;
    const url = target ? /\.(?:tsx|module\.css)$/.test(target) ? await componentUrl(target) : pathToFileURL(target).href : import.meta.resolve(specifier);
    code = code.replace(match[0], `from ${JSON.stringify(url)}`);
  }
  return `data:text/javascript;base64,${Buffer.from(code).toString("base64")}`;
}
