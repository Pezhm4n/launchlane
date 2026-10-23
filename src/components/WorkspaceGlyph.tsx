import type { CSSProperties } from "react";

export type WorkspaceGlyphName = "cloud" | "code" | "branch" | "arrow" | "spark" | "shield" | "message" | "close" | "send" | "check" | "search";

const paths: Record<WorkspaceGlyphName, string[]> = {
  cloud: ["M7 18a5 5 0 1 1 .7-9.95A6 6 0 0 1 19 10a4 4 0 0 1-1 8", "M12 20V11m-3 3 3-3 3 3"],
  code: ["m8 7-5 5 5 5m8-10 5 5-5 5m-3-13-2 20"],
  branch: ["M6 7v10m0-6h8a4 4 0 0 0 4-4", "M6 7a2 2 0 1 0 0-4 2 2 0 0 0 0 4Zm0 14a2 2 0 1 0 0-4 2 2 0 0 0 0 4ZM18 7a2 2 0 1 0 0-4 2 2 0 0 0 0 4Z"],
  arrow: ["M19 12H5m6-6-6 6 6 6"],
  spark: ["m12 3 2.6 6.4L21 12l-6.4 2.6L12 21l-2.6-6.4L3 12l6.4-2.6L12 3Z"],
  shield: ["M12 3 4 6v6c0 5 8 9 8 9s8-4 8-9V6l-8-3Z", "m8.5 12 2.5 2.5 4.5-5"],
  message: ["M5 4h14a2 2 0 0 1 2 2v10a2 2 0 0 1-2 2h-9l-5 3v-3H5a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2Z", "M7 9h10m-10 4h6"],
  close: ["m6 6 12 12M6 18 18 6"],
  send: ["m21 3-6.5 18-4-7.5L3 9.5 21 3Z", "M10.5 13.5 21 3"],
  check: ["m5 12 4 4L19 6"],
  search: ["M16 10a6 6 0 1 1-12 0 6 6 0 0 1 12 0Zm-1 5 6 6"],
};

export function WorkspaceGlyph({ name, className = "", style }: {
  name: WorkspaceGlyphName; className?: string; style?: CSSProperties;
}) {
  return <svg className={`studio-glyph ${className}`} style={style} viewBox="0 0 24 24" fill="none" stroke="currentColor"
    strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" focusable="false">
    {paths[name].map(path => <path key={path} d={path} />)}
  </svg>;
}
