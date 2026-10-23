import type { ProjectProfile } from "../contracts/domain.ts";

export function PlatformBadge({ runtime, version, framework }: { runtime: ProjectProfile["runtime"]; version?: string | undefined; framework?: "next" | undefined }) {
  if (runtime === "unknown") return null;
  const name = framework === "next" ? "Next.js" : runtime === "node" ? "Node.js" : runtime === "static" ? "Static" : "Python";
  return <span className="platform-badge" data-platform={framework ?? runtime} title="نوع پروژه بر اساس بررسی فایل‌های انتخاب‌شده">
    <span className="platform-mark" aria-hidden="true" />
    <bdi>{name}{runtime === "python" && version ? ` ${version}` : ""}</bdi>
  </span>;
}
