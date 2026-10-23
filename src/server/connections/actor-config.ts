import type { Config } from "../config.ts";
import type { Store } from "../persistence/store.ts";

// Hosted requests derive their cloud scope from this actor's verified connection, never install defaults.
export function actorConfig(config: Config, store: Store, actorId: string): Config {
  if (config.authMode !== "liara") return config;
  const connection = store.getConnection(actorId, "liara")?.view;
  return { ...config, teamId: connection?.status === "connected" ? connection.teamId ?? "" : "",
    apps: [], liaraToken: "", workspaceRoot: null, probeOrigins: {}, operatorToken: "", githubCliPath: "" };
}
