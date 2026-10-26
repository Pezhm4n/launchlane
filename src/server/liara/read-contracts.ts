import { stripVTControlCharacters } from "node:util";
import type { Scope } from "../../contracts/domain.ts";
import { integer, object, string } from "../../contracts/validation.ts";
import { AppError, ensure } from "../errors.ts";
import { containsCredential, redact } from "../policy/redaction.ts";

export function evidenceText(value: unknown, max: number, secrets: readonly string[] = []): string {
  ensure(
    typeof value === "string" && value.length <= max,
    "UPSTREAM_INVALID",
    "متن شاهد بیش از سقف یا نامعتبر است.",
    502,
  );
  const clean = Array.from(stripVTControlCharacters(value))
    .filter((character) => {
      const code = character.charCodeAt(0);
      return (
        (code >= 32 || [9, 10, 13].includes(code)) &&
        code !== 127 &&
        !(code >= 0x202a && code <= 0x202e) &&
        !(code >= 0x2066 && code <= 0x2069)
      );
    })
    .join("");
  return redact(clean, secrets);
}

function id(value: unknown, secrets: readonly string[]): string {
  const result = string(value, 128);
  ensure(
    !containsCredential(result, secrets),
    "UPSTREAM_INVALID",
    "شناسه سرویس دارای داده حساس است.",
    502,
  );
  return result;
}

function optionalId(value: unknown, secrets: readonly string[]): string | null {
  return value === undefined || value === null ? null : id(value, secrets);
}

export function explicitIsoTime(value: string): number | null {
  // Numeric log/event tuples have no established unit in the pinned contract.
  return /^\d{4}-\d\d-\d\dT\d\d:\d\d:\d\d(?:\.\d+)?(?:Z|[+-]\d\d:\d\d)$/.test(value) &&
    Number.isFinite(Date.parse(value))
    ? Date.parse(value)
    : null;
}

export type ReleasePage = {
  evidence: "provider_response";
  scope: Scope;
  page: number;
  count: number;
  total: number;
  currentRelease: string | null;
  hasMore: boolean;
  releases: { id: string; state: string; port: number | null; committedAt: string | null; rawCommittedAt?: string }[];
};

export function parseReleases(
  body: unknown,
  scope: Scope,
  page: number,
  count: number,
  secrets: readonly string[],
): ReleasePage {
  const raw = object(body),
    total = integer(raw.total, 0, 1_000_000);
  ensure(
    Array.isArray(raw.releases) && raw.releases.length <= count,
    "UPSTREAM_INVALID",
    "صفحه release با قرارداد تطبیق ندارد.",
    502,
  );
  const releases = raw.releases.map((value: unknown) => {
    const row = object(value),
      git = row.gitInfo === undefined || row.gitInfo === null ? {} : object(row.gitInfo);
    const rawCommittedAt =
      git.committedAt === undefined || git.committedAt === null
        ? null
        : string(git.committedAt, 40);
    // Existing Liara releases also return decimal strings, although the OpenAPI
    // declares date-time. Retain that evidence without guessing its time unit.
    const decimalTime = rawCommittedAt !== null && /^\d{1,16}$/.test(rawCommittedAt);
    ensure(
      rawCommittedAt === null || decimalTime || explicitIsoTime(rawCommittedAt) !== null,
      "UPSTREAM_INVALID",
      "زمان commit معتبر نیست.",
      502,
    );
    return {
      id: id(row._id, secrets),
      state: evidenceText(row.state, 64, secrets),
      port: row.port === undefined || row.port === null ? null : integer(row.port, 1, 65535),
      committedAt: decimalTime ? null : rawCommittedAt,
      ...(decimalTime ? { rawCommittedAt } : {}),
    };
  });
  return {
    evidence: "provider_response",
    scope,
    page,
    count,
    total,
    currentRelease: optionalId(raw.currentRelease, secrets),
    hasMore: page * count < total,
    releases,
  };
}

