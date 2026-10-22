"use client";

import { Fragment, useEffect, useRef, useState, type ReactNode } from "react";

const inlinePattern = /(`[^`\n]+`|\*\*[^*\n]+\*\*|\[[^\]\n]+\]\(https?:\/\/[^\s)]+\))/g;
const blockStart = /^(```|#{1,4}\s|>\s?|([-*+]|\d+[.)])\s+)/;

function inline(text: string): ReactNode[] {
  const nodes: ReactNode[] = [];
  let last = 0;
  for (const match of text.matchAll(inlinePattern)) {
    const index = match.index ?? 0;
    if (index > last) nodes.push(text.slice(last, index));
    const token = match[0] ?? "";
    if (!token) continue;
    if (token.startsWith("`")) {
      nodes.push(
        <code dir="ltr" key={index}>
          {token.slice(1, -1)}
        </code>,
      );
    } else if (token.startsWith("**")) {
      nodes.push(<strong key={index}>{token.slice(2, -2)}</strong>);
    } else {
      const link = /^\[([^\]]+)\]\((https?:\/\/[^\s)]+)\)$/.exec(token);
      const label = link?.[1];
      const href = link?.[2];
      if (label && href)
        nodes.push(
          <a key={index} href={href} target="_blank" rel="noreferrer">
            {label}
          </a>,
        );
      else nodes.push(token);
    }
    last = index + token.length;
  }
  if (last < text.length) nodes.push(text.slice(last));
  return nodes;
}

function CodeBlock({ code, language }: { code: string; language: string }) {
  const [state, setState] = useState<"idle" | "copied" | "failed">("idle"),
    [wrapped, setWrapped] = useState(false);
  const timer = useRef<number | null>(null);
  useEffect(
    () => () => {
      if (timer.current !== null) window.clearTimeout(timer.current);
    },
    [],
  );
  async function copy() {
    if (timer.current !== null) window.clearTimeout(timer.current);
    try {
      await navigator.clipboard.writeText(code);
      setState("copied");
    } catch {
      setState("failed");
    }
    timer.current = window.setTimeout(() => setState("idle"), 1800);
  }
  return (
    <div className="code-block">
      <div className="code-head">
        <span className="code-language" dir="ltr">
          {language || "code"}
        </span>
        <div className="code-actions">
          <button
            type="button"
            className="button-quiet code-copy"
            aria-pressed={wrapped}
            onClick={() => setWrapped((current) => !current)}
          >
            شکستن خطوط
          </button>
          <button type="button" className="button-quiet code-copy" onClick={() => void copy()}>
            {state === "copied" ? "کپی شد" : state === "failed" ? "کپی نشد" : "کپی کد"}
          </button>
        </div>
      </div>
      <pre
        dir="ltr"
        className={wrapped ? "code-wrapped" : undefined}
        // biome-ignore lint/a11y/noNoninteractiveTabindex: Long code blocks scroll independently and need keyboard access.
        tabIndex={0}
      >
        <code dir="ltr">{code}</code>
      </pre>
    </div>
  );
}

export function RichText({ text }: { text: string }) {
  const lines = text.replace(/\r\n?/g, "\n").split("\n");
  const blocks: ReactNode[] = [];
  let index = 0;
  while (index < lines.length) {
    const line = lines[index] ?? "";
    if (!line.trim()) {
      index++;
      continue;
    }
    const fence = /^```\s*([\w.+#-]*)\s*$/.exec(line);
    if (fence) {
      const code: string[] = [];
      index++;
      while (index < lines.length) {
        const row = lines[index];
        if (row === undefined || /^```\s*$/.test(row)) break;
        code.push(row);
        index++;
      }
      if (index < lines.length) index++;
      blocks.push(
        <CodeBlock key={`code-${index}`} code={code.join("\n")} language={fence[1] ?? ""} />,
      );
      continue;
    }
    const heading = /^(#{1,4})\s+(.+)$/.exec(line);
    if (heading) {
      blocks.push(
        <p className="md-heading" dir="auto" key={`heading-${index}`}>
          {inline(heading[2] ?? "")}
        </p>,
      );
      index++;
      continue;
    }
    if (/^>\s?/.test(line)) {
      const quote: string[] = [];
      while (index < lines.length) {
        const row = lines[index];
        if (row === undefined || !/^>\s?/.test(row)) break;
        quote.push(row.replace(/^>\s?/, ""));
        index++;
      }
      let quoteKey = 0;
      blocks.push(
        <blockquote dir="auto" key={`quote-${index}`}>
          {quote.map((row) => (
            <p key={`${row}-${quoteKey++}`}>{inline(row)}</p>
          ))}
        </blockquote>,
      );
      continue;
    }
    if (/^([-*+]|\d+[.)])\s+/.test(line)) {
      const ordered = /^\d/.test(line);
      const pattern = ordered ? /^\d+[.)]\s+/ : /^[-*+]\s+/;
      const items: string[] = [];
      while (index < lines.length) {
        const row = lines[index];
        if (row === undefined || !pattern.test(row)) break;
        items.push(row.replace(pattern, ""));
        index++;
      }
      let itemKey = 0;
      const listItems = items.map((item) => <li key={`${item}-${itemKey++}`}>{inline(item)}</li>);
      blocks.push(
        ordered ? (
          <ol className="md-list" dir="auto" key={`list-${index}`}>
            {listItems}
          </ol>
        ) : (
          <ul className="md-list" dir="auto" key={`list-${index}`}>
            {listItems}
          </ul>
        ),
      );
      continue;
    }
    const paragraph: string[] = [];
    while (index < lines.length) {
      const row = lines[index];
      if (row === undefined || !row.trim() || blockStart.test(row)) break;
      paragraph.push(row);
      index++;
    }
    if (paragraph.length === 0) {
      paragraph.push(line);
      index++;
    }
    let rowKey = 0;
    blocks.push(
      <p dir="auto" key={`paragraph-${index}`}>
        {paragraph.map((row) => (
          <Fragment key={`${row}-${rowKey++}`}>
            {inline(row)}
            {rowKey < paragraph.length ? <br /> : null}
          </Fragment>
        ))}
      </p>,
    );
  }
  return <div className="rich-text">{blocks}</div>;
}
