import { createServer } from "node:http";

// Controlled sample: /healthz measures liveness; / measures the intended workload.
const port = Number(process.env.PORT || 3000);
const server = createServer((request, response) => {
  response.setHeader("Content-Type", "application/json; charset=utf-8");
  response.setHeader("Cache-Control", "no-store");
  if (request.url === "/healthz") {
    response.end(JSON.stringify({ alive: true }));
    return;
  }
  if (!process.env.WELCOME_MESSAGE) {
    console.info(JSON.stringify({ level: "error", code: "CONFIG_REQUIRED", requiredEnv: "WELCOME_MESSAGE" }));
    response.statusCode = 500;
    response.end(JSON.stringify({ error: "CONFIG_REQUIRED", revision: "sample-v1" }));
    return;
  }
  response.end(JSON.stringify({ status: "healthy", revision: "sample-v1" }));
});
server.listen(port, "0.0.0.0", () => console.info(JSON.stringify({ event: "listening", port })));
process.on("SIGTERM", () => server.close());