export function parseBuildLogs(body: unknown, scope: Scope, releaseId: string, secrets: readonly string[], since: string | null = null) {
  const raw = object(body), release = object(raw.release);
  ensure(release._id === releaseId, "SCOPE_MISMATCH", "گزارش ساخت متعلق به نسخهٔ درخواستی نیست.", 502);
  ensure(Array.isArray(raw.buildOutput) && raw.buildOutput.length <= 2000, "UPSTREAM_INVALID", "گزارش ساخت از سقف بررسی بزرگ‌تر یا نامعتبر است.", 502);
  const all = raw.buildOutput.map((value: unknown) => {
    const row = object(value), createdAt = string(row.createdAt, 64);
    ensure((row.stream === "STDOUT" || row.stream === "STDERR") && explicitIsoTime(createdAt) !== null, "UPSTREAM_INVALID", "نوع یا زمان گزارش ساخت معتبر نیست.", 502);
    return { stream: row.stream, line: evidenceText(row.line, 8192, secrets), createdAt };
  });
  const start = since === null ? null : explicitIsoTime(since);
  ensure(since === null || start !== null, "INVALID_INPUT", "زمان شروع گزارش ساخت معتبر نیست.");
  const relevant = all.filter(row => start === null || Date.parse(row.createdAt) >= start), entries: typeof relevant = [];
  let bytes = 0;
  for (const row of relevant.toReversed()) {
    const size = Buffer.byteLength(JSON.stringify(row));
    if (entries.length === 80 || bytes + size > 32768) break;
    entries.unshift(row); bytes += size;
  }
  const latest = all.reduce<string | null>((cursor, row) => cursor === null || Date.parse(row.createdAt) > Date.parse(cursor) ? row.createdAt : cursor, null);
  return { contract: "liara-cli-build-logs-v2" as const, scope, releaseId, state: evidenceText(release.state, 64, secrets),
    entries, returnedEntries: all.length, excludedEntries: all.length - relevant.length, omittedEntries: relevant.length - entries.length,
    nextSince: latest && (start === null || Date.parse(latest) > start) ? latest : null, requestedSince: since,
    coverage: relevant.length ? "bounded_response" as const : all.length ? "out_of_window_only" as const : "empty_response" as const };
}

export type LogRead = {
  contract: "openapi_v1" | "liara_cli_v2";
  since: string;
  entries: {
    kind: string | null;
    rawTime: string | null;
    timeMs: number | null;
    message: string;
  }[];
};
export function parseLogs(body: unknown, since: string, secrets: readonly string[]): LogRead {
  ensure(
    Array.isArray(body) && body.length <= 200,
    "UPSTREAM_INVALID",
    "پاسخ logs با قرارداد محدود v1 تطبیق ندارد.",
    502,
  );
  return {
    contract: "openapi_v1",
    since,
    entries: body.map((value: unknown) => {
      const row = object(value);
      const rawTime =
        row.datetime === undefined || row.datetime === null
          ? null
          : evidenceText(row.datetime, 64, secrets);
      return {
        kind:
          row.type === undefined || row.type === null ? null : evidenceText(row.type, 64, secrets),
        rawTime,
        timeMs: rawTime === null ? null : explicitIsoTime(rawTime),
        message: row.message === undefined ? "" : evidenceText(row.message, 4096, secrets),
      };
    }),
  };
}

export function parseLogsV2(body: unknown, since: string, secrets: readonly string[]): LogRead {
  const raw = object(body);
  ensure(
    Array.isArray(raw.data) && raw.data.length <= 20,
    "UPSTREAM_INVALID",
    "گزارش‌های برنامه با قرارداد v2 تطبیق ندارند.",
    502,
  );
  const entries: LogRead["entries"] = [];
  for (const group of raw.data) {
    const row = object(group);
    object(row.metaData);
    ensure(Array.isArray(row.values), "UPSTREAM_INVALID", "فهرست گزارش‌ها معتبر نیست.", 502);
    ensure(
      entries.length + row.values.length <= 200,
      "UPSTREAM_LIMIT",
      "تعداد گزارش‌ها بیش از سقف است.",
      502,
    );
    for (const tuple of row.values) {
      ensure(
        Array.isArray(tuple) && tuple.length === 2,
        "UPSTREAM_INVALID",
        "پیام گزارش معتبر نیست.",
        502,
      );
      const rawTime = string(tuple[0], 20);
      ensure(/^\d{1,20}$/.test(rawTime), "UPSTREAM_INVALID", "زمان گزارش v2 معتبر نیست.", 502);
      // The official CLI's v2 protocol returns nanoseconds, not the v1 documentary time field.
      const timeMs = Number(BigInt(rawTime) / 1_000_000n);
      ensure(
        Number.isSafeInteger(timeMs) && timeMs <= 8_640_000_000_000_000,
        "UPSTREAM_INVALID",
        "زمان گزارش خارج از محدوده است.",
        502,
      );
      let wrapped: unknown;
      try {
        wrapped = JSON.parse(string(tuple[1], 8192));
      } catch {
        throw new AppError("UPSTREAM_INVALID", "ساختار پیام گزارش v2 معتبر نیست.", 502);
      }
      const message = object(wrapped);
      entries.push({
        kind: evidenceText(message.type, 64, secrets),
        rawTime,
        timeMs,
        message: evidenceText(message._entry, 4096, secrets),
      });
    }
  }
  entries.sort((a, b) => (a.timeMs ?? 0) - (b.timeMs ?? 0));
  return { contract: "liara_cli_v2", since, entries };
}

