import type { Config } from "../config.ts";
import { AppError, ensure } from "../errors.ts";
import { identifier, object, string } from "../../contracts/validation.ts";
import type { RunBudget } from "../policy/budget.ts";
import { fingerprint } from "../policy/action.ts";
import { abortable, boundedJson, httpFailure, transport, type Transport } from "../providers/http.ts";
import { providerObjectId, type ProvisionReadback } from "../../contracts/provision.ts";
import { containsCredential } from "../policy/redaction.ts";

export type PaaSOffer = {
  planId: string;
  bundleId: string;
  region: string;
  hourlyHundredthsToman: number | null;
  resources: { memoryAmount: number | null; cpuAmount: number | null; units: "unverified_provider_amounts"; measuredRequirement: false };
};
export type PaaSCatalog = {
  contract: "liara-paas-catalog-v1";
  accountId: string;
  teamId: string;
  observedAt: number;
  fingerprint: string;
  balanceToman: number;
  offers: PaaSOffer[];
  unavailablePlanIds: string[];
  pricing: { currency: "toman"; period: "hour"; source: "https://liara.ir/pricing/"; extras: "tax_traffic_storage_not_included" };
};
export function priceHundredths(value: unknown): number | null {
  if (value === undefined || value === null) return null;
  ensure(typeof value === "number" && Number.isFinite(value) && value >= 0,
    "CATALOG_INVALID", "قیمت catalog قابل تأیید نیست.", 502);
  const match = /^(\d{1,12})(?:\.(\d{1,2}))?$/.exec(String(value));
  ensure(match?.[1], "CATALOG_INVALID", "دقت یا واحد قیمت catalog با قرارداد پشتیبانی‌شده برابر نیست.", 502);
  const result = Number(match[1]) * 100 + Number((match[2] ?? "").padEnd(2, "0"));
  ensure(Number.isSafeInteger(result), "CATALOG_INVALID", "قیمت خارج از محدوده است.", 502);
  return result;
}
const amount = (value: unknown): number | null => typeof value === "number" && Number.isFinite(value) && value > 0 ? value : null;
const dimension = (value: unknown): number | null => value === undefined || value === null ? null : amount(object(value).amount);
function available(row: Record<string, unknown>): boolean {
  ensure(typeof row.available === "boolean", "CATALOG_INVALID", "موجودبودن پلن مشخص نیست.", 502);
  return row.available;
}
export function parsePaaSCatalog(value: unknown, expected: { accountId: string; teamId: string }, observedAt = Date.now()): PaaSCatalog {
  const root = object(value), user = object(root.user), team = object(root.team), plans = object(root.plans),
    projects = object(plans.projects), bundles = object(plans.projectBundlePlans);
  ensure(user._id === expected.accountId && team._id === expected.teamId,
    "SCOPE_DENIED", "اطلاعات catalog متعلق به حساب و تیم انتخاب‌شده نیست.", 403);
  const balance = team.balance;
  ensure(typeof balance === "number" && Number.isFinite(balance) && Math.abs(balance) < 1e15,
    "CATALOG_INVALID", "اعتبار حساب قابل تأیید نیست.", 502);
  ensure(Object.keys(projects).length <= 200 && Object.keys(bundles).length <= 200,
    "CATALOG_INVALID", "catalog از سقف بررسی بزرگ‌تر است.", 502);
  const offers: PaaSOffer[] = [], unavailablePlanIds: string[] = [];
  for (const [planId, raw] of Object.entries(projects)) {
    identifier(planId);
    const plan = object(raw);
    if (!available(plan)) { unavailablePlanIds.push(planId); continue; }
    const regional = bundles[planId];
    if (regional === undefined) { unavailablePlanIds.push(planId); continue; }
    const choices = object(regional);
    ensure(Object.keys(choices).length <= 12, "CATALOG_INVALID", "گزینه‌های پلن معتبر نیستند.", 502);
    for (const [bundleId, rawBundle] of Object.entries(choices)) {
      identifier(bundleId);
      const bundle = object(rawBundle);
      if (!available(bundle)) continue;
      const resourcePrice = priceHundredths(plan.price), bundlePrice = priceHundredths(bundle.price);
      offers.push({ planId, bundleId, region: plan.region === undefined ? "unknown" : string(plan.region, 40),
        hourlyHundredthsToman: resourcePrice === null || bundlePrice === null ? null : resourcePrice + bundlePrice,
        resources: { memoryAmount: dimension(plan.RAM), cpuAmount: dimension(plan.CPU),
          units: "unverified_provider_amounts", measuredRequirement: false } });
    }
  }
  ensure(offers.length <= 500, "CATALOG_INVALID", "ترکیب‌های catalog از سقف بررسی بزرگ‌ترند.", 502);
  unavailablePlanIds.sort();
  offers.sort((a, b) => (a.hourlyHundredthsToman ?? Number.MAX_SAFE_INTEGER) - (b.hourlyHundredthsToman ?? Number.MAX_SAFE_INTEGER) || a.planId.localeCompare(b.planId) || a.bundleId.localeCompare(b.bundleId));
  const snapshot = { offers, unavailablePlanIds };
  return { contract: "liara-paas-catalog-v1", ...expected, observedAt, fingerprint: fingerprint({ ...expected, ...snapshot }),
    balanceToman: balance, ...snapshot, pricing: { currency: "toman", period: "hour", source: "https://liara.ir/pricing/", extras: "tax_traffic_storage_not_included" } };
}
export function quotePaaSOffer(catalog: PaaSCatalog, planId: string, bundleId: string, now = Date.now()) {
  ensure(catalog.observedAt <= now && now - catalog.observedAt < 600000,
    "CATALOG_STALE", "قیمت‌ها باید دوباره از حساب خوانده شوند.", 409);
  const selected = catalog.offers.find((offer) => offer.planId === planId && offer.bundleId === bundleId);
  ensure(selected, "PLAN_UNAVAILABLE", "این ترکیب پلن در حساب موجود نیست؛ گزینه تازه انتخاب کنید.", 409);
  ensure(selected.hourlyHundredthsToman !== null, "PRICE_UNAVAILABLE", "قیمت این ترکیب نامعلوم است؛ تصمیم هزینه ساخته نشد.", 409);
  const format = (value: number) => `${Math.floor(value / 100)}.${String(value % 100).padStart(2, "0")}`;
  return { contract: catalog.contract, catalogFingerprint: catalog.fingerprint,
    accountId: catalog.accountId, teamId: catalog.teamId, observedAt: catalog.observedAt, expiresAt: catalog.observedAt + 600000,
    selected: { ...selected, hourlyHundredthsToman: selected.hourlyHundredthsToman }, hourlyToman: format(selected.hourlyHundredthsToman), pricing: catalog.pricing,
    creditCoversOneBaseHour: catalog.balanceToman >= selected.hourlyHundredthsToman / 100,
    capacity: "unmeasured" as const,
    alternatives: catalog.offers.filter((offer) => offer !== selected && offer.hourlyHundredthsToman !== null && offer.region === selected.region).slice(0, 3),
    remoteChanges: false as const };
}

