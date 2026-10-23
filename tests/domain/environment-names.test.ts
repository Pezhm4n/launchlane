import assert from "node:assert/strict";
import { test } from "node:test";
import { sourceEnvironmentNames } from "../../src/server/workspace/environment-names.ts";
import { isPublicClientEnvironmentKey, validateEnvironmentVisibility } from "../../src/contracts/environment.ts";

test("JavaScript and TypeScript env references are parsed without treating source text, comments or regex examples as reads", () => {
  const source = `
    const typed: string = import.meta.env.VITE_API_URL;
    const view = <div>{process.env.REACT_APP_THEME}</div>;
    const secret = process.env['SERVER_KEY'];
    const value = import.meta['env']["VITE_MAP_TILE_URL"];
    const optional = process?.env?.OPTIONAL_KEY;
    const expression = \`prefix \${process.env.TEMPLATE_KEY}\`;
    const text = "process.env.DO_NOT_COLLECT";
    const example = /process.env.REGEX_EXAMPLE/;
    // process.env.COMMENT_EXAMPLE
    /* import.meta.env.VITE_COMMENT */
    const builtins = [import.meta.env.MODE, import.meta.env.DEV, import.meta.env.PROD, import.meta.env.SSR, import.meta.env.BASE_URL];
  `;
  assert.deepEqual(sourceEnvironmentNames(source, "src/main.tsx"), ["OPTIONAL_KEY", "REACT_APP_THEME", "SERVER_KEY", "TEMPLATE_KEY", "VITE_API_URL", "VITE_MAP_TILE_URL"]);
  assert.deepEqual(sourceEnvironmentNames('const broken: = import.meta.env.VITE_MAYBE;', "bad.ts"), []);
  assert.deepEqual(sourceEnvironmentNames("process.env.OUTSIDE_CODE", "README.md"), []);
});

test("local bindings and mutations do not manufacture process environment references", () => {
  assert.deepEqual(sourceEnvironmentNames("function example(process){return process.env.NOT_ENV} const actual=process.env.ACTUAL_KEY;", "source.js"), ["ACTUAL_KEY"]);
  for (const source of ["import process from './fake.js'; const x=process.env.FAKE;", "const process={env:{FAKE:1}}; process.env.FAKE;", "process={env:{FAKE:1}}; process.env.FAKE;", "import process = require('./fake'); process.env.FAKE;"])
    assert.deepEqual(sourceEnvironmentNames(source, "source.ts"), []);
  assert.deepEqual(sourceEnvironmentNames("const x=class process { method(){ return process.env.FAKE; } }; process.env.ACTUAL_KEY;", "source.js"), ["ACTUAL_KEY"]);
});

test("builtin process imports preserve environment reads through default, namespace and named aliases", () => {
  for (const source of [
    "import process from 'node:process'; process.env.ACTUAL_KEY;",
    "import runtime from 'process'; runtime.env.ACTUAL_KEY;",
    "import * as runtime from 'node:process'; runtime['env']['ACTUAL_KEY'];",
    "import { default as runtime } from 'node:process'; runtime?.env?.ACTUAL_KEY;",
    "import { env } from 'process'; env.ACTUAL_KEY;",
    "import { env as values } from 'node:process'; values['ACTUAL_KEY'];",
  ]) assert.deepEqual(sourceEnvironmentNames(source, "config.ts"), ["ACTUAL_KEY"]);
  assert.deepEqual(sourceEnvironmentNames("import runtime, { env as values } from 'node:process'; runtime.env.DEFAULT_KEY; values.NAMED_KEY;", "config.ts"), ["DEFAULT_KEY", "NAMED_KEY"]);
});

test("builtin imports do not make shadowed, fake, type-only or replaced bindings into environment reads", () => {
  for (const source of [
    "import runtime from './fake.js'; runtime.env.FAKE;",
    "import { env as values } from './fake.js'; values.FAKE;",
    "import type process from 'node:process'; process.env.FAKE;",
    "import { type env as values } from 'node:process'; values.FAKE;",
    "import runtime from 'node:process'; runtime = fake; runtime.env.FAKE;",
    "import { env as values } from 'node:process'; values = fake; values.FAKE;",
  ]) assert.deepEqual(sourceEnvironmentNames(source, "config.ts"), []);
  assert.deepEqual(sourceEnvironmentNames("import runtime from 'node:process'; function read(runtime){return runtime.env.FAKE;} runtime.env.ACTUAL_KEY;", "config.ts"), ["ACTUAL_KEY"]);
  assert.deepEqual(sourceEnvironmentNames("import { env as values } from 'node:process'; { const values={FAKE:1}; values.FAKE; } values.ACTUAL_KEY;", "config.ts"), ["ACTUAL_KEY"]);
  assert.deepEqual(sourceEnvironmentNames("import { type env as typed, env as values } from 'node:process'; typed.FAKE; values.ACTUAL_KEY;", "config.ts"), ["ACTUAL_KEY"]);
});

