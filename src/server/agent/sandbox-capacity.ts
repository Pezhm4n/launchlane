import { AppError, ensure } from "../errors.ts";

// One process owns this installation's Docker daemon. A build can reserve 2 GiB;
// serialize workers so concurrent accounts cannot multiply that reservation.
let occupied = false;
type Waiter = { start: () => void; signal: AbortSignal; abort: () => void };
const waiting: Waiter[] = [];

function acquire(signal: AbortSignal): Promise<() => void> {
  ensure(!signal.aborted, "CANCELLED", "اجرای محیط ایزوله لغو شد.", 409);
  ensure(waiting.length < 16, "SANDBOX_CAPACITY", "صف ساخت پر است؛ کمی بعد دوباره تلاش کنید.", 429);
  return new Promise((resolve, reject) => {
    const waiter: Waiter = { signal, start: () => {
      signal.removeEventListener("abort", waiter.abort);
      occupied = true;
      let released = false;
      resolve(() => {
        if (released) return;
        released = true;
        occupied = false;
        const next = waiting.shift();
        if (next) next.start();
      });
    }, abort: () => {
      const index = waiting.indexOf(waiter);
      if (index >= 0) waiting.splice(index, 1);
      signal.removeEventListener("abort", waiter.abort);
      reject(new AppError("CANCELLED", "انتظار برای محیط ایزوله لغو شد؛ پروژه اجرا نشد.", 409));
    } };
    if (!occupied) waiter.start();
    else { waiting.push(waiter); signal.addEventListener("abort", waiter.abort, { once: true }); }
  });
}

export async function withSandboxCapacity<T>(signal: AbortSignal, run: () => Promise<T>): Promise<T> {
  const release = await acquire(signal);
  try {
    ensure(!signal.aborted, "CANCELLED", "اجرای محیط ایزوله لغو شد.", 409);
    return await run();
  } finally { release(); }
}
