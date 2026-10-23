export const environmentFileNames = [".env", ".env.production", ".env.local", ".env.production.local"] as const;
export const environmentFileMaxBytes = 32 * 1024;
export function isEnvironmentFile(name: string): boolean {
  return environmentFileNames.some(candidate => candidate === name);
}
