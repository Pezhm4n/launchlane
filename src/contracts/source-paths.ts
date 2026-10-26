const excludedNames = new Set([
  ".git", ".hg", ".svn", ".idea", ".vscode", "node_modules", ".next", ".data", ".local", ".artifacts",
  ".agents", ".codex", ".claude", ".gemini", ".cursor", ".history", ".system_generated",
  "agents.md", "claude.md", "continuity.md", "memory.md", "handoff.md",
  ".cache", ".npm", ".yarn", ".astro", ".vite", ".nuxt", ".output", ".svelte-kit", ".turbo",
  "coverage", "dist", "dist-server", "dist-ssr", "build", "out", "vendor",
  ".vercel", ".liara", ".ssh", ".aws", "__pycache__", ".venv", "venv", ".pytest_cache", ".mypy_cache", ".ruff_cache",
]);

export function excludedPath(name: string): boolean {
  return excludedNames.has(name.toLowerCase()) || /^\.env/i.test(name) || /^\.dev\.vars(?:\.|$)/i.test(name) ||
    /^(?:handoff|continuity|migration[_-]guide|release[_-]notes|deep[_-]research[_-]report)(?:[-_].*)?\.md$/i.test(name) ||
    /(?:credential|password|secret|access[-_]?token|api[-_]?key)/i.test(name) && !/\.(?:[cm]?[jt]sx?|py|php|go|rb|cs|fs|vb|java|rs|c|cpp|h|hpp|vue|svelte|astro)$/i.test(name) ||
    /\.(?:pem|key|p12|pfx|db|sqlite\d*|log|gz|zip|tar)$/i.test(name) ||
    /^(?:\.npmrc|\.netrc|id_rsa|id_ed25519)$/i.test(name);
}

export function sourceFileAllowed(name: string): boolean {
  return /\.(?:py|php|go|mod|sum|cs|fs|vb|csproj|fsproj|vbproj|sln|props|targets|resx|razor|cshtml|sh|bash|java|rb|rs|c|cpp|h|hpp|tmpl|vue|svelte|astro|toml|cfg|[cm]?[jt]sx?|jsonc?|lock|mdx?|txt|sql|xml|webmanifest|html?|css|scss|svg|png|jpe?g|webp|avif|ico|woff2?|ttf|otf|ya?ml)$/i.test(name) ||
    ["Dockerfile", "Procfile", "artisan", "Gemfile", "Rakefile", "Makefile", ".dockerignore", ".gitignore"].includes(name) ||
    /^(?:LICENSE|LICENCE|COPYING|NOTICE)(?:[-.][A-Z0-9-]+)?$/i.test(name);
}
