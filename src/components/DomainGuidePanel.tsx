"use client";

import { useEffect, useId, useRef, useState, type FormEvent } from "react";
import {
  domainDocumentation,
  parseDomainGuide,
  type DomainDns,
  type DomainGuide,
  type DomainTarget,
} from "../contracts/domain-guide.ts";
import type { WorkspaceView } from "../contracts/domain.ts";
import { object } from "../contracts/validation.ts";
import { api, ClientError } from "./api.ts";

function GuideSteps({ guide }: { guide: DomainGuide }) {
  return (
    <ol className="domain-steps">
      <li>
        <h4>دامنه را در برنامه درست اضافه کنید</h4>
        <p>
          در پنل لیارا، تیم و برنامه {guide.target ? <bdi>{guide.target.app}</bdi> : "مقصد"} را باز
          کنید. از «دامنه‌ها ← افزودن دامنه»، <bdi>{guide.hostname}</bdi> را وارد کنید. دامنه باید
          قبلاً به نام شما ثبت شده باشد.
        </p>
        <a href={domainDocumentation.connect} target="_blank" rel="noreferrer">
          راهنمای افزودن دامنه در لیارا (پنجره جدید)
        </a>
      </li>
      <li>
        <h4>
          {guide.dns === "existing"
            ? "تنظیمات را در سرویس فعلی دامنه وارد کنید"
            : "مدیریت دامنه را در DNS لیارا آماده کنید"}
        </h4>
        {guide.dns === "existing" ? (
          <>
            <p>
              صفحه دامنه در لیارا، نوع، نام و مقدار رکوردهای لازم برای هدایت سایت، تأیید مالکیت و
              گواهی را می‌دهد. همان مقادیر را در سرویس فعلی DNS وارد کنید. اگر این سرویس فعال است،
              برای این مسیر نیازی به تغییر نیم‌سرور نیست.
            </p>
            <p>
              نوع رکورد، مثل <bdi>ALIAS / CNAME</bdi> یا <bdi>TXT</bdi>، به‌تنهایی کافی نیست؛ مقدار
              مخصوص دامنه را از پنل بردارید.
            </p>
          </>
        ) : (
          <>
            <p>
              در پنل لیارا و همین تیم، بخش DNS را باز و دامنه اصلی خریداری‌شده را اضافه کنید.
              نیم‌سرورهایی را که همان صفحه نشان می‌دهد، در پنل فروشنده دامنه ثبت کنید.
            </p>
            {guide.hostname.endsWith(".ir") ? (
              <p>
                برای دامنه‌های <bdi>.ir</bdi>، تغییر نیم‌سرور یا کار هویتی لازم را خودتان در پنل
                ثبت‌کننده یا{" "}
                <a href={domainDocumentation.irnic} target="_blank" rel="noreferrer">
                  ایرنیک (پنجره جدید)
                </a>{" "}
                انجام می‌دهید.
              </p>
            ) : (
              <p>
                خرید، تمدید و تأیید مالکیت نزد فروشنده دامنه با شماست؛ Launchlane به آن حساب دسترسی
                ندارد.
              </p>
            )}
            <p>
              قبل از جابه‌جایی، رکوردهای فعلی، به‌ویژه تنظیمات ایمیل را نگه دارید. لیارا رکوردهای
              سرویس خودش را خودکار اضافه می‌کند؛ رکوردهای سرویس‌های دیگر باید در DNS جدید باقی بمانند.
            </p>
            <a href={domainDocumentation.dns} target="_blank" rel="noreferrer">
              راهنمای شروع DNS لیارا (پنجره جدید)
            </a>
          </>
        )}
      </li>
      <li>
        <h4>وضعیت رکوردها و اتصال امن را در لیارا بررسی کنید</h4>
        <p>
          به صفحه همان دامنه در لیارا برگردید و «بررسی وضعیت رکوردها» را بزنید. سپس از «تهیه گواهی
          SSL»، اتصال امن را فعال کنید. تغییر تنظیمات ممکن است فوری دیده نشود؛ برای حالت‌های خاص مثل
          CDN، راهنمای رسمی را دنبال کنید.
        </p>
        <a href={domainDocumentation.certificate} target="_blank" rel="noreferrer">
          راهنمای فعال‌کردن گواهی (پنجره جدید)
        </a>
      </li>
      <li>
        <h4>همان صفحه سایت را با نشانی جدید امتحان کنید</h4>
        <p>
          بعد از تأیید رکوردها و گواهی در لیارا، صفحه مورد نیاز برنامه را با{" "}
          <bdi>https://{guide.hostname}</bdi> باز کنید. پاسخ صفحه ورود، صفحه پیش‌فرض یا یک صفحه دیگر،
          نتیجه کار اصلی سایت را ثابت نمی‌کند.
        </p>
        <p>
          این راهنما سایت را باز نکرده و اتصال دامنه را تأیید نمی‌کند. ثبت نشانی برای بررسی مشکل هم
          جای اتصال دامنه را نمی‌گیرد.
        </p>
      </li>
    </ol>
  );
}

