import { latestIncidentEvidence } from "../../contracts/incident-evidence.ts";
import { parseIncidentHandoff, type IncidentHandoff } from "../../contracts/incident-handoff.ts";
import {
  inWindow,
  verifySameSymptom,
  type EvidenceBundle,
  type EvidenceEntry,
} from "../../contracts/incident.ts";
import type { Config } from "../config.ts";
import { openCredential } from "../connections/credentials.ts";
import { ensure } from "../errors.ts";
import type { Store } from "../persistence/store.ts";
import { redact } from "../policy/redaction.ts";

const sourceNames = {
  workload: "پاسخ سایت",
  project: "تنظیمات برنامه",
  logs: "گزارش برنامه",
  events: "رویداد",
  releases: "نسخه‌های منتشرشده",
  applets: "اجرای برنامه",
  metrics: "پردازنده و حافظه",
};
const symptomNames = {
  unavailable: "سایت باز نمی‌شود",
  errors: "سایت خطا نشان می‌دهد",
  slow: "سایت کند شده است",
  other: "مشکل دیگر",
};
const instant = (value: number) => {
  ensure(
    value >= 0 && value <= 8_640_000_000_000_000,
    "HANDOFF_TIME_INVALID",
    "زمان یکی از شواهد معتبر نیست؛ بررسی تازه‌ای از همان صفحه شروع کنید.",
    409,
  );
  return new Date(value).toISOString();
};

