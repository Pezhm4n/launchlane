import { lookup } from "node:dns/promises";
import { createHash } from "node:crypto";
import { request } from "node:https";
import { BlockList, isIP } from "node:net";
import type { Scope } from "../../contracts/domain.ts";
import type { Config } from "../config.ts";
import { AppError, ensure } from "../errors.ts";
import { authorizeScope } from "../policy/action.ts";
import type { RunBudget } from "../policy/budget.ts";
import { evidenceText } from "./read-contracts.ts";
import { htmlWorkloadByteLimit } from "../../contracts/deployment.ts";

export type Address = { address: string; family: 4 | 6 };
export type ProbeResult = {
  scope: Scope;
  origin: string;
  path: string;
  observedAt: number;
  status: number;
  body: string;
  bytes: number;
  durationMs: number;
  outcome: "response" | "redirect_blocked";
  sha256?: string;
  contentType?: string | null;
};
export type Resolver = (hostname: string) => Promise<Address[]>;
export type ProbeTransport = (
  url: URL,
  address: Address,
  signal: AbortSignal,
  maxBytes?: number,
  accept?: string,
) => Promise<{ status: number; body: string; bytes: number; durationMs: number; sha256?: string; contentType?: string | null }>;
export function validateProbePath(path: unknown): string {
  ensure(typeof path === "string" && /^\/(?:[A-Za-z0-9_./-]*)$/.test(path) &&
    path.length <= 200 && !path.startsWith("//") && !path.split("/").includes(".."),
    "PROBE_TARGET_DENIED", "مسیر بررسی معتبر نیست؛ query و مقصد دلخواه مجاز نیست.", 403);
  return path;
}
/** A same-origin asset reference may carry a bounded query (cache-busting) but never
 * a fragment, arbitrary origin, traversal segment or control character. */
