// Explicit blanks prevent Docker CLI config proxy credentials from entering guest PID 1.
export const sandboxProxyKeys = ["HTTP_PROXY","HTTPS_PROXY","ALL_PROXY","NO_PROXY","FTP_PROXY","http_proxy","https_proxy","all_proxy","no_proxy","ftp_proxy"] as const;
export function blankSandboxProxyArguments(): string[] {return sandboxProxyKeys.flatMap(key=>["--env",`${key}=`]);}
export function hasBlankSandboxProxies(value: unknown): boolean {
  return Array.isArray(value) && value.every(row=>typeof row==="string") && sandboxProxyKeys.every(key=>value.filter(row=>row.startsWith(`${key}=`)).length===1&&value.includes(`${key}=`));
}
