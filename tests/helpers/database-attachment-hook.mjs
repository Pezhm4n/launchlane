// Isolated transport: existing resources only. Every create/SQL/unknown/external operation fails closed.
import { appendFileSync } from "node:fs";
import { randomUUID } from "node:crypto";
const nativeFetch = globalThis.fetch, resources = ["e", "f"].map((letter, index) => ({ _id: letter.repeat(24), hostname: `existing-${index ? "profiles" : "accounts"}`, type: "postgres", planID: "small", bundlePlanID: "basic", status: "RUNNING" }));
let values = [{ key: "KEEP_KEY", value: "keep-existing-fixture-value" }];
const log = value => appendFileSync(process.env.LAUNCHLANE_DATABASE_FIXTURE_LOG, `${JSON.stringify(value)}\n`);
const reply = (name, args) => Response.json({ choices: [{ finish_reason: "tool_calls", message: { role: "assistant", tool_calls: [{ id: randomUUID(), type: "function", function: { name, arguments: JSON.stringify(args) } }] } }], usage: { total_tokens: 20 } });
const project = () => ({ _id: "c".repeat(24), project_id: "sample-node", type: "node", status: "Running", planID: "g2-standard", bundlePlanID: "basic", network: { _id: "d".repeat(24) }, readOnlyRootFilesystem: true, envs: values });
globalThis.fetch = async (input, init) => {
  const url = new URL(typeof input === "string" ? input : input instanceof URL ? input.href : input.url), method = init?.method ?? "GET";
  if (url.origin === "https://api.liara.ir") {
    if (url.searchParams.get("teamID") !== "a".repeat(24)) throw Error("Unexpected fixture team");
    if (url.pathname === "/v1/me" && method === "GET") return Response.json({ user: { _id: "b".repeat(24) }, team: { _id: "a".repeat(24), balance: 0 }, databaseVersions: { postgres: [{ value: "16.4" }] }, plans: {
      databases: { small: { available: true, supports: ["postgres"], price: 100 } }, databaseBundlePlans: { small: { basic: { available: true, price: 10 } } } } });
    if (url.pathname === "/v1/networks" && method === "GET") return Response.json({ networks: [{ _id: "d".repeat(24), name: "fixture" }] });
    if (url.pathname === "/v1/projects/sample-node" && method === "GET") return Response.json({ project: project() });
    if (url.pathname === "/v1/projects/update-envs" && method === "POST") { const body = JSON.parse(String(init.body)); if (body.project !== "sample-node") throw Error("Unexpected env target"); values = body.variables; log({ operation: "update_env", keys: values.map(row => row.key), preservedKeep: values.some(row => row.key === "KEEP_KEY" && row.value === "keep-existing-fixture-value") }); return Response.json({}); }
    if (url.pathname === "/v1/databases" && method === "GET") { log({ operation: "inventory" }); return Response.json({ databases: resources }); }
    const resource = resources.find(row => url.pathname === `/v1/databases/${row._id}`);
    if (resource && method === "GET") { log({ operation: "read_private_binding", databaseId: resource._id }); return Response.json({ database: { id: resource._id, hostname: resource.hostname, type: "postgres", version: "16.4", planID: "small", publicNetwork: false,
      network: { _id: "d".repeat(24) }, metaData: { privateNetwork: true }, username: "postgres", root_password: `synthetic-binding-secret-${resource._id}`, dbName: "postgres", internalPort: 5432 } }); }
    log({ operation: "denied", method, path: url.pathname }); throw Error("Unregistered existing-database fixture operation");
  }
  if (url.origin === "https://ai.boxapi.ir" && url.pathname.endsWith("/chat/completions")) {
    const body = JSON.parse(String(init?.body)); if (!body.messages.some(message => message.content?.includes("Two existing data targets"))) throw Error("Unregistered model fixture goal");
    appendFileSync(process.env.LAUNCHLANE_AGENT_FIXTURE_LOG, `${JSON.stringify({ synthetic: true })}\n`);
    if (!body.messages.some(message => message.role === "tool" && message.content?.includes("liara-database-inventory-v1"))) return reply("read_database_resources", { view: "inventory" });
    const bound = key => values.some(row => row.key === key), index = bound("AUTH_DB_URL") ? 1 : 0, key = index ? "PROFILE_DB_URL" : "AUTH_DB_URL", id = resources[index]._id;
    const selected = body.messages.some(message => message.content?.includes("Host database receipt") && message.content.includes(id));
    if (!bound("PROFILE_DB_URL") && !selected) return reply("propose_database_attachment", { consumerRoot: ".", databaseId: id, bindingKeys: [key] });
    return reply("finish_investigation", { state: bound("PROFILE_DB_URL") ? "partially_completed" : "needs_input", question: null, nextAction: bound("PROFILE_DB_URL") ? "reply" : "configure_env", message: "هویت و اتصال منابع موجود بررسی شد؛ سازگاری، migration، داده و انتشار هنوز تأیید نشده‌اند." });
  }
  if (["127.0.0.1", "localhost"].includes(url.hostname)) return nativeFetch(input, init);
  throw Error("External network denied by isolated existing-database fixture");
};