test("Vue discovery reads script/setup blocks without scanning template text or commented-out scripts", () => {
  const source = `<template><div>process.env.TEXT_EXAMPLE</div></template>
    <!-- <script>process.env.COMMENTED_SCRIPT;</script> -->
    <script setup lang="ts">const url: string=import.meta.env.VITE_URL;</script>
    <script>export const key=process.env.SERVER_KEY;</script>`;
  assert.deepEqual(sourceEnvironmentNames(source, "App.vue"), ["SERVER_KEY", "VITE_URL"]);
});

test("Python direct reads and a locally proven environment helper expose only literal keys", () => {
  const source = `import os
direct = os.getenv('DIRECT')
bracket = os.environ["BRACKET"]
with_default = os.environ.get('WITH_DEFAULT', 'private-default-not-in-result')
example = "os.getenv('STRING_EXAMPLE')"
"""os.environ['DOCSTRING_EXAMPLE']"""
# os.getenv('COMMENT_EXAMPLE')
class Settings:
    def load(self):
        values = {}
        def get(key, default):
            return os.environ.get(key, values.get(key, default))
        model = get('TOROB_ASSISTANT_MODEL', 'default')
        key = get('BOXAPI_API_KEY', '')
        enabled = get('TOROB_ASSISTANT_ENABLED', '0')
        limit = get('TOROB_ASSISTANT_ATTEMPT_LIMIT', '3')
        return model
outside = get('OUTSIDE_HELPER_SCOPE', '')
`;
  assert.deepEqual(sourceEnvironmentNames(source, "settings.py"), ["BOXAPI_API_KEY", "BRACKET", "DIRECT", "TOROB_ASSISTANT_ATTEMPT_LIMIT", "TOROB_ASSISTANT_ENABLED", "TOROB_ASSISTANT_MODEL", "WITH_DEFAULT"]);
});

test("ambiguous Python helpers, shadowed os and unrelated get calls remain unknown", () => {
  assert.deepEqual(sourceEnvironmentNames("def get(key, default):\n    return settings.get(key, default)\nvalue=get('NOT_ENV','')\n", "settings.py"), []);
  assert.deepEqual(sourceEnvironmentNames("def get(key, default):\n    return os.getenv(key, default)\nget = other\nvalue=get('NOT_ENV','')\n", "settings.py"), []);
  assert.deepEqual(sourceEnvironmentNames("def get(key, default):\n    return os.getenv(key, default)\ndef other(get):\n    return get('NOT_ENV','')\n", "settings.py"), []);
  assert.deepEqual(sourceEnvironmentNames("def get(key, default):\n    return os.getenv(key, default)\ndef get(key, default):\n    return other(key)\nvalue=get('NOT_ENV','')\n", "settings.py"), []);
  assert.deepEqual(sourceEnvironmentNames("def read(os):\n    return os.getenv('NOT_ENV')\n", "settings.py"), []);
  assert.deepEqual(sourceEnvironmentNames('"os".getenv("NOT_ENV")', "settings.py"), []);
  for (const source of ["value=os.getenv('DYNAMIC_' + suffix)", "value=os.environ['TUPLE', 'KEY']", "from fake import os\nvalue=os.getenv('NOT_ENV')", "os.getenv=other\nvalue=os.getenv('NOT_ENV')", "def get(key,default):\n    return os.getenv(key + '_SUFFIX', default)\nvalue=get('NOT_ENV','')"])
    assert.deepEqual(sourceEnvironmentNames(source, "settings.py"), []);
});

test("source and name bounds fail explicitly without returning partial configuration", () => {
  assert.throws(() => sourceEnvironmentNames(" ".repeat(4 * 1024 * 1024 + 1), "source.js"), { code: "ENV_DISCOVERY_LIMIT" });
  assert.throws(() => sourceEnvironmentNames(Array.from({ length: 129 }, (_, index) => `process.env.KEY_${index};`).join("\n"), "source.js"), { code: "ENV_DISCOVERY_LIMIT" });
});

test("all standard browser-exposed prefixes need an explicit public classification", () => {
  for (const name of ["NEXT_PUBLIC_ORIGIN", "VITE_MAP_TILE_URL", "REACT_APP_API_URL"]) {
    assert.equal(isPublicClientEnvironmentKey(name), true);
    assert.throws(() => validateEnvironmentVisibility([name]), { code: "PUBLIC_ENV_SECRET_DENIED" });
  }
  for (const name of ["SERVER_KEY", "BOXAPI_API_KEY", "PRIVATE_VITE_KEY", "next_public_secret"]) assert.equal(isPublicClientEnvironmentKey(name), false);
  validateEnvironmentVisibility(["BOXAPI_API_KEY"]);
});
