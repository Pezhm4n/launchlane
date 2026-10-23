const excludedNames = new Set([
  ".git", ".hg", ".svn", "node_modules", ".next", ".data", ".local", ".artifacts",
  ".agents", ".cache", ".npm", ".yarn", "coverage", "dist", "build", "out", "vendor",
  ".vercel", ".liara", ".ssh", ".aws", "__pycache__", ".venv", "venv", ".pytest_cache", ".mypy_cache", ".ruff_cache",
]);

export function excludedPath(name: string): boolean {
  return excludedNames.has(name.toLowerCase()) || /^\.env/i.test(name) ||
    /(?:credential|password|secret|access[-_]?token|api[-_]?key)/i.test(name) ||
    /\.(?:pem|key|p12|pfx|db|sqlite\d*|log|gz|zip|tar)$/i.test(name) ||
    /^(?:\.npmrc|\.netrc|id_rsa|id_ed25519)$/i.test(name);
}

export function sourceFileAllowed(name: string): boolean {
  return /\.(?:py|toml|[cm]?[jt]sx?|json|lock|md|txt|html?|css|scss|svg|png|jpe?g|webp|ico|woff2?|ya?ml)$/i.test(name) ||
    ["Dockerfile", "Procfile", ".dockerignore", ".gitignore"].includes(name) ||
    /^(?:LICENSE|LICENCE|COPYING|NOTICE)(?:[-.][A-Z0-9-]+)?$/i.test(name);
}
