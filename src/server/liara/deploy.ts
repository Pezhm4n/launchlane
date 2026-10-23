import { createHash } from "node:crypto";
import type { ActionSpec } from "../../contracts/domain.ts";
import { sourceReceiptId } from "../../contracts/deployment.ts";
import { parseNodeVersion } from "../../contracts/node-runtime.ts";
import { parsePythonRuntime } from "../../contracts/python-runtime.ts";
import { parseStaticRuntime } from "../../contracts/static-runtime.ts";
import { object, string } from "../../contracts/validation.ts";
import type { Config } from "../config.ts";
import { AppError, ensure } from "../errors.ts";
import { authorizeScope } from "../policy/action.ts";
import type { RunBudget } from "../policy/budget.ts";
import { containsCredential } from "../policy/redaction.ts";
import {
  abortable,
  boundedJson,
  httpFailure,
  transport,
  type Transport,
} from "../providers/http.ts";

export type DeploySpec = Extract<ActionSpec, { version: 5 | 7 | 10 | 11 | 15 }>;
export class LiaraDeployClient {
  readonly config: Config;
  readonly send: Transport;
  constructor(config: Config, send: Transport = transport) {
    this.config = config;
    this.send = send;
  }

  private async write(
    spec: DeploySpec,
    suffix: "sources" | "releases",
    body: FormData | string,
    field: "sourceID" | "releaseID",
    budget: RunBudget,
    signal: AbortSignal,
  ): Promise<string> {
    ensure(spec.version === 5 || spec.version === 7 || spec.version === 10 || spec.version === 11 || spec.version === 15, "DEPLOYMENT_PROPOSAL_REQUIRED", "پیشنهاد تازه با نسخه اجرا مشخص لازم است.", 409);
    if (spec.version === 15) parseStaticRuntime(spec.runtime);
    else if (spec.version === 11) parsePythonRuntime(spec.runtime);
    else parseNodeVersion(spec.nodeVersion);
    authorizeScope(spec.scope, this.config);
    ensure(
      this.config.enableMutations && this.config.enableLiveLiara,
      "MUTATIONS_DISABLED",
      "ارسال واقعی به لیارا غیرفعال است.",
      403,
    );
    ensure(
      this.config.liaraToken && this.config.liaraBaseUrl === "https://api.liara.ir",
      "LIARA_UNCONFIGURED",
      "اتصال مجاز لیارا آماده نیست.",
      503,
    );
    const url = new URL(
      `/v2/projects/${encodeURIComponent(spec.scope.app)}/${suffix}`,
      this.config.liaraBaseUrl,
    );
    url.searchParams.set("teamID", spec.scope.teamId);
    budget.take("tool", signal);
    const bounded = budget.signal(signal);
    try {
      // One send only, including 429/5xx. The application owns uncertainty and reconciliation.
      const response = await abortable(
        () =>
          this.send(url.toString(), {
            method: "POST",
            body,
            redirect: "error",
            cache: "no-store",
            signal: bounded,
            headers: {
              Authorization: `Bearer ${this.config.liaraToken}`,
              Accept: "application/json",
              ...(typeof body === "string" ? { "Content-Type": "application/json" } : {}),
            },
          }),
        bounded,
      );
      if (!response.ok) {
        await response.body?.cancel();
        throw httpFailure(response.status);
      }
      const raw = object(await abortable(() => boundedJson(response, 16_384), bounded));
      ensure(!bounded.aborted, "UPSTREAM_UNCERTAIN", "پاسخ پس از پایان ارسال دریافت شد.", 409);
      const remoteId = field === "sourceID" ? sourceReceiptId(raw[field]) : string(raw[field], 128);
      ensure(
        (field === "sourceID" || /^[a-zA-Z0-9_-]+$/.test(remoteId)) &&
          !containsCredential(remoteId, [
            this.config.liaraToken,
            this.config.modelKey,
            this.config.operatorToken,
            this.config.sessionSecret,
            ...this.config.projectSecretValues,
          ]),
        "UPSTREAM_INVALID",
        "شناسه پاسخ لیارا معتبر نیست.",
        502,
      );
      return remoteId;
    } catch (error) {
      if (error instanceof AppError) throw error;
      throw new AppError(
        "UPSTREAM_UNCERTAIN",
        "پاسخ قطعی ارسال دریافت نشد؛ ارسال دوباره خودکار مجاز نیست.",
        409,
      );
    }
  }

  upload(
    spec: DeploySpec,
    source: Buffer,
    budget: RunBudget,
    signal: AbortSignal,
  ): Promise<string> {
    ensure(
      source.length > 0 &&
        source.length <= 24 * 1024 * 1024 &&
        createHash("sha256").update(source).digest("hex") === spec.artifactHash,
      "ARTIFACT_MISMATCH",
      "بایت‌های ارسال با بسته تأییدشده برابر نیستند.",
      409,
    );
    const form = new FormData();
    form.append(
      "file",
      new Blob([new Uint8Array(source)], { type: "application/gzip" }),
      "source.tar.gz",
    );
    return this.write(spec, "sources", form, "sourceID", budget, signal);
  }

  release(
    spec: DeploySpec,
    sourceId: string,
    budget: RunBudget,
    signal: AbortSignal,
  ): Promise<string> {
    sourceReceiptId(sourceId);
    // Deliberately no env/plan/create operation. planId is a precondition, never a resize request.
    return this.write(
      spec,
      "releases",
      JSON.stringify({
        sourceID: sourceId,
        port: spec.args.port,
        type: spec.version === 15 ? "static" : spec.version === 11 ? "python" : "node",
        ...(spec.version === 15 ? { platformConfig: {} } : { platformConfig: { version: spec.version === 11 ? parsePythonRuntime(spec.runtime).version : parseNodeVersion(spec.nodeVersion) } }),
        ...(spec.version === 11 ? { args: [spec.runtime.command.join(" ")] } : {}),
      }),
      "releaseID",
      budget,
      signal,
    );
  }
}
