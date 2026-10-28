import assert from "node:assert/strict";
import { test } from "node:test";
import { htmlAssetLimit, htmlAssetReferences } from "../../src/contracts/html-assets.ts";
import { AppError } from "../../src/server/errors.ts";

const origin = "https://sample-node.example.com";
const code = (expected: string) => (error: unknown) =>
  error instanceof AppError && error.code === expected;

test("same-origin scripts and stylesheets resolve against the accepted document path", () => {
  const plan = htmlAssetReferences(`
    <!doctype html><html><head>
      <link rel="stylesheet" href="/assets/app.css?v=2">
      <link rel="icon" href="/favicon.ico">
      <link rel="preload" as="style" href="/assets/preload.css">
      <link rel="preload stylesheet" href="./local.css">
      <script type="module" src="/assets/app.js"></script>
      <script src="./chunk.js?x=1&amp;y=2"></script>
      <script>window.inline = "<script src='/not-an-asset.js'>";</script>
      <script type="application/ld+json">{"src":"/also-not.js"}</script>
    </head><body><!-- <script src="/commented.js"></script> --></body></html>
  `, "/app/", origin);
  assert.deepEqual(plan.references, [
    { path: "/assets/app.css?v=2", kind: "style" },
    { path: "/app/local.css", kind: "style" },
    { path: "/assets/app.js", kind: "script" },
    { path: "/app/chunk.js?x=1&y=2", kind: "script" },
  ]);
  assert.equal(plan.inlineScripts, 1);
  assert.equal(plan.external, 0);
  assert.equal(plan.blocked.length, 0);
});

test("cross-origin, mixed-content, pseudo and duplicate references stay bounded and classified", () => {
  const plan = htmlAssetReferences(`
    <script src="https://cdn.example.net/vendor.js"></script>
    <script src="https://cdn.example.net/vendor.js"></script>
    <script src="//other.example.net/x.js"></script>
    <script src="http://sample-node.example.com/insecure.js"></script>
    <script src="data:text/javascript,alert(1)"></script>
    <script src="javascript:alert(1)"></script>
    <script src="/assets/app.js"></script>
    <script src="/assets/app.js"></script>
    <script src="/../metadata.js"></script>
  `, "/", origin);
  assert.deepEqual(plan.references, [{ path: "/assets/app.js", kind: "script" }, { path: "/metadata.js", kind: "script" }]);
  assert.deepEqual(plan.blocked, [{ path: "/insecure.js", kind: "script", reason: "insecure" }]);
  assert.equal(plan.external, 3);
  assert.equal(plan.invalid, 0);
});

test("more references than the limit are omitted, never silently claimed as checked", () => {
  const html = Array.from({ length: htmlAssetLimit + 5 }, (_, index) => `<script src="/chunk-${index}.js"></script>`).join("");
  const plan = htmlAssetReferences(html, "/", origin);
  assert.equal(plan.references.length, htmlAssetLimit);
  assert.equal(plan.omitted, 5);
});


test("a document base changes relative resolution and any cleartext asset is blocked", () => {
  const sameOrigin = htmlAssetReferences(
    '<base href="/static/"><script src="app.js"></script><script src="http://cdn.example.net/x.js"></script>',
    "/app/",
    origin,
  );
  assert.deepEqual(sameOrigin.references, [{ path: "/static/app.js", kind: "script" }]);
  assert.deepEqual(sameOrigin.blocked, [{ path: "/x.js", kind: "script", reason: "insecure" }]);
  assert.equal(sameOrigin.external, 0);
  const external = htmlAssetReferences(
    '<base href="https://cdn.example.net/assets/"><script src="app.js"></script>',
    "/app/",
    origin,
  );
  assert.equal(external.references.length, 0);
  assert.equal(external.external, 1);
});

test("a document path outside the exact origin or with traversal is rejected", () => {
  assert.throws(() => htmlAssetReferences("<html></html>", "//evil.example/path", origin), code("PROBE_TARGET_DENIED"));
  assert.throws(() => htmlAssetReferences("<html></html>", "/../private", origin), code("PROBE_TARGET_DENIED"));
});
