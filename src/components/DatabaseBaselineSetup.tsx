"use client";

import { useEffect, useRef, useState, type FormEvent } from "react";
import { parseDatabaseBaseline, type DatabaseBaseline } from "../contracts/database-baseline.ts";
import { object } from "../contracts/validation.ts";
import { api } from "./api.ts";

export function DatabaseBaselineSetup({ projectId, csrf, disabled }: { projectId: string; csrf: string; disabled: boolean }) {
  const [stored, setStored] = useState<readonly DatabaseBaseline[]>([]), [file, setFile] = useState<File | null>(null),
    [tables, setTables] = useState<readonly string[]>([]), [selected, setSelected] = useState<readonly string[]>([]),
    [busy, setBusy] = useState(false), [error, setError] = useState<string | null>(null), [loaded, setLoaded] = useState(false), [saved, setSaved] = useState(false);
  const pending = useRef<AbortController | null>(null), requestKey = useRef<string | null>(null), input = useRef<HTMLInputElement | null>(null);
  useEffect(() => () => pending.current?.abort(), []);
  const path = `/api/projects/database-baselines?projectId=${projectId}`;
  const read = async () => {
    if (busy) return;
    const controller = new AbortController(); pending.current = controller; setBusy(true); setError(null);
    try { const rows = await api(path, value => { const rows = object(value).baselines; if (!Array.isArray(rows)) throw new Error("فهرست ساختارها معتبر نیست."); return rows.map(parseDatabaseBaseline); }, { signal: controller.signal });
      setStored(rows); setLoaded(true);
    } catch (error) { setError(controller.signal.aborted ? "بررسی لغو شد." : error instanceof Error ? error.message : "فهرست ساختارها دریافت نشد."); }
    finally { if (pending.current === controller) { pending.current = null; setBusy(false); } }
  };
  const submit = async (event: FormEvent) => {
    event.preventDefault(); if (!file || busy) return;
    const controller = new AbortController(); pending.current = controller; setBusy(true); setError(null); setSaved(false);
    try {
      if (file.size > 8 * 1024 * 1024) throw new Error("فایل باید حداکثر ۸ مگابایت باشد.");
      const form = new FormData(); form.set("file", file);
      if (tables.length) {
        if (!selected.length || selected.length > 8) throw new Error("یک تا هشت جدول را انتخاب کنید.");
        requestKey.current ??= crypto.randomUUID(); form.set("requestKey", requestKey.current); form.set("tables", JSON.stringify(selected));
        const row = await api(path, value => parseDatabaseBaseline(object(value).baseline), { form, csrf, signal: controller.signal });
        setStored(rows => [...rows.filter(existing => existing.id !== row.id), row]); setSaved(true); setFile(null); setTables([]); setSelected([]); if (input.current) input.current.value = "";
      } else {
        const names = await api(path, value => { const rows = object(value).tables; if (!Array.isArray(rows) || !rows.every(row => typeof row === "string")) throw new Error("فهرست جدول‌ها معتبر نیست."); return rows; }, { form, csrf, signal: controller.signal });
        setTables(names); setSelected([]);
      }
    } catch (error) { setError(controller.signal.aborted ? "بررسی لغو شد؛ برای نتیجهٔ ذخیره‌سازی می‌توانید فهرست را تازه کنید." : error instanceof Error ? error.message : "ساختار فایل بررسی نشد."); }
    finally { if (pending.current === controller) { pending.current = null; setBusy(false); } }
  };
  return <details className="panel" onToggle={event => { if (event.currentTarget.open && !loaded && !busy) void read(); }}>
    <summary>ساختار اولیهٔ دیتابیس</summary>
    <p>اگر migration به جدول‌های قبلی نیاز دارد، فایل SQL را بررسی و ساختار جدول‌های لازم را انتخاب کنید. فقط ساختار محدود وارد می‌شود؛ دادهٔ ردیف‌ها، مالکیت و مجوزهای backup ذخیره نمی‌شوند. اجرای ساختار در دیتابیس آزمایشی به تصمیم ساخت نیاز دارد.</p>
    <form aria-busy={busy} onSubmit={event => void submit(event)}>
      <label>فایل SQL یا backup متنی<input ref={input} type="file" accept=".sql,text/plain,application/sql" disabled={disabled || busy}
        onChange={event => { setFile(event.currentTarget.files?.[0] ?? null); setTables([]); setSelected([]); requestKey.current = null; setError(null); setSaved(false); }} /></label>
      {tables.length ? <fieldset disabled={disabled || busy}><legend>ساختار کدام جدول‌ها لازم است؟</legend>
        {tables.map(table => <label key={table} className={`radio-option${selected.includes(table) ? " selected" : ""}`}><input type="checkbox" checked={selected.includes(table)} onChange={event => {
          const checked = event.currentTarget.checked; setSelected(rows => checked ? [...rows, table] : rows.filter(row => row !== table)); requestKey.current = null;
        }} /><bdi>{table}</bdi></label>)}
      </fieldset> : null}
      <button type="submit" className="button-secondary" disabled={disabled || busy || !file || tables.length > 0 && !selected.length}>{busy ? "در حال بررسی…" : tables.length ? "ذخیرهٔ ساختار انتخاب‌شده" : "بررسی جدول‌های فایل"}</button>
      {busy ? <button type="button" className="button-quiet" onClick={() => pending.current?.abort()}>لغو بررسی</button> : null}
    </form>
    {saved ? <p role="status">ساختار انتخاب‌شده برای همین نسخهٔ پروژه آماده شد. تصمیم ساخت، فایل‌ها و پیش‌نیازهای مصرف‌شده را مشخص می‌کند.</p> : null}
    {stored.length ? <ul>{stored.map(row => <li key={row.id}>{row.tables.map(table => <bdi key={table}> {table} </bdi>)}<span className="hint"> — {new Intl.NumberFormat("fa-IR").format(row.statements)} عبارت ساختار</span></li>)}</ul> : loaded ? <p className="hint">هنوز ساختار اولیه‌ای برای این نسخه وارد نشده است.</p> : null}
    {error ? <p role="alert" className="error-message">{error}</p> : null}
    <button type="button" className="button-quiet" disabled={disabled || busy} onClick={() => void read()}>تازه‌کردن فهرست ساختارها</button>
  </details>;
}
