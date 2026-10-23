import type { ProjectProfile } from "../contracts/domain.ts";

export function PlatformBadge({ runtime, version }: { runtime: ProjectProfile["runtime"]; version?: string | undefined }) {
  if (runtime === "unknown") return null;
  const name = runtime === "node" ? "Node.js" : "Python";
  return <span className="platform-badge" data-platform={runtime} title="نوع پروژه بر اساس بررسی فایل‌های انتخاب‌شده">
    <span className="platform-mark" aria-hidden="true" />
    <bdi>{name}{runtime === "python" && version ? ` ${version}` : ""}</bdi>
  </span>;
}
