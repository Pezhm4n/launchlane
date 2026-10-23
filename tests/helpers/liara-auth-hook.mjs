// Isolated HTTP/browser tests only: no request may reach a real provider.
const native = globalThis.fetch;
globalThis.fetch = async (input, init = {}) => {
  const url = new URL(typeof input === "string" || input instanceof URL ? input : input.url);
  if (["127.0.0.1", "localhost"].includes(url.hostname)) return native(input, init);
  if (url.origin !== "https://api.liara.ir") throw Error("Unexpected external request in authentication fixture");
  const row = typeof init.body === "string" ? JSON.parse(init.body) : {}, bob = row.email === "bob@example.test" || new Headers(init.headers).get("authorization") === "Bearer synthetic-browser-liara-bob-token",
    identity = (bob ? "b" : "c").repeat(24), team = (bob ? "d" : "e").repeat(24);
  if (url.pathname === "/v1/login/check-if-exists") return Response.json({ status: "success", exists: true, socialCompleted: true, twoFAEnabled: row.email === "twofactor@example.test" });
  if (url.pathname === "/v1/login") {
    if (row.password !== "synthetic-browser-password" || row.email === "twofactor@example.test" && row.totp !== "123456") return Response.json({ message: "discard sensitive upstream body" }, { status: 401 });
    return Response.json({ api_token: bob ? "synthetic-browser-liara-bob-token" : "synthetic-browser-liara-alice-token" });
  }
  if (url.pathname === "/v2/teams") return Response.json({ totalTeams: 1, teams: [{ _id: team, name: bob ? "فضای باب" : "فضای آلیس" }] });
  if (url.pathname === "/v1/me") return Response.json({ user: { _id: identity, fullname: bob ? "باب" : "آلیس", email: bob ? "bob@example.test" : "alice@example.test" },
    ...(url.searchParams.has("teamID") ? { team: { _id: team, teamName: bob ? "فضای باب" : "فضای آلیس" } } : {}) });
  if (url.pathname === "/v1/projects") return Response.json({ projects: [] });
  throw Error("Unexpected Liara endpoint in authentication fixture");
};