export class LiaraAccountClient {
  readonly config: Config;
  readonly accountId: string;
  readonly send: Transport;
  constructor(config: Config, accountId: string, send: Transport = transport) {
    this.config = config; this.accountId = accountId; this.send = send;
  }
  private async read<T>(path: string, budget: RunBudget, signal: AbortSignal, parse: (value: unknown) => T, missing = false): Promise<T> {
    ensure(this.config.enableLiveLiara, "LIVE_LIARA_DISABLED", "خواندن واقعی لیارا در این نصب خاموش است.", 403);
    ensure(this.config.liaraToken && this.config.teamId && this.config.liaraBaseUrl === "https://api.liara.ir",
      "LIARA_UNCONFIGURED", "حساب و تیم مجاز مشخص نیستند.", 403);
    budget.take("tool", signal);
    const bounded = budget.signal(signal), url = new URL(path, this.config.liaraBaseUrl);
    url.searchParams.set("teamID", this.config.teamId);
    try {
      return await abortable(async () => {
        const response = await this.send(url.href, { method: "GET", redirect: "error", cache: "no-store", signal: bounded,
          headers: { Authorization: `Bearer ${this.config.liaraToken}`, Accept: "application/json" } });
        if (response.status === 404 && missing) { await response.body?.cancel(); return parse(null); }
        if (!response.ok) { await response.body?.cancel(); throw httpFailure(response.status); }
        const result = parse(await boundedJson(response, 1024 * 1024));
        ensure(!containsCredential(JSON.stringify(result) ?? "", [this.config.liaraToken, this.config.modelKey, this.config.operatorToken, this.config.sessionSecret].filter(Boolean)),
          "SENSITIVE_RESPONSE", "پاسخ حساب شامل مقدار محرمانه است و نمایش داده نشد.", 502);
        ensure(!bounded.aborted, "CANCELLED", "پاسخ پس از مهلت دریافت شد.", 409);
        return result;
      }, bounded);
    } catch (error) {
      if (bounded.aborted) throw new AppError(signal.aborted ? "CANCELLED" : "BUDGET_EXHAUSTED", "خواندن catalog کامل نشد.", 409);
      if (error instanceof AppError && error.code !== "INVALID_INPUT") throw error;
      throw new AppError(error instanceof AppError ? "CATALOG_INVALID" : "PROVIDER_TRANSPORT", "catalog حساب قابل دریافت یا تأیید نیست.", 502);
    }
  }
  async catalog(budget: RunBudget, signal: AbortSignal): Promise<PaaSCatalog> {
    return this.read("/v1/me", budget, signal, (value) => parsePaaSCatalog(value, { accountId: this.accountId, teamId: this.config.teamId }));
  }
  async identity(budget: RunBudget, signal: AbortSignal): Promise<void> {
    return this.read("/v1/me", budget, signal, (value) => {
    const row = object(value);
    ensure(object(row.user)._id === this.accountId && object(row.team)._id === this.config.teamId,
      "SCOPE_DENIED", "حساب یا تیم پاسخ با مقصد برابر نیست.", 403);
    });
  }
  async networks(budget: RunBudget, signal: AbortSignal): Promise<{id: string; name: string}[]> {
    return this.read("/v1/networks", budget, signal, (value) => {
    const rows = object(value).networks;
    ensure(Array.isArray(rows) && rows.length <= 100, "UPSTREAM_INVALID", "فهرست شبکه‌های حساب کامل یا قابل تأیید نیست.", 502);
    const networks = rows.map((value: unknown) => {
      const row = object(value);
      return { id: providerObjectId(row._id), name: string(row.name, 160) };
    });
    ensure(new Set(networks.map((network) => network.id)).size === networks.length,
      "UPSTREAM_INVALID", "فهرست شبکه‌ها هویت تکراری دارد.", 502);
    return networks;
    });
  }
  async projectMetadata(app: string, budget: RunBudget, signal: AbortSignal): Promise<ProvisionReadback | null> {
    identifier(app);
    ensure(/^[a-z0-9][a-z0-9-]{0,62}$/.test(app) && (!this.config.apps.length || this.config.apps.includes(app)),
      "SCOPE_DENIED", "برنامه در محدوده مجاز نیست.", 403);
    return this.read(`/v1/projects/${encodeURIComponent(app)}`, budget, signal, (raw) => {
    if (raw === null) return null;
    const row = object(object(raw).project);
    ensure(row.project_id === app && typeof row.readOnlyRootFilesystem === "boolean",
      "UPSTREAM_INVALID", "هویت یا تنظیمات مقصد قابل تأیید نیست.", 502);
    return { scope: { teamId: this.config.teamId, app }, id: providerObjectId(row._id), platform: string(row.type, 64),
      planId: identifier(row.planID), bundleId: identifier(row.bundlePlanID), networkId: providerObjectId(object(row.network)._id),
      readOnlyRootFilesystem: row.readOnlyRootFilesystem, observedAt: Date.now(),
      ...(typeof row.defaultSubdomain === "boolean" ? { defaultSubdomain: row.defaultSubdomain } : {}) };
    }, true);
  }
}
