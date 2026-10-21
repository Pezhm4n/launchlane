import type { Capabilities } from "../../contracts/domain.ts";
import type { Config } from "../config.ts";

export function capabilities(config: Config): Capabilities {
  return {
    evidence: "local",
    workspace: config.workspaceRoot
      ? {
          state: "available",
          reason: "بررسی محدود و فقط خواندنی پروژه محلی فعال است.",
          nextStep: "یک پوشه زیر workspace مجاز انتخاب کنید.",
        }
      : {
          state: "unavailable",
          reason: "پوشه مجاز پروژه‌ها تنظیم نشده است.",
          nextStep: "workspace را در تنظیمات محلی مشخص کنید و server را دوباره اجرا کنید.",
        },
    liara: {
      state: config.liaraToken ? "unverified" : "unavailable",
      reason: config.liaraToken
        ? "توکن تنظیم شده؛ تطبیق زنده تیم و برنامه هنوز انجام نشده است."
        : "توکن PaaS لیارا هنوز تنظیم نشده است.",
      nextStep: "پس از آماده‌شدن دسترسی، تیم و برنامه را با یک خواندن محدود تطبیق دهید.",
    },
    model: {
      state: "unavailable",
      reason: !config.enableLiveModel
        ? "فراخوانی مدل در این نصب خاموش است."
        : !config.modelId
          ? "مدل فعال انتخاب نشده است."
          : "سازگاری مدل انتخابی با BoxAPI هنوز تأیید نشده است.",
      nextStep: "پس از اعلام آمادگی و بودجه، یک آزمایش کوچک سازگاری اجرا شود.",
    },
    mutations: {
      state: "unavailable",
      reason: !config.enableMutations
        ? "انتشار و تغییر زیرساخت در این نسخه غیرفعال است."
        : "adapter نوشتن زنده هنوز تأیید نشده است.",
      nextStep:
        "فعلاً پروژه و فهرست فایل‌ها را بررسی و پیشنهاد را آماده کنید؛ تأیید به‌تنهایی چیزی را منتشر نمی‌کند.",
    },
    scope: { teamId: config.teamId || null, apps: config.apps },
  };
}
