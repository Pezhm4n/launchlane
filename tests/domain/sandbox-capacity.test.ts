import assert from "node:assert/strict";
import { test } from "node:test";
import { withSandboxCapacity } from "../../src/server/agent/sandbox-capacity.ts";

const deferred = () => { let done = () => {}; const promise = new Promise<void>(resolve => { done = resolve; }); return { promise, done }; };
test("independent worker requests cannot overlap; FIFO capacity is released after success and failure", async () => {
  const block = deferred(), entered = deferred(), order: number[] = [];
  let running = 0, peak = 0;
  const execute = (id: number) => withSandboxCapacity(AbortSignal.timeout(5000), async () => {
    running++; peak = Math.max(peak, running); order.push(id);
    try { if (id === 1) { entered.done(); await block.promise; } if (id === 2) throw Error("worker failed"); return id; }
    finally { running--; }
  });
  const first = execute(1); await entered.promise;
  const second = execute(2), third = execute(3), failure = assert.rejects(second, /worker failed/);
  assert.deepEqual(order, [1]); block.done();
  assert.equal(await first, 1); await failure; assert.equal(await third, 3);
  assert.deepEqual(order, [1, 2, 3]); assert.equal(peak, 1);
});
test("cancelled, expired and overflowing waiters execute no project code and do not leak capacity", async () => {
  const block = deferred(), entered = deferred(), controller = new AbortController();
  const active = withSandboxCapacity(AbortSignal.timeout(5000), async () => { entered.done(); await block.promise; });
  await entered.promise;
  const cancelled = withSandboxCapacity(controller.signal, async () => assert.fail("Cancelled project must not start"));
  const rejected = assert.rejects(cancelled, { code: "CANCELLED" }); controller.abort(); await rejected;
  await assert.rejects(withSandboxCapacity(AbortSignal.abort(), async () => assert.fail("Expired project must not start")), { code: "CANCELLED" });
  const callers = Array.from({ length: 16 }, () => new AbortController());
  const queued = callers.map(caller => assert.rejects(withSandboxCapacity(caller.signal, async () => assert.fail("Aborted queued work must not start")), { code: "CANCELLED" }));
  await assert.rejects(withSandboxCapacity(AbortSignal.timeout(1000), async () => assert.fail("Overflow must not start")), { code: "SANDBOX_CAPACITY" });
  for (const caller of callers) caller.abort(); await Promise.all(queued);
  block.done(); await active;
  assert.equal(await withSandboxCapacity(AbortSignal.timeout(1000), async () => "available"), "available");
});
