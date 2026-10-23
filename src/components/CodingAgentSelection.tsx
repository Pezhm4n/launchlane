"use client";
import { useState } from "react";
import { codexWorkerModel, codexWorkerVersion, type CodingAgentChoice } from "../contracts/coding-agent.ts";

export function CodingAgentSelection({ selected, disabled, onPropose, onCancel }: {
  selected?: CodingAgentChoice; disabled: boolean; onPropose: (choice: CodingAgentChoice) => void; onCancel?: () => void;
}) {
  const [kind, setKind] = useState(selected?.kind ?? "internal"),
    [acknowledged, setAcknowledged] = useState(false),
    [fallback, setFallback] = useState(selected?.kind === "codex" ? selected.fallbackBeforeDispatch : true);
  return <section className="agent-repair" aria-labelledby="coding-agent-title">
    <h3 id="coding-agent-title">عامل اصلاح پروژه</h3>
    <label htmlFor="coding-agent-choice">اصلاح خطا با</label>
    <select id="coding-agent-choice" value={kind} disabled={disabled} onChange={event => {
      if (event.target.value === "internal" || event.target.value === "codex") setKind(event.target.value);
      setAcknowledged(false);
    }}>
      <option value="internal">عامل داخلی Launchlane</option>
      <option value="codex">Codex همین دستگاه</option>
      <option value="claude" disabled>Claude Code — اتصال اجرایی هنوز آماده نیست</option>
      <option value="opencode" disabled>OpenCode — اتصال اجرایی هنوز آماده نیست</option>
    </select>
    {kind === "codex" ? <>
      <p>Codex از حساب ChatGPT واردشده در همین دستگاه استفاده می‌کند. فقط فایل‌های مجاز و خطای مرتبط را دریافت می‌کند؛ آزمون و انتشار با Launchlane است. اتصال و نسخه پیش از اجرای مجاز بررسی می‌شوند؛ انتخاب این گزینه به معنی «متصل» نیست.</p>
      <label><input type="checkbox" checked={acknowledged} disabled={disabled} onChange={event => setAcknowledged(event.target.checked)} /> مصرف اشتراک Codex با قیمت نامعلوم را برای تلاش‌های محدود همین برنامه می‌پذیرم؛ این مصرف از اعتبار مدل داخلی جداست.</label>
      <label><input type="checkbox" checked={fallback} disabled={disabled} onChange={event => setFallback(event.target.checked)} /> اگر Codex پیش از شروع اصلاح آماده نبود، عامل داخلی با بودجهٔ باقی‌مانده ادامه دهد. نتیجهٔ نامعلوم، اجرای موازی نمی‌سازد.</label>
    </> : <p>عامل داخلی از بودجهٔ همین مأموریت استفاده می‌کند. اتصال عامل بیرونی لازم نیست.</p>}
    <div className="button-row">
      <button type="button" disabled={disabled || kind === "codex" && !acknowledged} onClick={() => onPropose(kind === "codex"
        ? { kind: "codex", mode: "packet_only", version: codexWorkerVersion, model: codexWorkerModel, cost: "subscription_usage_unpriced", acknowledgeUnknownCost: true, fallbackBeforeDispatch: fallback }
        : { kind: "internal" })}>بررسی برنامهٔ انتشار و اصلاح خودکار</button>
      {onCancel ? <button type="button" className="button-secondary" disabled={disabled} onClick={onCancel}>حفظ انتخاب قبلی</button> : null}
    </div>
  </section>;
}
