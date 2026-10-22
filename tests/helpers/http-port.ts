import { createServer } from "node:net";

// A free OS port can still be blocked by Fetch; this matters on hosts with a low dynamic-port range.
// https://fetch.spec.whatwg.org/#port-blocking (checked 2026-10-22)
const blocked = new Set([
  0, 1, 7, 9, 11, 13, 15, 17, 19, 20, 21, 22, 23, 25, 37, 42, 43, 53, 69, 77, 79, 87, 95, 101, 102,
  103, 104, 109, 110, 111, 113, 115, 117, 119, 123, 135, 137, 139, 143, 161, 179, 389, 427, 465,
  512, 513, 514, 515, 526, 530, 531, 532, 540, 548, 554, 556, 563, 587, 601, 636, 989, 990, 993,
  995, 1719, 1720, 1723, 2049, 3659, 4045, 4190, 5060, 5061, 6000, 6566, 6665, 6666, 6667, 6668,
  6669, 6679, 6697, 10080,
]);

export function isHttpTestPort(port: number): boolean {
  return Number.isInteger(port) && port > 0 && port <= 65_535 && !blocked.has(port);
}

export async function freeHttpTestPort(): Promise<number> {
  for (let attempt = 0; attempt < 16; attempt++) {
    const server = createServer();
    try {
      await new Promise<void>((resolve, reject) => {
        server.once("error", reject);
        server.listen(0, "127.0.0.1", resolve);
      });
      const address = server.address();
      if (!address || typeof address === "string") throw new Error("No local test port allocated");
      if (isHttpTestPort(address.port)) return address.port;
    } finally {
      if (server.listening)
        await new Promise<void>((resolve, reject) =>
          server.close((error) => (error ? reject(error) : resolve())),
        );
    }
  }
  throw new Error("No Fetch-compatible local test port available within sixteen allocations");
}