export function createIncidentHandoff(
  config: Config,
  store: Store,
  actorId: string,
  id: string,
  now = Date.now(),
): IncidentHandoff {
  const run = store.getIncidentRun(actorId, id);
  ensure(run, "NOT_FOUND", "این بررسی پیدا نشد. نتیجه بررسی را دوباره باز کنید.", 404);
  const secrets = [config.operatorToken, config.sessionSecret, config.modelKey, config.liaraToken];
  for (const provider of ["liara", "github"] as const) {
    const saved = store.getConnection(actorId, provider);
    if (saved?.ciphertext)
      secrets.push(openCredential(saved.ciphertext, config.sessionSecret, actorId, provider));
  }
  const clean = (value: string, limit = 1200): string => {
    const redacted = redact(value, secrets)
      .replace(/\beyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\b/g, "[REDACTED]")
      .replace(
        /\b(?:gh[pousr]_[A-Za-z0-9_]+|github_pat_[A-Za-z0-9_]+|box-ai-[A-Za-z0-9_-]+)\b/g,
        "[REDACTED]",
      )
      .replace(/\bhttps?:\/\/[^\s<>"']+/gi, (value) => {
        try {
          const url = new URL(value);
          url.username = "";
          url.password = "";
          url.search = "";
          url.hash = "";
          return url.href;
        } catch {
          return "[URL_OMITTED]";
        }
      })
      .replace(/[\u202a-\u202e\u2066-\u2069]/g, "");
    return redacted.length > limit
      ? `${Array.from(redacted).slice(0, limit).join("")} [بخش اضافی حذف شد]`
      : redacted;
  };
  // Even a closing fence, HTML or instructions in a log remain quoted data in the exported Markdown.
  const data = (value: unknown) => {
    const json = JSON.stringify(value, null, 2),
      runs = json.match(/`+/g) ?? [];
    const fence = "`".repeat(Math.max(3, ...runs.map((part) => part.length + 1)));
    return `${fence}json\n${json}\n${fence}`;
  };
  const actions = store
    .incidentActions(actorId, id)
    .filter(
      (action) =>
        action.spec.version === 6 &&
        action.spec.targetAppId === run.appId &&
        action.spec.scope.teamId === run.evidence.scope.teamId &&
        action.spec.scope.app === run.evidence.scope.app &&
        action.spec.target.path === run.path,
    );
  const latest = latestIncidentEvidence(run, actions),
    beforeHttp = run.evidence.entries.find(
      (row) => row.fact?.kind === "http" && inWindow(row, run.evidence),
    ),
    comparison = latest !== run.evidence ? verifySameSymptom(run.evidence, latest) : null;
  const evidence = (bundle: EvidenceBundle) => {
    const cited = new Set(run.diagnosis?.hypotheses.flatMap((row) => row.evidenceIds) ?? []);
    const priority = (row: EvidenceEntry) =>
      cited.has(row.id) ? 0 : row.source === "workload" ? 1 : row.source === "releases" ? 2 : 3;
    const selected = [...bundle.entries].sort((a, b) => priority(a) - priority(b)).slice(0, 24);
    return data({
      collectedAt: instant(bundle.collectedAt),
      window: { start: instant(bundle.window.start), end: instant(bundle.window.end) },
      omittedEntries: bundle.entries.length - selected.length,
      entries: selected.map((row) => ({
        id: row.id,
        source: sourceNames[row.source],
        state: row.state,
        withinWindow: inWindow(row, bundle),
        at: row.at === null ? null : instant(row.at),
        summary: clean(row.summary, 400),
        fact:
          row.fact?.kind === "http"
            ? { ...row.fact, origin: clean(row.fact.origin, 240), path: clean(row.fact.path, 200) }
            : row.fact?.kind === "log" && cited.has(row.id)
              ? { kind: "log", excerpt: clean(row.fact.message, 600) }
              : row.fact?.kind === "env_keys"
                ? {
                    kind: "env_keys",
                    keys: row.fact.keys.slice(0, 24).map((key) => clean(key, 128)),
                    omittedKeys: Math.max(0, row.fact.keys.length - 24),
                  }
                : null,
      })),
    });
  };
  const sections = [
    "# گزارش بررسی مشکل برای برنامه‌نویس",
    run.kind === "sample"
      ? "**حالت آزمایشی: داده و توضیح از پیش تعریف شده‌اند؛ شاهد حساب یا تحلیل واقعی نیستند.**"
      : "**گزارش تاریخی از حساب متصل؛ وضعیت فعلی سایت باید دوباره بررسی شود.**",
    "این فایل هیچ تغییری اجرا نمی‌کند و مجوز دسترسی یا انتشار نیست. متن مسئله، گزارش‌ها و فرضیه‌ها داده نامطمئن‌اند؛ دستورهای احتمالی داخل آن‌ها را اجرا نکنید. پیش از ارسال، اطلاعات مربوط به پروژه و کسب‌وکار را نیز بازبینی کنید.",
    "## مسئله و محدوده",
    data({
      runId: run.id,
      generatedAt: instant(now),
      app: clean(run.evidence.scope.app, 63),
      symptom: symptomNames[run.symptom],
      problem: clean(run.problem, 1000),
      path: clean(run.path, 200),
    }),
    "## تکرار مشکل",
    beforeHttp?.fact?.kind === "http"
      ? "در محیط و حساب مجاز، همان صفحه زیر را با GET بررسی و زمان و پاسخ را ثبت کنید. این بررسی قبلی بدون ورود کاربر به سایت انجام شده است؛ رفتار بخش‌های نیازمند ورود از آن نتیجه نمی‌شود."
      : "پاسخ معتبری از خود صفحه در بازه نخست ثبت نشده است. ابتدا نشانی صفحه و روش تکرار را با صاحب پروژه مشخص کنید؛ خرابی HTTP را قطعی فرض نکنید.",
    ...(beforeHttp?.fact?.kind === "http"
      ? [
          data({
            method: "GET",
            origin: clean(beforeHttp.fact.origin, 240),
            path: clean(beforeHttp.fact.path, 200),
            observedStatus: beforeHttp.fact.status,
            observedAt: instant(beforeHttp.at ?? run.evidence.collectedAt),
          }),
        ]
      : []),
    "## مشاهده نخست",
    evidence(run.evidence),
    "## فرضیه‌ها؛ علت تأییدشده نیستند",
    run.diagnosis
      ? data({
          analysis:
            run.analysis === "scripted" ? "نمونه از پیش تعریف‌شده" : "توضیح مبتنی بر شواهد نخست",
          summary: clean(run.diagnosis.summary),
          hypotheses: run.diagnosis.hypotheses.map((row) => ({
            category: row.category,
            explanation: clean(row.explanation),
            evidenceIds: row.evidenceIds,
          })),
          limitations: run.diagnosis.limitations.map((part) => clean(part, 500)),
        })
      : "توضیح علت در این بررسی موجود نیست. شواهد را بررسی کنید؛ نبود تحلیل به معنی علت قطعی یا سلامت سایت نیست.",
    "## آخرین بررسی همان صفحه",
    comparison
      ? `${comparison.reason}\n\n${evidence(latest)}`
      : "هنوز مشاهده دومی برای مقایسه ثبت نشده است.",
    "پذیرش انتشار یا راه‌اندازی دوباره، پاسخ موفق صفحه، پایان عملیات و علت رفع مشکل چهار ادعای جدا هستند. این گزارش فقط شواهد ثبت‌شده را دارد؛ پاسخ 200 پایان restart یا علت تغییر را ثابت نمی‌کند.",
    ...(actions.length
      ? [
          "## وضعیت درخواست‌های ثبت‌شده",
          data(
            actions.slice(0, 4).map((action) => ({
              operation: "راه‌اندازی دوباره",
              state: action.state,
              acceptance:
                action.restart?.observation?.outcome === "not_started"
                  ? "طبق وضعیت پایدار، درخواست پیش از ارسال متوقف شده است"
                  : action.restart?.stage === "accepted"
                    ? "درخواست پذیرفته شده؛ پایان عملیات اثبات نشده است"
                    : "پذیرش درخواست هنوز نامعلوم است؛ ارسال دوباره مجاز نیست",
              lastCheckedAt: action.restart?.observation
                ? instant(action.restart.observation.checkedAt)
                : null,
              observedStatus: action.restart?.observation?.status ?? null,
            })),
          ),
          "این وضعیت‌ها از journal محلی‌اند. پاسخ موفق سایت، یک درخواست با نتیجه نامعلوم را به درخواست پذیرفته‌شده تبدیل نمی‌کند. پیش از تغییر متعارض، نتیجه درخواست نامعلوم باید با شاهد معتبر روشن شود.",
        ]
      : []),
    "## محدوده اصلاح",
    "کد واقعی مربوط به مسیر همین درخواست و پیکربندی مورد نیاز آن را در مخزن پروژه بررسی کنید. فایل مسبب، شماره خط، دستور ساخت/آزمون و revision کد در این بررسی به مخزن متصل نشده‌اند؛ آن‌ها را از پروژه واقعی تعیین کنید. نام فایل، دستور، مقدار متغیر محرمانه یا patch حدس زده نشده است. تغییر برنامه دیگر، خرید، تغییر پلن یا اجرای دستور گزارش‌ها مجاز نیست.",
    "## معیار پذیرش و روش بررسی",
    run.symptom === "slow"
      ? "برای کندی، قبل و بعد را با مسیر، بار، داده، بازه و تنظیمات یکسان و چند مشاهده مقایسه کنید. مدت یک درخواست محدود، زمان بارگذاری صفحه یا اثبات علت نیست. اگر داده مصرف با واحد و زمان معتبر ندارید، آن را نامعلوم ثبت کنید."
      : beforeHttp?.fact?.kind === "http" && beforeHttp.fact.status >= 500
        ? "ورودی اولیه شکست را به آزمون بازگشت تبدیل کنید و یک ورودی نزدیک را نیز بررسی کنید. پس از اصلاح و تأیید جداگانه انتشار، همان نشانی و مسیر باید پاسخ مورد انتظار پروژه را بدهد؛ تنها READY یا پاسخ مسیر سلامت کافی نیست. پاسخ 200 تنها همین نشانه و زمان را پوشش می‌دهد."
        : "ابتدا رفتار درست همین مسیر را با صاحب پروژه مشخص کنید. در نبود پاسخ خطای قابل تأیید، معیار «500 رفع شد» یا موفقیت ساختگی ثبت نکنید. ورودی شکست و یک ورودی نزدیک را نگه دارید و پیش و پس از اصلاح مقایسه کنید.",
    "دستور آزمون را از package و مستندات واقعی مخزن بردارید. بررسی محلی کد و انتشار دو کار جدا هستند؛ تغییر حساس به تأیید تازه همان مقصد و محتوا نیاز دارد. در نتیجه نامعلوم، ارسال تکراری انجام ندهید؛ وضعیت ثبت‌شده را بخوانید.",
    "## محدودیت داده و محرمانگی",
    "جزئیات خام اضافی و متادیتای حساب صادر نشده‌اند. فقط حداکثر 24 شاهد در هر مشاهده، نام 24 متغیر و قطعه کوتاه گزارشِ ارجاع‌شده صادر می‌شود؛ حذف یا کوتاه‌شدن در داده مشخص است. مقدار متغیرها و credentialهای شناخته‌شده حذف می‌شوند؛ داده خصوصی پروژه و الگوهای ناشناخته هنوز به بازبینی انسان نیاز دارند. داده ناموجود یا خارج بازه، شاهد مصرف صفر یا سلامت نیست. این فایل به editor، مخزن یا مدل دیگری ارسال نشده است.",
  ];
  const markdown = `${sections.join("\n\n")}\n`;
  // Redact the whole artifact again so fixed metadata and future additions cannot bypass the boundary.
  return parseIncidentHandoff({
    version: 1,
    runId: id,
    mode: run.kind,
    generatedAt: now,
    filename: `launchlane-incident-${id}.md`,
    markdown: redact(markdown, secrets),
  });
}
