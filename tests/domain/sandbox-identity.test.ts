import assert from "node:assert/strict";
import { test } from "node:test";
import { node22Image, resolveCreatedContainer, type CommandResult } from "../../src/server/agent/container.ts";

const id = "a".repeat(64), expected = { name: "launchlane-build-11111111-1111-4111-8111-111111111111", label: "locked-build-v1", image: node22Image };
const lost: CommandResult = { output: "", exitCode: null, signal: "SIGTERM" };
const identity = { id, name: `/${expected.name}`, image: expected.image, labels: { "ir.launchlane.worker": expected.label } };
test("a complete create receipt needs no readback; an incomplete or lost reply resolves only the unique owned container", async () => {
  assert.equal(await resolveCreatedContainer({ output: `${id}\n`, exitCode: 0, signal: null }, expected, async () => { assert.fail("No unnecessary read"); }), id);
  for (const result of [lost, { output: "broken", exitCode: 0, signal: null }, { output: "", exitCode: 1, signal: null }]) {
    let reads = 0;
    assert.equal(await resolveCreatedContainer(result, expected, async args => {
      reads++; assert.equal(args[0], "inspect"); assert.equal(args.at(-1), expected.name);
      return { output: JSON.stringify(identity), exitCode: 0, signal: null };
    }), id);
    assert.equal(reads, 1);
  }
});
test("an absent worker is confirmed narrowly, while failed inspection and replacement identities fail closed", async () => {
  for (const prefix of ["Error:", "Error response from daemon:"]) for (const kind of ["container", "object"])
    assert.equal(await resolveCreatedContainer(lost, expected, async () => ({ output: `${prefix} No such ${kind}: ${expected.name}\n`, exitCode: 1, signal: null })), null);
  for (const output of ["", "daemon unavailable", "permission denied", `Error: No such container: another-worker`])
    await assert.rejects(resolveCreatedContainer(lost, expected, async () => ({ output, exitCode: 1, signal: null })), { code: "SANDBOX_CLEANUP_UNCONFIRMED" });
  for (const changed of [null, { ...identity, id: "short-id" }, { ...identity, name: "/other-worker" }, { ...identity, image: "other-image" }, { ...identity, labels: {} }, { ...identity, extra: true }])
    await assert.rejects(resolveCreatedContainer(lost, expected, async () => ({ output: JSON.stringify(changed), exitCode: 0, signal: null })), { code: "SANDBOX_CLEANUP_UNCONFIRMED" });
});
