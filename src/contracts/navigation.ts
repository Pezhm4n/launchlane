export function workbenchLocation(search: string) {
  const params = new URLSearchParams(search), project = params.get("project");
  return {
    mode: (params.get("view") === "accounts" ? params.get("from") : params.get("view")) === "incident" ? "incident" as const : "source" as const,
    accounts: params.get("view") === "accounts",
    project: project && /^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/.test(project) ? project : null,
  };
}