export function validateProbeAssetPath(path: unknown): string {
  ensure(typeof path === "string" && path.length <= 400, "PROBE_TARGET_DENIED", "مسیر فایل بررسی معتبر نیست.", 403);
  const queryAt = path.indexOf("?"), pathname = queryAt === -1 ? path : path.slice(0, queryAt), query = queryAt === -1 ? "" : path.slice(queryAt + 1);
  ensure(/^\/(?:[A-Za-z0-9_./%~!$&'()*+,;=:@-]*)$/.test(pathname) && !pathname.startsWith("//") &&
    !pathname.split("/").includes("..") && /^(?:[A-Za-z0-9_./%~!$&'()*+,;=:@?-]*)$/.test(query) && query.length <= 256,
    "PROBE_TARGET_DENIED", "مسیر فایل بررسی معتبر نیست.", 403);
  return path;
}
const blocked = new BlockList();
for (const [address, prefix] of [
  ["0.0.0.0", 8],
  ["10.0.0.0", 8],
  ["100.64.0.0", 10],
  ["127.0.0.0", 8],
  ["169.254.0.0", 16],
  ["172.16.0.0", 12],
  ["192.0.0.0", 24],
  ["192.0.2.0", 24],
  ["192.88.99.0", 24],
  ["192.168.0.0", 16],
  ["198.18.0.0", 15],
  ["198.51.100.0", 24],
  ["203.0.113.0", 24],
  ["224.0.0.0", 4],
  ["240.0.0.0", 4],
] as const)
  blocked.addSubnet(address, prefix, "ipv4");
const globalV6 = new BlockList();
globalV6.addSubnet("2000::", 3, "ipv6");
for (const [address, prefix] of [
  ["2001::", 23],
  ["2001:db8::", 32],
  ["2002::", 16],
  ["3fff::", 20],
] as const)
  blocked.addSubnet(address, prefix, "ipv6");

export function isPublicAddress(address: Address): boolean {
  if (isIP(address.address) !== address.family) return false;
  return address.family === 4
    ? !blocked.check(address.address, "ipv4")
    : globalV6.check(address.address, "ipv6") && !blocked.check(address.address, "ipv6");
}
const resolveAddresses: Resolver = async (hostname) =>
  (await lookup(hostname, { all: true, verbatim: true })).map((entry) => {
    ensure(
      entry.family === 4 || entry.family === 6,
      "PROBE_DNS_DENIED",
      "نوع آدرس مقصد مجاز نیست.",
      403,
    );
    return { address: entry.address, family: entry.family };
  });

function documentResponseLimit(contentType: string | null | undefined): number {
  return ["text/html", "application/xhtml+xml"].includes((contentType ?? "").split(";")[0]?.trim().toLowerCase() ?? "") ? htmlWorkloadByteLimit : 65536;
}

function abortable<T>(task: Promise<T>, signal: AbortSignal): Promise<T> {
  return new Promise((resolve, reject) => {
    const stop = () => reject(new AppError("CANCELLED", "بررسی مقصد متوقف شد.", 409));
    if (signal.aborted) stop();
    else signal.addEventListener("abort", stop, { once: true });
    task.then(resolve, reject).finally(() => signal.removeEventListener("abort", stop));
  });
}

export const pinnedHttps: ProbeTransport = (url, address, signal, maxBytes = 4096, accept = "text/html, text/plain, application/json") =>
  new Promise((resolve, reject) => {
    const started = performance.now();
    // Keep the original hostname for TLS/certificate checks; never resolve it again at socket time.
    const req = request(
      url,
      {
        method: "GET",
        signal,
        family: address.family,
        maxHeaderSize: 8192,
        lookup: (_hostname, _options, callback) => callback(null, address.address, address.family),
        headers: {
          Accept: accept,
          "Accept-Encoding": "identity",
          "User-Agent": "Launchlane-Health/1",
        },
      },
      (res) => {
        let bytes = 0;
        const responseLimit = maxBytes === htmlWorkloadByteLimit ? documentResponseLimit(res.headers["content-type"]) : maxBytes;
        const chunks: Buffer[] = [];
        res.on("data", (part: Buffer) => {
          bytes += part.length;
          if (bytes > responseLimit) {
            res.destroy(new AppError("PROBE_LIMIT", "پاسخ مقصد از سقف بررسی بزرگ‌تر است.", 502));
            return;
          }
          chunks.push(part);
        });
        res.once("error", reject);
        res.once("end", () => {
          const body = Buffer.concat(chunks);
          resolve({
            status: res.statusCode || 0,
            body: body.toString("utf8"),
            bytes,
            durationMs: Math.round(performance.now() - started),
            sha256: createHash("sha256").update(body).digest("hex"), contentType: res.headers["content-type"]?.slice(0, 128) ?? null,
          });
        });
      },
    );
    req.once("error", reject);
    req.end();
  });

export class WorkloadProbe {
  readonly config: Config;
  readonly resolve: Resolver;
  readonly send: ProbeTransport;
  constructor(
    config: Config,
    resolve: Resolver = resolveAddresses,
    send: ProbeTransport = pinnedHttps,
  ) {
    this.config = config;
    this.resolve = resolve;
    this.send = send;
  }
  async check(
    scope: Scope,
    path: string,
    budget: RunBudget,
    signal: AbortSignal,
    maxBytes = 4096,
  ): Promise<ProbeResult> {
    ensure(maxBytes === 4096 || maxBytes === 65536, "PROBE_LIMIT", "سقف پاسخ مجاز نیست.");
    return this.read(scope, path, budget, signal, maxBytes, false);
  }
  async checkFile(scope: Scope, path: string, budget: RunBudget, signal: AbortSignal): Promise<ProbeResult> {
    return this.read(scope, path, budget, signal, 8 * 1024 * 1024, true);
  }
  /** Fingerprint one referenced script/stylesheet. A query is allowed, the origin is fixed. */
  async checkAsset(scope: Scope, path: string, budget: RunBudget, signal: AbortSignal): Promise<ProbeResult> {
    return this.read(scope, path, budget, signal, 4 * 1024 * 1024, true, false, true);
  }
  async checkDocument(scope: Scope, path: string, budget: RunBudget, signal: AbortSignal): Promise<ProbeResult> {
    return this.read(scope, path, budget, signal, htmlWorkloadByteLimit, false, true);
  }
  private async read(scope: Scope, path: string, budget: RunBudget, signal: AbortSignal, maxBytes: number, fingerprintOnly: boolean, document = false, asset = false): Promise<ProbeResult> {
    authorizeScope(scope, this.config);
    ensure(
      this.config.enableLiveLiara,
      "LIVE_LIARA_DISABLED",
      "بررسی واقعی workload غیرفعال است.",
      403,
    );
    const origin = Object.hasOwn(this.config.probeOrigins, scope.app) ? this.config.probeOrigins[scope.app] : undefined;
    ensure(
      origin,
      "PROBE_UNCONFIGURED",
      "میزبان دقیق workload هنوز در تنظیمات سرور تأیید نشده است.",
      503,
    );
    if (asset) validateProbeAssetPath(path);
    else validateProbePath(path);
    const url = new URL(path, origin);
    ensure(url.origin === origin, "PROBE_TARGET_DENIED", "مقصد بررسی تغییر کرده است.", 403);
    budget.take("tool", signal);
    // Observed TLS handshakes can exceed 5s; this transport cap is separate from workload assertions.
    const boundedSignal = AbortSignal.any([budget.signal(signal), AbortSignal.timeout(15_000)]);
    try {
      const addresses = await abortable(this.resolve(url.hostname), boundedSignal);
      ensure(
        addresses.length > 0 && addresses.length <= 8 && addresses.every(isPublicAddress),
        "PROBE_DNS_DENIED",
        "آدرس مقصد عمومی و مجاز نیست؛ درخواستی به workload ارسال نشد.",
        403,
      );
      const pinned = addresses[0];
      ensure(pinned && !boundedSignal.aborted, "CANCELLED", "بررسی متوقف شد.", 409);
      const result = await abortable(this.send(url, pinned, boundedSignal, maxBytes, asset ? "*/*" : undefined), boundedSignal);
      const responseLimit = document ? documentResponseLimit(result.contentType) : maxBytes;
      ensure(!boundedSignal.aborted, "CANCELLED", "پاسخ پس از پایان بررسی دریافت شد.", 409);
      ensure(
        result.status >= 100 &&
          result.status <= 599 &&
          result.bytes <= responseLimit &&
          Buffer.byteLength(result.body) <= responseLimit &&
          Number.isFinite(result.durationMs) &&
          result.durationMs >= 0,
        "PROBE_INVALID",
        "پاسخ بررسی معتبر نیست.",
        502,
      );
      const redirect = result.status >= 300 && result.status < 400;
      return {
        scope,
        origin,
        path,
        observedAt: Date.now(),
        status: result.status, bytes: result.bytes, durationMs: result.durationMs,
        ...(fingerprintOnly ? { sha256: result.sha256 ?? createHash("sha256").update(result.body).digest("hex") } : {}),
        contentType: result.contentType ?? null,
        body: redirect || fingerprintOnly
          ? ""
          : evidenceText(result.body, maxBytes, [
              this.config.liaraToken,
              this.config.modelKey,
              this.config.operatorToken,
              this.config.sessionSecret,
              ...this.config.projectSecretValues,
            ]),
        outcome: redirect ? "redirect_blocked" : "response",
      };
    } catch (error) {
      if (boundedSignal.aborted)
        throw new AppError(
          signal.aborted
            ? "CANCELLED"
            : Date.now() >= budget.deadline
              ? "BUDGET_EXHAUSTED"
              : "PROBE_TIMEOUT",
          "بررسی workload کامل نشد؛ سلامت تأیید نشده است.",
          409,
        );
      if (error instanceof AppError) throw error;
      throw new AppError(
        "PROBE_TRANSPORT",
        "پاسخ workload دریافت نشد؛ retry یا redirect خودکار انجام نشد.",
        502,
      );
    }
  }
}
