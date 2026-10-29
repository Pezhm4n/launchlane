import type { PnpmBuildPlan } from "../contracts/project-build.ts";

export function pnpmBuildCommand(build: PnpmBuildPlan): string {
  return `pnpm ${build.workspace.manager.version}; install --frozen-lockfile; build: ${build.buildCommand ?? "none"}${build.phase === "compile" ? "; compile only" : `${build.testCommand ? `; test: ${build.testCommand}` : ""}; start: ${build.startCommand}; GET ${build.workload.path}`}`;
}
export function PnpmBuildReview({ build }: { build: PnpmBuildPlan }) {
  return <section aria-labelledby="pnpm-build-title">
    <h4 id="pnpm-build-title">{build.phase === "compile" ? "ساخت بسته‌های پروژه" : "ساخت و اجرای workspace"}</h4>
    <p className="note">{build.phase === "compile"
      ? "فقط نصب قفل‌شده و فرمان ساخت اصلی ریشه اجرا می‌شوند. تست‌های برنامه، شروع سرویس، اتصال دیتابیس و انتشار در این تصمیم نیستند؛ نتیجهٔ موفق، نسخهٔ قابل انتشار نمی‌سازد."
      : "نصب، ساخت، تست و اجرای اصلی با همان lock ریشه بررسی می‌شوند. این نتیجه، اتصال داده، ماندگاری یا انتشار عمومی را تأیید نمی‌کند."}</p>
    <p className="hint">نسخهٔ <bdi>pnpm {build.workspace.manager.version}</bdi>، نسخهٔ <bdi>Node {build.nodeVersion}</bdi> و همهٔ بسته‌ها با هم بررسی می‌شوند؛ lock اصلی حفظ می‌شود.</p>
    <details><summary>بسته‌ها و وابستگی‌های داخلی</summary><ul>{build.workspace.packages.map(pkg => <li key={pkg.root}>
      <bdi>{pkg.root}</bdi> — <bdi>{pkg.name}</bdi>{pkg.dependencies.length ? <>؛ وابسته به {pkg.dependencies.map(name => <bdi key={name}> {name} </bdi>)}</> : null}
    </li>)}</ul></details>
  </section>;
}