export function DomainGuidePanel({
  workspace,
  disabled,
  onConnect,
  onRefresh,
  onSessionExpired,
}: {
  workspace: WorkspaceView;
  disabled: boolean;
  onConnect: (trigger: HTMLButtonElement) => void;
  onRefresh: () => Promise<WorkspaceView>;
  onSessionExpired: () => void;
}) {
  const [hostname, setHostname] = useState(""),
    [dns, setDns] = useState<DomainDns>("existing"),
    [preparedGuide, setPreparedGuide] = useState<{ value: DomainGuide; context: string } | null>(
      null,
    ),
    [loading, setLoading] = useState(false),
    [error, setError] = useState<ClientError | null>(null),
    [notice, setNotice] = useState("");
  const pending = useRef<AbortController | null>(null),
    result = useRef<HTMLHeadingElement>(null),
    input = useRef<HTMLInputElement>(null),
    submit = useRef<HTMLButtonElement>(null),
    errorBox = useRef<HTMLDivElement>(null),
    returnFocus = useRef(false);
  const id = useId(),
    nameId = `${id}-name`,
    helpId = `${id}-help`,
    errorId = `${id}-error`;
  const connection = workspace.connections.liara,
    selected = connection?.apps.find((app) => app.name === connection.selectedApp);
  const target: DomainTarget | null =
    connection?.status === "connected" && connection.teamId && selected
      ? { teamId: connection.teamId, appId: selected.id, app: selected.name }
      : null;
  const contextKey = `${connection?.status}:${connection?.teamId}:${connection?.selectedApp}:${selected?.id}`;
  const previousContext = useRef(contextKey);
  const guide = preparedGuide?.context === contextKey ? preparedGuide.value : null;
  const nameError =
    error?.code === "DOMAIN_NAME_INVALID" || error?.code === "DOMAIN_TLD_UNSUPPORTED";
  const targetError =
    error &&
    [
      "DOMAIN_TARGET_CHANGED",
      "DOMAIN_GUIDE_MISMATCH",
      "LIARA_TEAM_MISMATCH",
      "LIARA_APP_REQUIRED",
    ].includes(error.code);

  useEffect(
    () => () => {
      pending.current?.abort();
    },
    [],
  );
  useEffect(() => {
    if (previousContext.current === contextKey) return;
    previousContext.current = contextKey;
    pending.current?.abort();
    pending.current = null;
    setLoading(false);
    setPreparedGuide(null);
    setError(null);
    setNotice(
      "اطلاعات حساب تغییر کرد. نام دامنه حفظ شده است؛ راهنما را برای مقصد تازه آماده کنید.",
    );
  }, [contextKey]);
  useEffect(() => {
    if (guide) {
      result.current?.focus();
      result.current?.scrollIntoView({ block: "start" });
    }
  }, [guide]);
  useEffect(() => {
    if (error) {
      if (nameError) input.current?.focus();
      else errorBox.current?.focus();
    }
  }, [error, nameError]);
  useEffect(() => {
    if (!loading && returnFocus.current) {
      returnFocus.current = false;
      submit.current?.focus();
    }
  }, [loading]);

  function cancel(focus: boolean) {
    pending.current?.abort();
    pending.current = null;
    returnFocus.current = focus;
    setLoading(false);
    setNotice("آماده‌سازی راهنما متوقف شد. هیچ تنظیمی تغییر نکرده است.");
  }
  function change() {
    setPreparedGuide(null);
    setError(null);
    setNotice("");
  }
  async function prepare(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (pending.current || disabled) return;
    const controller = new AbortController();
    pending.current = controller;
    setLoading(true);
    setError(null);
    setNotice("");
    try {
      const prepared = await api(
        "/api/domains/guide",
        (value) => {
          const decoded = parseDomainGuide(object(value).guide);
          const expectedHostname = new URL(`https://${hostname.trim()}`).hostname.replace(
            /\.$/,
            "",
          );
          if (
            decoded.hostname !== expectedHostname ||
            decoded.dns !== dns ||
            decoded.target?.teamId !== target?.teamId ||
            decoded.target?.appId !== target?.appId ||
            decoded.target?.app !== target?.app
          )
            throw new ClientError(
              "DOMAIN_GUIDE_MISMATCH",
              "پاسخ راهنما با دامنه یا مقصد انتخاب‌شده یکسان نیست. مقصد را به‌روزرسانی و دوباره تلاش کنید.",
            );
          return decoded;
        },
        {
          body: { hostname, dns, target },
          csrf: workspace.session.csrfToken,
          signal: controller.signal,
        },
      );
      if (!controller.signal.aborted) setPreparedGuide({ value: prepared, context: contextKey });
    } catch (failure) {
      if (controller.signal.aborted) return;
      if (failure instanceof ClientError && failure.code === "AUTH_REQUIRED") {
        onSessionExpired();
        return;
      }
      const problem =
        failure instanceof ClientError
          ? failure
          : new ClientError(
              "DOMAIN_GUIDE_UNAVAILABLE",
              "راهنما دریافت نشد. ورودی‌ها حفظ شده‌اند؛ دوباره تلاش کنید.",
            );
      if (
        [
          "DOMAIN_TARGET_CHANGED",
          "DOMAIN_GUIDE_MISMATCH",
          "LIARA_TEAM_MISMATCH",
          "LIARA_APP_REQUIRED",
        ].includes(problem.code)
      )
        setPreparedGuide(null);
      setError(problem);
    } finally {
      if (pending.current === controller) {
        pending.current = null;
        setLoading(false);
      }
    }
  }
  async function refreshTarget() {
    if (pending.current || disabled) return;
    const controller = new AbortController();
    pending.current = controller;
    setLoading(true);
    try {
      await onRefresh();
      if (!controller.signal.aborted) {
        setError(null);
        setPreparedGuide(null);
        setNotice("اطلاعات مقصد تازه شد؛ راهنما را دوباره آماده کنید.");
        returnFocus.current = true;
      }
    } catch (failure) {
      if (!controller.signal.aborted) {
        if (failure instanceof ClientError && failure.code === "AUTH_REQUIRED") onSessionExpired();
        else
          setError(
            failure instanceof ClientError
              ? failure
              : new ClientError("DOMAIN_GUIDE_UNAVAILABLE", "مقصد دریافت نشد؛ دوباره تلاش کنید."),
          );
      }
    } finally {
      if (pending.current === controller) {
        pending.current = null;
        setLoading(false);
      }
    }
  }

  return (
    <section className="panel domain-guide" aria-label="اتصال دامنه دلخواه">
      <details
        onToggle={(event) => {
          if (!event.currentTarget.open && pending.current) cancel(false);
        }}
      >
        <summary>دامنه دلخواه وصل کنید</summary>
        <p>
          اختیاری است؛ برای انتشار اولیه به دامنه شخصی نیاز ندارید. اینجا مسیر تنظیم آن را می‌بینید.
        </p>
        <form onSubmit={(event) => void prepare(event)} noValidate>
          <label htmlFor={nameId}>نام دامنه</label>
          <input
            id={nameId}
            ref={input}
            name="domain"
            dir="ltr"
            autoComplete="off"
            spellCheck={false}
            placeholder="example.ir…"
            maxLength={512}
            value={hostname}
            disabled={loading || disabled}
            aria-invalid={nameError || undefined}
            aria-describedby={`${helpId}${nameError ? ` ${errorId}` : ""}`}
            onChange={(event) => {
              setHostname(event.target.value);
              change();
            }}
          />
          <p className="hint" id={helpId}>
            دامنه یا زیردامنه‌ای که خریده‌اید، بدون https و مسیر صفحه؛ مثل <bdi>app.example.ir</bdi>.
          </p>
          {nameError && error ? (
            <p className="field-error" id={errorId} role="alert">
              {error.message}{" "}
              {error.code === "DOMAIN_TLD_UNSUPPORTED" ? (
                <a href={domainDocumentation.supportedTlds} target="_blank" rel="noreferrer">
                  فهرست پسوندها (پنجره جدید)
                </a>
              ) : null}
            </p>
          ) : null}
          <fieldset className="domain-dns-choice" disabled={loading || disabled}>
            <legend>تنظیمات دامنه را کجا انجام می‌دهید؟</legend>
            <label>
              <input
                type="radio"
                name={`${id}-dns`}
                checked={dns === "existing"}
                onChange={() => {
                  setDns("existing");
                  change();
                }}
              />
              سرویس فعلی دامنه را نگه می‌دارم
            </label>
            <label>
              <input
                type="radio"
                name={`${id}-dns`}
                checked={dns === "liara"}
                onChange={() => {
                  setDns("liara");
                  change();
                }}
              />
              می‌خواهم از DNS لیارا استفاده کنم
            </label>
          </fieldset>
          <p className="hint">
            اگر نمی‌دانید، گزینه اول مسیر فعلی را حفظ می‌کند. DNS همان سرویسی است که نشانی دامنه را به
            سایت شما هدایت می‌کند.
          </p>
          <div className="button-row">
            <button type="submit" ref={submit} disabled={loading || disabled}>
              {loading ? "در حال آماده‌کردن راهنما…" : "دیدن راهنمای دامنه"}
            </button>
            {loading ? (
              <button type="button" className="button-secondary" onClick={() => cancel(true)}>
                لغو آماده‌سازی راهنما
              </button>
            ) : null}
          </div>
          {disabled ? (
            <p className="hint">
              پس از پایان کار جاری یا ورود دوباره، می‌توانید راهنما را آماده کنید.
            </p>
          ) : null}
          <p className="hint">
            این کار محلی است؛ دامنه نمی‌خرد، تنظیمی تغییر نمی‌دهد و سایت را بررسی نمی‌کند.
          </p>
        </form>
        <div role="status" className="hint">
          {loading ? "در حال آماده‌کردن راهنما…" : notice}
        </div>
        {error && !nameError ? (
          <div
            ref={errorBox}
            role="alert"
            aria-label="راهنمای دامنه آماده نشد"
            tabIndex={-1}
            className="note note-danger"
          >
            <p>{error.message}</p>
            {targetError ? (
              <button
                type="button"
                className="button-secondary"
                disabled={loading || disabled}
                onClick={() => void refreshTarget()}
              >
                به‌روزرسانی مقصد
              </button>
            ) : null}
            {error.requestId ? (
              <details className="technical-details">
                <summary>شناسه پیگیری</summary>
                <code>{error.requestId}</code>
              </details>
            ) : null}
          </div>
        ) : null}
        {guide ? (
          <div className="domain-guide-result">
            <h3 ref={result} tabIndex={-1}>
              راهنمای اتصال <bdi>{guide.hostname}</bdi>
            </h3>
            <span className="badge badge-warning">اتصال دامنه بررسی نشده</span>
            {guide.target ? (
              <p>
                مقصد انتخاب‌شده: {guide.target.teamName} / <bdi>{guide.target.app}</bdi>. این انتخاب
                از اطلاعات ذخیره‌شده حساب است؛ پیش از تغییر در پنل، همان تیم و برنامه را بررسی کنید.
              </p>
            ) : (
              <div className="note">
                <p>
                  {guide.connection === "reauth_required"
                    ? "اتصال لیارا نیاز به بررسی دوباره دارد."
                    : guide.connection === "app_required"
                      ? "هنوز برنامه مقصد انتخاب نشده است."
                      : "حساب لیارا هنوز متصل نشده است."}{" "}
                  می‌توانید راهنمای عمومی را بخوانید؛ برای مقصد مشخص، حساب و برنامه را انتخاب کنید.
                </p>
                <button
                  type="button"
                  className="button-secondary"
                  disabled={disabled || loading}
                  onClick={(event) => onConnect(event.currentTarget)}
                >
                  {guide.connection === "app_required" ? "انتخاب برنامه مقصد" : "بررسی اتصال لیارا"}
                </button>
              </div>
            )}
            <GuideSteps guide={guide} />
            <a
              className="button-link button-secondary"
              href={domainDocumentation.console}
              target="_blank"
              rel="noreferrer"
            >
              بازکردن پنل لیارا (پنجره جدید)
            </a>
            <details className="technical-details">
              <summary>اگر www یا زیردامنه دیگری لازم دارید</summary>
              <p>
                هر نام را جدا در برنامه اضافه و رکورد همان نام را دریافت کنید. برای <bdi>www</bdi>،
                لیارا مسیر ویژه دارد که به‌صورت پیش‌فرض به دامنه اصلی هدایت می‌شود.
              </p>
              <ul>
                <li>
                  <a href={domainDocumentation.www} target="_blank" rel="noreferrer">
                    راهنمای www (پنجره جدید)
                  </a>
                </li>
                <li>
                  <a href={domainDocumentation.subdomain} target="_blank" rel="noreferrer">
                    راهنمای زیردامنه دلخواه (پنجره جدید)
                  </a>
                </li>
              </ul>
            </details>
            <p className="hint">
              مبنای راهنما: مستندات رسمی لیارا، بررسی‌شده در{" "}
              {new Intl.DateTimeFormat("fa-IR", { dateStyle: "medium", timeZone: "UTC" }).format(
                new Date(`${guide.documentationCheckedOn}T00:00:00Z`),
              )}
              . ثبت، تمدید و هزینه سرویس‌های بیرونی به انتخاب شما بستگی دارد و اینجا تأیید نشده است.
            </p>
          </div>
        ) : null}
      </details>
    </section>
  );
}
