import type { PnpmBuildPlan, PnpmComponentBuildPlan } from "../contracts/project-build.ts";

export function pnpmBuildCommand(build: PnpmBuildPlan | PnpmComponentBuildPlan): string {
  if (build.version === 9) return `pnpm ${build.workspace.manager.version}; install --frozen-lockfile; build: ${build.buildCommand}; ${build.testCommand ? `pnpm --dir ${build.component.root} run test; ` : "no component test declared; "}${build.component.kind === "node" ? `node ${build.component.argv.join(" ")}` : `serve ${build.component.outputDirectory}`}; GET ${build.workload.path}`;
  return `pnpm ${build.workspace.manager.version}; install --frozen-lockfile; build: ${build.buildCommand ?? "none"}${build.phase === "compile" ? "; compile only" : `${build.testCommand ? `; test: ${build.testCommand}` : ""}; start: ${build.startCommand}; GET ${build.workload.path}`}`;
}
export function PnpmBuildReview({ build }: { build: PnpmBuildPlan | PnpmComponentBuildPlan }) {
  if (build.version === 9) return <section aria-labelledby="pnpm-build-title">
    <h4 id="pnpm-build-title">ساخت و بررسی بخش انتخاب‌شده</h4>
    <p><bdi>{build.component.name}</bdi> در <bdi>{build.component.root}</bdi></p>
    <p className="note">نصب با lock اصلی و فرمان ساخت ریشه انجام می‌شود؛ تست‌های همین بخش و پاسخ خروجی ساخته‌شده بررسی می‌شوند. نسخهٔ قابل انتشار، همین فایل‌های ساخته‌شده و وابستگی‌های اجرای آن را نگه می‌دارد. مقصد دوباره نصب یا build نمی‌کند.</p>
    <p className="hint">این نتیجه، تست‌های دیگر ریشه، سایر اجزا، دیتابیس و ماندگاری داده یا انتشار کامل پروژه را تأیید نمی‌کند. انتشار این بخش تصمیم جدا می‌خواهد.</p>
    {!build.testCommand ? <p className="note">این بخش فرمان test ندارد؛ موفقیت تست ادعا نمی‌شود.</p> : null}
    <details><summary>روش اجرا و بخش‌های باقی‌مانده</summary>
      <p><bdi>pnpm {build.workspace.manager.version} · Node {build.nodeVersion}</bdi></p>
      <p>خروجی: <bdi>{build.component.outputDirectory}</bdi></p>
      {build.component.remainingRoots.length ? <ul>{build.component.remainingRoots.map(root => <li key={root}><bdi>{root}</bdi></li>)}</ul> : <p>نیازهای داده و رفتار کامل پروژه همچنان باید جداگانه بررسی شوند.</p>}
      {build.apiChecks.map(check => <p key={check.path}>معیار API: <bdi>{check.path}</bdi>، وضعیت <bdi>{check.status}</bdi></p>)}
    </details>
  </section>;
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