export type EventRead = {
  timestampUnit: "unverified";
  series: { metadata: Record<string, string>; values: string[][] }[];
};
export function parseEvents(body: unknown, secrets: readonly string[]): EventRead {
  const raw = object(body);
  ensure(
    Array.isArray(raw.data) && raw.data.length <= 20,
    "UPSTREAM_INVALID",
    "پاسخ events معتبر نیست.",
    502,
  );
  let points = 0;
  return {
    timestampUnit: "unverified",
    series: raw.data.map((value: unknown) => {
      const row = object(value);
      if (row.metaData === undefined && row.values === undefined) {
        // Lifecycle events do not establish readiness; their raw time stays unverified.
        return {
          metadata: {
            reason: evidenceText(row.action, 128, secrets),
            type: evidenceText(row.status, 128, secrets),
            releaseId: id(row.release, secrets),
          },
          values: [[evidenceText(row.time, 64, secrets)]],
        };
      }
      const meta = object(row.metaData),
        metadata: Record<string, string> = {};
      for (const key of ["reason", "type", "namespace", "pod", "container", "releaseId"])
        if (typeof meta[key] === "string") metadata[key] = evidenceText(meta[key], 256, secrets);
      ensure(Array.isArray(row.values), "UPSTREAM_INVALID", "فهرست event معتبر نیست.", 502);
      points += row.values.length;
      ensure(points <= 200, "UPSTREAM_LIMIT", "تعداد event بیش از سقف است.", 502);
      const values = row.values.map((tuple: unknown) => {
        ensure(
          Array.isArray(tuple) && tuple.length <= 8,
          "UPSTREAM_INVALID",
          "نقطه event معتبر نیست.",
          502,
        );
        return tuple.map((part: unknown) => evidenceText(part, 2048, secrets));
      });
      return { metadata, values };
    }),
  };
}

export type AppletRead = {
  readiness: "unverified";
  applets: {
    id: string;
    name: string;
    state: string;
    reason: string | null;
    releaseId: string | null;
    rawTime: string | null;
  }[];
};
export function parseApplets(body: unknown, secrets: readonly string[]): AppletRead {
  const raw = object(body);
  ensure(
    Array.isArray(raw.applets) && raw.applets.length <= 50,
    "UPSTREAM_INVALID",
    "پاسخ applets معتبر نیست.",
    502,
  );
  return {
    readiness: "unverified",
    applets: raw.applets.map((value: unknown) => {
      const row = object(value),
        release = row.release === undefined || row.release === null ? {} : object(row.release);
      return {
        id: id(row.id, secrets),
        name: evidenceText(row.name, 128, secrets),
        state: evidenceText(row.state, 128, secrets),
        reason:
          row.reason === undefined || row.reason === null
            ? null
            : evidenceText(row.reason, 512, secrets),
        releaseId: optionalId(release.releaseID, secrets),
        rawTime:
          row.timestamp === undefined || row.timestamp === null
            ? null
            : evidenceText(row.timestamp, 64, secrets),
      };
    }),
  };
}

export type ProjectRead = {
  scope: Scope;
  id: string;
  platform: string;
  state: string;
  planId: string | null;
  envKeys: string[];
  configurationVisibility: "unverified";
};
export function parseProject(body: unknown, scope: Scope, secrets: readonly string[]): ProjectRead {
  const row = object(object(body).project);
  ensure(
    row.project_id === scope.app,
    "SCOPE_MISMATCH",
    "پاسخ پروژه متعلق به برنامه انتخاب‌شده نیست.",
    502,
  );
  ensure(
    Array.isArray(row.envs) && row.envs.length <= 128,
    "UPSTREAM_INVALID",
    "فهرست env معتبر نیست.",
    502,
  );
  const envKeys = row.envs.map((value: unknown) => {
    const key = string(object(value).key, 128);
    ensure(
      /^[A-Za-z_][A-Za-z0-9_]*$/.test(key) && !containsCredential(key, secrets),
      "UPSTREAM_INVALID",
      "نام env معتبر نیست.",
      502,
    );
    return key;
  });
  // Values, node IPs and prices with unknown currency never leave this parser.
  return {
    scope,
    id: id(row._id, secrets),
    platform: evidenceText(row.type, 64, secrets),
    state: evidenceText(row.status, 128, secrets),
    planId: optionalId(row.planID, secrets),
    envKeys: [...new Set(envKeys)],
    configurationVisibility: "unverified",
  };
}
