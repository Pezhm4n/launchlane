import type { EnvironmentSpec, EnvironmentVariable } from "../../contracts/environment.ts";
import { environmentVariables } from "../../contracts/environment.ts";
import { object, string } from "../../contracts/validation.ts";
import type { Config } from "../config.ts";
import { AppError, ensure } from "../errors.ts";
import { authorizeScope } from "../policy/action.ts";
import type { RunBudget } from "../policy/budget.ts";
import { abortable, boundedJson, httpFailure, sendRead, transport, type Transport } from "../providers/http.ts";

export class LiaraEnvironmentClient {
  readonly config: Config;
  readonly send: Transport;
  constructor(config: Config, send: Transport = transport) { this.config = config; this.send = send; }
  private url(spec: Pick<EnvironmentSpec, "scope">, write: boolean) {
    authorizeScope(spec.scope, this.config);
    ensure(this.config.enableLiveLiara && (!write || this.config.enableMutations), "MUTATIONS_DISABLED", "این قابلیت در نصب غیرفعال است.", 403);
    ensure(this.config.liaraToken && this.config.liaraBaseUrl === "https://api.liara.ir", "LIARA_UNCONFIGURED", "اتصال مجاز آماده نیست.", 503);
    const url = new URL(write ? "/v1/projects/update-envs" : `/v1/projects/${encodeURIComponent(spec.scope.app)}`, this.config.liaraBaseUrl);
    url.searchParams.set("teamID", spec.scope.teamId); return url;
  }
  async read(spec: Pick<EnvironmentSpec, "scope" | "targetAppId">, budget: RunBudget, signal: AbortSignal): Promise<{ planId: string; values: EnvironmentVariable[] }> {
    const url = this.url(spec, false), bounded = budget.signal(signal);
    try {
      return await abortable(async () => {
        const response = await sendRead(this.send, url.toString(), { method: "GET", redirect: "error", cache: "no-store", signal: bounded,
          headers: { Authorization: `Bearer ${this.config.liaraToken}`, Accept: "application/json" } }, budget, bounded);
        if (!response.ok) { void response.body?.cancel().catch(() => undefined); throw httpFailure(response.status); }
        const row = object(object(await boundedJson(response)).project);
        ensure(row._id === spec.targetAppId && row.project_id === spec.scope.app && row.type === "node", "ENV_TARGET_CHANGED", "هویت یا نوع برنامه تغییر کرده است.", 409);
        return { planId: string(row.planID, 128), values: environmentVariables(row.envs) };
      }, bounded);
    } catch (error) {
      if (error instanceof AppError) throw error;
      throw new AppError("ENV_READ_UNAVAILABLE", "مقادیر موجود قابل دریافت نیستند؛ تغییر ارسال نشد.", 502, true);
    }
  }
  async update(spec: EnvironmentSpec, values: readonly EnvironmentVariable[], budget: RunBudget, signal: AbortSignal): Promise<void> {
    const url = this.url(spec, true), bounded = budget.signal(signal); budget.take("tool", bounded);
    try {
      const response = await abortable(() => this.send(url.toString(), { method: "POST", redirect: "error", cache: "no-store", signal: bounded,
        headers: { Authorization: `Bearer ${this.config.liaraToken}`, Accept: "application/json", "Content-Type": "application/json" },
        body: JSON.stringify({ project: spec.scope.app, variables: environmentVariables(values) }) }), bounded);
      void response.body?.cancel().catch(() => undefined);
      if (!response.ok) throw httpFailure(response.status);
      ensure(response.status === 200 && !bounded.aborted, "UPSTREAM_UNCERTAIN", "پذیرش تغییر قطعی نیست.", 409);
    } catch { throw new AppError("UPSTREAM_UNCERTAIN", "پاسخ تغییر قطعی نیست؛ فقط نتیجه خوانده می‌شود و ارسال تکرار نخواهد شد.", 409); }
  }
}
