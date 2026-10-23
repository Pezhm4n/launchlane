"use client";
import { useEffect, useRef, useState, type FormEvent } from "react";
import { api, ClientError } from "./api.ts";
import { object } from "../contracts/validation.ts";
import styles from "./LiaraSignIn.module.css";

export function LiaraSignIn({ onSignedIn }: { onSignedIn: () => Promise<void> }) {
  const [email, setEmail] = useState(""), [password, setPassword] = useState(""), [totp, setTotp] = useState("");
  const [showPassword, setShowPassword] = useState(false), [twoFactor, setTwoFactor] = useState(false), [busy, setBusy] = useState(false);
  const [error, setError] = useState<ClientError | null>(null), code = useRef<HTMLInputElement>(null), errorBox = useRef<HTMLDivElement>(null), pending = useRef(false);
  useEffect(() => { if (twoFactor) code.current?.focus(); }, [twoFactor]);
  useEffect(() => { if (error) errorBox.current?.focus(); }, [error]);
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); if (pending.current) return; pending.current = true; setBusy(true); setError(null);
    try {
      if (!twoFactor) {
        const checked = await api("/api/session/liara", value => object(value).twoFactorRequired === true, { body: { operation: "check", email } });
        if (checked) { setTwoFactor(true); return; }
      }
      await api("/api/session/liara", () => true, { body: { operation: "login", email, password, ...(twoFactor ? { totp } : {}) } });
      setPassword(""); setTotp(""); setShowPassword(false);
      await onSignedIn();
    } catch (failure) {
      setPassword(""); setTotp(""); setShowPassword(false);
      if (failure instanceof ClientError && failure.code === "LIARA_TOTP_REQUIRED") setTwoFactor(true);
      setError(failure instanceof ClientError ? failure : new ClientError("NETWORK_ERROR", "ارتباط کامل نشد؛ دوباره تلاش کنید.", "", true));
    } finally { setBusy(false); pending.current = false; }
  }
  return <div className={styles.layout}>
    <section className={styles.story} aria-labelledby="welcome-title">
      <span className={styles.eyebrow}>از پروژهٔ شما، تا سایت شما</span>
      <h1 id="welcome-title">پروژه‌تان را<br />همین‌جا منتشر کنید.</h1>
      <p>با حساب لیارا وارد شوید، پوشهٔ پروژه را بیاورید و پیشنهاد انتشار و هزینه را بررسی کنید.</p>
      <div className={styles.path}><span>پروژهٔ شما</span><svg viewBox="0 0 80 16" aria-hidden="true"><path d="M78 8H2m8-6L2 8l8 6" /></svg><span>Launchlane</span><svg viewBox="0 0 80 16" aria-hidden="true"><path d="M78 8H2m8-6L2 8l8 6" /></svg><span>لیارا</span></div>
      <p className={styles.note}>پیش از ساخت منابع یا انتشار، مقصد و هزینه را به شما نشان می‌دهیم.</p>
    </section>
    <section className={styles.card} aria-labelledby="liara-login-title">
      <div className={styles.mark} aria-hidden="true"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 16h14a3 3 0 0 0 .5-6A6 6 0 0 0 8 8a4 4 0 0 0-3 8Z" /></svg></div>
      <h2 id="liara-login-title">ورود با حساب لیارا</h2>
      <p className={styles.description}>همان ایمیل و رمزی که در لیارا استفاده می‌کنید.</p>
      {error ? <div className={styles.error} role="alert" tabIndex={-1} ref={errorBox}><p>{error.message}</p>{error.code === "LIARA_PASSWORD_REQUIRED" ? <a href="https://console.liara.ir/settings/security" target="_blank" rel="noreferrer">تنظیم رمز در لیارا</a> : null}{error.requestId ? <details><summary>شناسهٔ پیگیری</summary><code>{error.requestId}</code></details> : null}</div> : null}
      <form onSubmit={submit} className={styles.form} aria-busy={busy}>
        <label htmlFor="liara-email">ایمیل حساب لیارا</label>
        <input id="liara-email" type="email" dir="ltr" inputMode="email" autoComplete="username" autoCapitalize="none" spellCheck={false} required maxLength={320} value={email} disabled={busy} onChange={event => { setEmail(event.target.value); setTwoFactor(false); setTotp(""); }} />
        <label htmlFor="liara-password">رمز عبور</label>
        <div className={styles.password}><input id="liara-password" type={showPassword ? "text" : "password"} dir="ltr" autoComplete="current-password" required maxLength={1024} value={password} disabled={busy} onChange={event => setPassword(event.target.value)} />
          <button type="button" className="button-quiet" aria-label={showPassword ? "پنهان‌کردن رمز عبور" : "نمایش رمز عبور"} aria-pressed={showPassword} disabled={busy} onClick={() => setShowPassword(value => !value)}><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M2 12s4-7 10-7 10 7 10 7-4 7-10 7S2 12 2 12Z" /><circle cx="12" cy="12" r="3" />{showPassword ? <path d="m3 3 18 18" /> : null}</svg></button>
        </div>
        {twoFactor ? <div className={styles.challenge}><label htmlFor="liara-totp">کد تأیید دومرحله‌ای</label><p id="totp-help">کد شش‌رقمی برنامهٔ تأیید حساب لیارا را وارد کنید.</p><input ref={code} id="liara-totp" dir="ltr" inputMode="numeric" autoComplete="one-time-code" pattern="[0-9]{6}" maxLength={6} required value={totp} disabled={busy} aria-describedby="totp-help" onChange={event => setTotp(event.target.value.replace(/[۰-۹]/g, digit => String(digit.charCodeAt(0) - 1776)).replace(/[٠-٩]/g, digit => String(digit.charCodeAt(0) - 1632)))} /></div> : null}
        <button type="submit" disabled={busy} className={styles.submit}>{busy ? <span className={styles.spinner} aria-hidden="true" /> : null}{busy ? "در حال بررسی حساب…" : twoFactor ? "تأیید کد و ورود" : "ورود و ادامه"}</button>
      </form>
      <p className={styles.privacy}>رمز شما در Launchlane ذخیره نمی‌شود. اتصال حساب برای دفعات بعد به‌صورت رمزگذاری‌شده نگه داشته می‌شود.</p>
      <div className={styles.links}><a href="https://console.liara.ir" target="_blank" rel="noreferrer">هنوز حساب لیارا ندارید؟</a><a href="https://console.liara.ir/login" target="_blank" rel="noreferrer">رمزتان را فراموش کرده‌اید؟</a></div>
    </section>
  </div>;
}
