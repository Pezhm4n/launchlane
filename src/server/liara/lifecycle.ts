import type { LifecycleSpec } from "../../contracts/project-lifecycle.ts";
import { object, string, integer } from "../../contracts/validation.ts";
import type { Config } from "../config.ts";
import { AppError, ensure } from "../errors.ts";
import { authorizeScope } from "../policy/action.ts";
import type { RunBudget } from "../policy/budget.ts";
import { abortable, boundedJson, httpFailure, sendRead, transport, type Transport } from "../providers/http.ts";

export class LiaraLifecycleClient {
  readonly config: Config;
  readonly send: Transport;
  constructor(config: Config, send: Transport = transport) { this.config = config; this.send = send; }
  private url(spec: LifecycleSpec, suffix = "") {
    authorizeScope(spec.scope, this.config);
    ensure(this.config.enableLiveLiara && this.config.liaraToken && this.config.liaraBaseUrl === "https://api.liara.ir", "LIARA_UNCONFIGURED", "اتصال مجاز لیارا آماده نیست.", 503);
    const url = new URL(`/v1/projects/${spec.scope.app}${suffix}`, this.config.liaraBaseUrl); url.searchParams.set("teamID", spec.scope.teamId); return url.href;
  }
  async read(spec: LifecycleSpec, budget: RunBudget, signal: AbortSignal) {
    const bounded = budget.signal(signal), url = this.url(spec);
    return abortable(async () => {
      const response = await sendRead(this.send, url, { method: "GET", redirect: "error", cache: "no-store", signal: bounded, headers: { Authorization: `Bearer ${this.config.liaraToken}` } }, budget, bounded);
      if (response.status === 404) { void response.body?.cancel().catch(() => undefined); return null; }
      if (!response.ok) { void response.body?.cancel().catch(() => undefined); throw httpFailure(response.status); }
      const row = object(object(await boundedJson(response)).project);
      ensure(row._id === spec.targetAppId && row.project_id === spec.scope.app, "LIFECYCLE_TARGET_CHANGED", "هویت مقصد عوض شده است؛ عملیات ارسال نشد.", 409);
      return { planId: string(row.planID, 128), scale: integer(row.scale, 0, 1000) };
    }, bounded);
  }
  async empty(spec: LifecycleSpec, budget: RunBudget, signal: AbortSignal): Promise<boolean> {
    const bounded = budget.signal(signal);
    return abortable(async () => {
      const response = await sendRead(this.send, this.url(spec, "/applets"), { method: "GET", redirect: "error", cache: "no-store", signal: bounded, headers: { Authorization: `Bearer ${this.config.liaraToken}` } }, budget, bounded);
      if (response.status === 500 || response.status === 404) { void response.body?.cancel().catch(() => undefined); throw new AppError("LIFECYCLE_INSTANCES_UNAVAILABLE", "فهرست نمونه‌های اجرایی از لیارا قابل دریافت نیست.", 502); }
      if (!response.ok) { void response.body?.cancel().catch(() => undefined); throw httpFailure(response.status); }
      const rows = object(await boundedJson(response)).applets;
      ensure(Array.isArray(rows) && rows.length <= 100, "UPSTREAM_INVALID", "وضعیت نمونه‌های برنامه قابل بررسی نیست.", 502);
      return rows.length === 0;
    }, bounded);
  }
  async mutate(spec: LifecycleSpec, budget: RunBudget, signal: AbortSignal): Promise<void> {
    ensure(this.config.enableMutations, "MUTATIONS_DISABLED", "تغییر واقعی مقصد خاموش است.", 403);
    const url = this.url(spec, spec.operation === "stop_app" ? "/actions/scale" : ""), bounded = budget.signal(signal);
    budget.take("tool", bounded);
    const response = await abortable(() => this.send(url, { method: spec.operation === "stop_app" ? "POST" : "DELETE", redirect: "error", cache: "no-store", signal: bounded,
      headers: { Authorization: `Bearer ${this.config.liaraToken}`, "Content-Type": "application/json" }, ...(spec.operation === "stop_app" ? { body: JSON.stringify({ scale: 0 }) } : {}) }), bounded);
    void response.body?.cancel().catch(() => undefined);
    ensure((response.status === 200 || spec.operation === "delete_app" && response.status === 204) && !bounded.aborted, "UPSTREAM_UNCERTAIN", "نتیجهٔ درخواست قطعی نیست؛ فقط وضعیت خوانده می‌شود.", 409);
  }
}
