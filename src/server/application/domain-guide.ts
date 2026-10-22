import { domainToASCII } from "node:url";
import {
  domainDocumentation,
  isDomainHostname,
  parseDomainGuide,
  parseDomainGuideRequest,
  type DomainGuide,
  type DomainTarget,
} from "../../contracts/domain-guide.ts";
import type { Config } from "../config.ts";
import { ensure } from "../errors.ts";
import type { Store } from "../persistence/store.ts";

export function normalizeDomainHostname(value: string): string {
  const input = value.trim().replace(/\.$/, "");
  ensure(
    input.length > 0 &&
      input.length <= 512 &&
      !/[\s/\\:?#@%*]/u.test(input) &&
      !Array.from(value).some((character) => {
        const code = character.codePointAt(0) ?? 0;
        return (
          code < 32 ||
          code === 127 ||
          (code >= 0x200b && code <= 0x200f) ||
          (code >= 0x202a && code <= 0x202e) ||
          (code >= 0x2066 && code <= 0x2069)
        );
      }),
    "DOMAIN_NAME_INVALID",
    "فقط نام دامنه یا زیردامنه را وارد کنید؛ مثلاً example.ir. نشانی صفحه، پورت یا نویسه پنهان قابل استفاده نیست.",
  );
  const hostname = domainToASCII(input).toLowerCase();
  ensure(
    isDomainHostname(hostname),
    "DOMAIN_NAME_INVALID",
    "نام دامنه معتبر نیست. نام کامل را بدون فاصله وارد کنید؛ مثلاً example.ir یا app.example.ir.",
  );
  ensure(
    !["gq", "cf", "ga", "ml", "tk"].includes(hostname.split(".").at(-1) || ""),
    "DOMAIN_TLD_UNSUPPORTED",
    "طبق مستندات فعلی لیارا، این پسوند پشتیبانی نمی‌شود. دامنه دیگری انتخاب کنید یا فهرست پسوندهای پشتیبانی‌شده را بررسی کنید.",
  );
  return hostname;
}

function sameTarget(left: DomainTarget | null, right: DomainTarget | null): boolean {
  return left?.teamId === right?.teamId && left?.appId === right?.appId && left?.app === right?.app;
}

export function createDomainGuide(
  config: Config,
  store: Store,
  actorId: string,
  value: unknown,
  now = Date.now(),
): DomainGuide {
  const input = parseDomainGuideRequest(value),
    hostname = normalizeDomainHostname(input.hostname);
  const view = store.getConnection(actorId, "liara")?.view;
  let connection: DomainGuide["connection"] = "not_connected",
    target: DomainGuide["target"] = null;
  if (view) {
    ensure(
      view.teamId === config.teamId,
      "LIARA_TEAM_MISMATCH",
      "تیم اتصال تغییر کرده است. از حساب‌ها، اتصال لیارا را دوباره بررسی کنید.",
      403,
    );
    if (view.status === "reauth_required") connection = "reauth_required";
    else if (!view.selectedApp) connection = "app_required";
    else {
      const app = view.apps.find((candidate) => candidate.name === view.selectedApp);
      ensure(
        app && (!config.apps.length || config.apps.includes(app.name)),
        "LIARA_APP_REQUIRED",
        "این برنامه در محدوده مجاز نیست. از حساب‌ها، فهرست برنامه‌ها را تازه و مقصد را انتخاب کنید.",
        403,
      );
      target = {
        teamId: config.teamId,
        teamName: view.teamName || "تیم متصل",
        appId: app.id,
        app: app.name,
        connectionCheckedAt: view.checkedAt,
      };
      connection = "selected";
    }
  }
  ensure(
    sameTarget(input.target, target),
    "DOMAIN_TARGET_CHANGED",
    "مقصد تغییر کرده است. از حساب‌ها، مقصد را بررسی و راهنما را دوباره آماده کنید.",
    409,
  );
  // A guide uses saved identity only; it must not grant probe access or imply DNS ownership.
  return parseDomainGuide({
    version: 1,
    hostname,
    dns: input.dns,
    target,
    connection,
    preparedAt: now,
    verification: "not_checked",
    documentationCheckedOn: domainDocumentation.checkedOn,
  });
}
