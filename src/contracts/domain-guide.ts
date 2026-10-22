import { ensure } from "../server/errors.ts";
import { exactKeys, integer, object, string } from "./validation.ts";

export const domainDocumentation = {
  checkedOn: "2026-10-22",
  connect: "https://docs.liara.ir/paas/domains/add-domain/",
  subdomain: "https://docs.liara.ir/paas/domains/add-subdomains/",
  dns: "https://docs.liara.ir/dns-management-system/quick-setup/",
  records: "https://docs.liara.ir/dns-management-system/how-tos/add-records/",
  certificate: "https://docs.liara.ir/paas/domains/enable-ssl/",
  www: "https://docs.liara.ir/paas/domains/add-www-subdomain/",
  supportedTlds: "https://docs.liara.ir/paas/domains/supported-tlds/",
  console: "https://console.liara.ir/",
  irnic: "https://nic.ir/",
} as const;

export type DomainDns = "existing" | "liara";
export type DomainTarget = Readonly<{ teamId: string; appId: string; app: string }>;
export type DomainGuideRequest = Readonly<{
  hostname: string;
  dns: DomainDns;
  target: DomainTarget | null;
}>;
export type DomainGuide = Readonly<{
  version: 1;
  hostname: string;
  dns: DomainDns;
  target: (DomainTarget & { teamName: string; connectionCheckedAt: number }) | null;
  connection: "not_connected" | "reauth_required" | "app_required" | "selected";
  preparedAt: number;
  verification: "not_checked";
  documentationCheckedOn: typeof domainDocumentation.checkedOn;
}>;

function parseDns(value: unknown): DomainDns {
  ensure(
    value === "existing" || value === "liara",
    "INVALID_INPUT",
    "روش مدیریت دامنه را انتخاب کنید.",
  );
  return value;
}

export function parseDomainTarget(value: unknown): DomainTarget {
  const row = object(value);
  exactKeys(row, ["teamId", "appId", "app"]);
  const teamId = string(row.teamId, 24),
    appId = string(row.appId, 128),
    app = string(row.app, 63);
  ensure(
    /^[a-f0-9]{24}$/.test(teamId) && /^[a-z0-9][a-z0-9-]{0,62}$/.test(app),
    "INVALID_INPUT",
    "مقصد دامنه معتبر نیست.",
  );
  return { teamId, appId, app };
}

export function parseDomainGuideRequest(value: unknown): DomainGuideRequest {
  const row = object(value);
  exactKeys(row, ["hostname", "dns", "target"]);
  return {
    hostname: typeof row.hostname === "string" ? row.hostname : string(row.hostname, 512),
    dns: parseDns(row.dns),
    target: row.target === null ? null : parseDomainTarget(row.target),
  };
}

export function isDomainHostname(value: string): boolean {
  const labels = value.split(".");
  return (
    value.length <= 253 &&
    labels.length >= 2 &&
    labels.every((label) => /^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?$/.test(label)) &&
    !/^\d+$/.test(labels.at(-1) || "") &&
    ![
      "localhost",
      "local",
      "internal",
      "lan",
      "home",
      "invalid",
      "test",
      "example",
      "onion",
    ].includes(labels.at(-1) || "")
  );
}

export function parseDomainGuide(value: unknown): DomainGuide {
  const row = object(value);
  exactKeys(row, [
    "version",
    "hostname",
    "dns",
    "target",
    "connection",
    "preparedAt",
    "verification",
    "documentationCheckedOn",
  ]);
  ensure(
    row.version === 1 &&
      row.verification === "not_checked" &&
      row.documentationCheckedOn === domainDocumentation.checkedOn,
    "DOMAIN_GUIDE_INVALID",
    "پاسخ راهنمای دامنه معتبر نیست.",
  );
  const hostname = string(row.hostname, 253);
  ensure(isDomainHostname(hostname), "DOMAIN_GUIDE_INVALID", "نام دامنه راهنما معتبر نیست.");
  ensure(
    row.connection === "not_connected" ||
      row.connection === "reauth_required" ||
      row.connection === "app_required" ||
      row.connection === "selected",
    "DOMAIN_GUIDE_INVALID",
    "وضعیت مقصد راهنما معتبر نیست.",
  );
  let target: DomainGuide["target"] = null;
  if (row.target !== null) {
    const raw = object(row.target);
    exactKeys(raw, ["teamId", "appId", "app", "teamName", "connectionCheckedAt"]);
    target = {
      ...parseDomainTarget({ teamId: raw.teamId, appId: raw.appId, app: raw.app }),
      teamName: string(raw.teamName, 160),
      connectionCheckedAt: integer(raw.connectionCheckedAt, 0, Number.MAX_SAFE_INTEGER),
    };
  }
  ensure(
    (row.connection === "selected") === (target !== null),
    "DOMAIN_GUIDE_INVALID",
    "مقصد راهنما با وضعیت اتصال یکسان نیست.",
  );
  return {
    version: 1,
    hostname,
    dns: parseDns(row.dns),
    target,
    connection: row.connection,
    preparedAt: integer(row.preparedAt, 0, Number.MAX_SAFE_INTEGER),
    verification: "not_checked",
    documentationCheckedOn: domainDocumentation.checkedOn,
  };
}
