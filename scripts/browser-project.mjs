// The legacy operational regressions enter the explicit technical disclosure.
// The guided journey is exercised separately without opening this fallback.
export async function reviewProject(page) {
  const details = page.locator(".project-technical");
  await details.waitFor();
  if (!(await details.evaluate(node => node.open))) await details.locator(":scope > summary").click();
  await page.getByRole("heading", { name: "نتیجه بررسی پروژه", exact: true }).waitFor();
}
export async function editProject(page) {
  const selected = page.locator(".project-summary");
  if (await selected.isVisible()) await selected.getByRole("button", { name: "تغییر پروژه", exact: true }).click();
}
