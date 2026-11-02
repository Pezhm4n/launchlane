import { readFileSync } from "node:fs";
import { join } from "node:path";
import type { Page } from "playwright";

export function angularFixtureFiles() {
  return ["package.json", "pnpm-workspace.yaml", "pnpm-lock.yaml", "apps/web/package.json", "apps/web/angular.json", "apps/web/tsconfig.json", "apps/web/dist.test.mjs", "apps/web/src/main.ts", "apps/web/src/index.html", "apps/web/src/styles.css", "apps/web/src/invoice.mjs"]
    .map(path => ({ path, content: readFileSync(join("tests/fixtures/pnpm-angular-component", path)) }));
}
export async function assertAngularWorkload(page: Page, origin: string) {
  await page.goto(origin); await page.getByText("Angular component total: 73", { exact: true }).waitFor();
  await page.getByRole("button", { name: "Add item", exact: true }).click(); await page.getByText("Angular component total: 81", { exact: true }).waitFor();
  await page.getByRole("link", { name: "Open orders", exact: true }).click(); await page.waitForURL(`${origin}/orders`); await page.getByText("Orders total: 81", { exact: true }).waitFor();
  await page.reload(); await page.getByText("Orders total: 73", { exact: true }).waitFor();
}
