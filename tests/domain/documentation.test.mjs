import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { test } from "node:test";
import { auditDocumentation } from "../../scripts/check-docs.mjs";

function fixture(run) {
  const root = mkdtempSync(join(tmpdir(), "launchlane-docs-test-"));
  try {
    execFileSync("git", ["init", "--quiet", root]);
    mkdirSync(join(root, "docs"));
    writeFileSync(join(root, ".gitignore"), "private/\n");
    mkdirSync(join(root, "private"));
    writeFileSync(join(root, "private", "ignored.md"), "[private](absent.md)\n");
    return run(root, (name, value) => writeFileSync(join(root, name), value));
  } finally {
    assert.ok(resolve(root).startsWith(join(tmpdir(), "launchlane-docs-test-")));
    rmSync(root, { recursive: true, force: true });
  }
}

test("documentation audit checks relative assets, Unicode/duplicate headings and explicit anchors", () => fixture((root, write) => {
  write("README.md", '[entry](docs/guide.md#بخش)\n[second](docs/guide.md#بخش-1)\n<a href="docs/guide.md#record">record</a>\n[guide][ref]\n[ref]: docs/guide.md#record\n![asset](docs/picture.svg)\n```sh\n[not a link](missing.md)\n```\n');
  write("docs/guide.md", '# Guide\n## بخش\n## بخش\n<a id="record"></a>\n[home](../README.md)\n');
  write("docs/picture.svg", '<svg xmlns="http://www.w3.org/2000/svg"/>');
  assert.deepEqual(auditDocumentation(root), { documents: 2, issues: [] });
}));

test("documentation audit rejects broken/escaped/case-mismatched targets and anchors only present in code", () => fixture((root, write) => {
  write("README.md", '[bad](missing.md)\n[escape](../outside.md)\n[case](docs/Guide.md)\n[anchor](docs/guide.md#fake)\n[reference][ref]\n[ref]: absent.md\n');
  write("docs/guide.md", '# Guide\n```html\n<a id="fake"></a>\n```\n');
  const issues = auditDocumentation(root).issues;
  assert.equal(issues.length, 5);
  assert.ok(issues.some(issue => issue.code === "missing-anchor"));
  assert.ok(issues.some(issue => issue.target === "absent.md"));
}));

test("documentation audit finds private values in code without echoing the value", () => fixture((root, write) => {
  const fakeKey = `box-ai-${"x".repeat(25)}`;
  write("README.md", `# Guide\n\n\x60\x60\x60text\nC:\\Users\\Example\\project\n/home/example/project\n${fakeKey}\n\x60\x60\x60\n`);
  const report = auditDocumentation(root);
  assert.equal(report.issues.filter(issue => issue.code === "machine-path").length, 2);
  assert.equal(report.issues.filter(issue => issue.code === "credential-shaped-value").length, 1);
  assert.equal(JSON.stringify(report).includes(fakeKey), false);
  assert.equal(JSON.stringify(report).includes("Example"), false);
}));
