const native = globalThis.fetch;
globalThis.fetch = async (input, init = {}) => {
  const url = new URL(typeof input === "string" || input instanceof URL ? input : input.url);
  if (["127.0.0.1", "localhost"].includes(url.hostname)) return native(input, init);
  if (url.origin === "https://ai.boxapi.ir" && init.method === "POST") {
    const body = JSON.parse(String(init.body));
    if (body.tools.some(tool => tool.function.name === "propose_project_build")) throw Error("Plain static must not ask for a Node build");
    return Response.json({ choices: [{ finish_reason: "tool_calls", message: { role: "assistant", tool_calls: [{ id: "static-publication-call", type: "function", function: {
      name: "propose_publication", arguments: JSON.stringify({ path: "/", status: 200, assertion: { kind: "text", contains: "Login & Registration" } }) } }] } }], usage: { total_tokens: 10 } });
  }
  if (url.origin === "https://api.liara.ir" && init.method === "GET" && url.pathname === "/v1/projects/sample-node") return Response.json({ project: {
    _id: "c".repeat(24), project_id: "sample-node", type: "static", status: "ACTIVE", planID: "starter", envs: [], defaultSubdomain: true } });
  throw Error("Unexpected external request in static publication fixture");
};
