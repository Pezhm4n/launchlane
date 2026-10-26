export const environmentFileNames = [".dev.vars", ".dev.vars.local", ".env", ".env.production", ".env.local", ".env.production.local"] as const;
export const environmentFileMaxBytes = 32 * 1024;
export function isEnvironmentFile(name: string): boolean {
  return environmentFileNames.some(candidate => candidate === name);
}
