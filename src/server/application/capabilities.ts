import type { Capabilities } from "../../contracts/domain.ts";
import type { Config } from "../config.ts";
import type { ConnectionView } from "../../contracts/connections.ts";

export function capabilities(config: Config, liara?: ConnectionView | null): Capabilities {
  const connected = liara?.status === "connected" && liara.teamId === config.teamId;
  return {
    evidence: "local",
    workspace: config.workspaceRoot
      ? {
          state: "available",
          reason: "بررسی محدود و فقط خواندنی پروژه محلی فعال است.",
          nextStep: "پوشه پروژه را انتخاب کنید؛ فایل‌ها فقط روی همین رایانه بررسی می‌شوند.",
        }
      : {
          state: "unavailable",
          reason: "پوشه مجاز پروژه‌ها تنظیم نشده است.",
          nextStep: "پروژه را از GitHub انتخاب کنید یا محدوده پوشه‌های این نصب را تنظیم کنید.",
        },
    liara: {
      state: connected ? "available" : config.liaraToken ? "unverified" : "unavailable",
      reason: connected
        ? `حساب ${liara.displayName} و تیم ${liara.teamName} بررسی شده‌اند.`
        : liara?.status === "reauth_required"
          ? "اتصال قبلی نیاز به بررسی دوباره دارد."
          : config.liaraToken
            ? "اطلاعات اتصال این نصب آماده بررسی است."
            : "حساب لیارا هنوز متصل نشده است.",
      nextStep: connected
        ? liara.selectedApp
          ? "برنامه انتخاب‌شده مقصد عملیات بعدی است؛ هر تغییر به تأیید جداگانه نیاز دارد."
          : "برنامه مقصد را از فهرست همین تیم انتخاب کنید."
        : "از اتصال حساب لیارا وارد شوید؛ بررسی محلی پروژه به این اتصال وابسته نیست.",
    },
    model: {
      state:
        config.enableLiveModel && config.modelKey && config.modelId ? "unverified" : "unavailable",
      reason: !config.enableLiveModel
        ? "توضیح خودکار علت مشکل در این نصب فعال نیست."
        : !config.modelId || !config.modelKey
          ? "توضیح خودکار علت مشکل هنوز آماده نیست."
          : "توضیح علت با شواهد همین برنامه قابل درخواست است؛ نتیجه یک فرضیه قابل بررسی است.",
      nextStep: "می‌توانید گزارش‌های در دسترس را جمع‌آوری و شواهد را بررسی کنید.",
    },
    mutations: {
      state:
        config.enableMutations && config.enableLiveLiara && connected
          ? "unverified"
          : "unavailable",
      reason: !config.enableMutations || !config.enableLiveLiara
        ? "انتشار و تغییر زیرساخت در این نصب غیرفعال است."
        : !connected
          ? "برای انتشار، حساب لیارا و برنامه مقصد را متصل و بررسی کنید."
          : !liara.selectedApp
            ? "برنامه مقصد را از حساب متصل انتخاب کنید."
            : "انتشار نسخه تازه روی برنامه انتخاب‌شده به پیشنهاد مشخص و تأیید شما نیاز دارد.",
      nextStep:
        "پیشنهاد را بررسی کنید؛ ثبت تأیید و آغاز انتشار دو مرحله جدا هستند.",
    },
    scope: {
      teamId: config.teamId || null,
      apps: connected
        ? liara.selectedApp && (!config.apps.length || config.apps.includes(liara.selectedApp))
          ? [liara.selectedApp]
          : []
        : config.apps,
    },
  };
}
