declare module "next/dist/compiled/acorn/acorn.js" {
  const parser: {
    parse(source: string, options: { ecmaVersion: "latest"; sourceType: "module" | "script"; allowHashBang: boolean }): unknown;
  };
  export default parser;
}
