import { createHmac } from "node:crypto";
import { lookup } from "node:dns/promises";
import { isIP, Socket } from "node:net";
import { Client } from "pg";
import { parsePostgresDataOracle, type PostgresDataOracle } from "../../contracts/postgres-migration-test.ts";
import { exactKeys, hasControl, integer, object, string } from "../../contracts/validation.ts";
import { AppError, ensure } from "../errors.ts";
import { abortable } from "../providers/http.ts";

/** Private provider/readback result. Never accept a connection URL or a model-supplied destination. */
export type PostgresObserverConnection = Readonly<{ host: string; port: number; username: string; password: string; database: string }>;
export type PostgresObserverNetwork = Readonly<{ mode: "private_network" }> | Readonly<{ mode: "tls"; ca?: string }>;
export type PostgresObserverSession = Readonly<{
  connect(): Promise<void>;
  query(sql: string, values: readonly unknown[]): Promise<readonly unknown[]>;
  end(): Promise<void>;
  destroy(): void;
}>;
export type PostgresObserverAddress = Readonly<{ address: string; family: number }>;
export type PostgresObserverSessionInput = PostgresObserverConnection & Readonly<{
  address: string; network: PostgresObserverNetwork;
}>;
export type PostgresDataObservation = Readonly<{
  checkedAt: number; serverMajor: number; columnChecks: number; rowChecks: number; persistenceChecks: number;
  schemaMatches: boolean; rowsMatch: boolean; persistencePresent: boolean; persistenceNonNull: boolean;
}>;
export type PostgresObserverResult = Readonly<{
  observation: PostgresDataObservation;
  /** Secret-keyed digests for PRIVATE storage/comparison only. Never serialize this outer result to tools or UI. */
  privatePersistence: readonly string[];
}>;

function privateAddress(address: PostgresObserverAddress): boolean {
  if (address.family !== 4 || isIP(address.address) !== 4) return false;
  const octets = address.address.split(".").map(Number);
  return octets[0] === 10 || octets[0] === 172 && (octets[1] ?? 0) >= 16 && (octets[1] ?? 0) <= 31 || octets[0] === 192 && octets[1] === 168;
}
function connection(value: PostgresObserverConnection): PostgresObserverConnection {
  const row = object(value); exactKeys(row, ["host", "port", "username", "password", "database"]);
  const host = string(row.host, 253), username = string(row.username, 128), database = string(row.database, 128), password = string(row.password, 4096);
  ensure(/^[a-z][a-z0-9-]{1,62}(?:\.[a-z0-9][a-z0-9-]{0,62})*$/.test(host) && !host.endsWith("-") && isIP(host) === 0 &&
    /^[A-Za-z0-9_.-]+$/.test(username) && /^[A-Za-z0-9_.-]+$/.test(database) && password.length >= 8 && !hasControl(password),
    "DATABASE_DATA_INPUT_INVALID", "اتصال خصوصی دیتابیس معتبر نیست.", 409);
  return { host, username, database, password, port: integer(row.port, 1, 65535) };
}
function network(value: PostgresObserverNetwork): PostgresObserverNetwork {
  const row = object(value); exactKeys(row, row.mode === "tls" && row.ca !== undefined ? ["mode", "ca"] : ["mode"]);
  ensure(row.mode === "private_network" || row.mode === "tls", "DATABASE_DATA_INPUT_INVALID", "روش اتصال خصوصی دیتابیس باید صریح باشد.", 409);
  return row.mode === "tls" ? { mode: "tls", ...(row.ca === undefined ? {} : { ca: string(row.ca, 131072) }) } : { mode: "private_network" };
}
function session(input: PostgresObserverSessionInput): PostgresObserverSession {
  const socket = new Socket(), client = new Client({
    host: input.address, port: input.port, user: input.username, password: input.password, database: input.database,
    stream: () => socket, ssl: input.network.mode === "tls" ? { rejectUnauthorized: true, servername: input.host, ...(input.network.ca ? { ca: input.network.ca } : {}) } : false,
    connectionTimeoutMillis: 5000, query_timeout: 5000, statement_timeout: 3000, lock_timeout: 1000,
    idle_in_transaction_session_timeout: 5000, application_name: "launchlane_readonly_observer", client_encoding: "UTF8",
    options: "-c default_transaction_read_only=on -c search_path=pg_catalog", pipeline: false,
  });
  // Socket errors are converted to one typed error by observe; provider messages are never logged.
  client.on("error", () => socket.destroy());
  return {
    async connect() { await client.connect(); },
    async query(sql, values) { const result = await client.query<Record<string, unknown>>({ text: sql, values: [...values] }); return result.rows; },
    end: () => client.end(),
    destroy() { socket.destroy(); void client.end().catch(() => undefined); },
  };
}
const quoted = (name: string) => `"${name.replaceAll('"', '""')}"`;
const relation = (name: string) => `public.${quoted(name.slice(7))}`;
const json = (value: unknown) => JSON.stringify(value);
const boundedJsonCell = (column: string) => `(CASE WHEN ${column} IS NULL THEN 'null'::jsonb WHEN pg_catalog.pg_column_size(${column})<=4096 AND pg_catalog.octet_length(${column}::text)<=4096 THEN pg_catalog.to_jsonb(${column}) ELSE NULL END)`;

/** Host-owned SELECTs only, on a fresh readonly snapshot. It proves neither migration nor application writes/restarts. */
export class PostgresObserver {
  readonly resolve: (host: string) => Promise<readonly PostgresObserverAddress[]>;
  readonly createSession: (input: PostgresObserverSessionInput) => PostgresObserverSession;
  constructor(deps: { resolve?: (host: string) => Promise<readonly PostgresObserverAddress[]>; createSession?: (input: PostgresObserverSessionInput) => PostgresObserverSession } = {}) {
    this.resolve = deps.resolve ?? (host => lookup(host, { all: true, verbatim: true })); this.createSession = deps.createSession ?? session;
  }
  async observe(privateConnection: PostgresObserverConnection, inputOracle: PostgresDataOracle, options: {
    expectedMajor: string; network: PostgresObserverNetwork; digestKey: string; signal: AbortSignal; take?: () => void;
  }): Promise<PostgresObserverResult> {
    const target = connection(privateConnection), oracle = parsePostgresDataOracle(inputOracle, "runner"), transport = network(options.network);
    ensure(typeof options.expectedMajor === "string" && /^\d{2}(?:\.\d+)*$/.test(options.expectedMajor) &&
      typeof options.digestKey === "string" && options.digestKey.length >= 32 && options.digestKey.length <= 4096,
      "DATABASE_DATA_INPUT_INVALID", "نسخه و کلید خصوصی سنجش معتبر نیست.", 409);
    const expectedMajor = Number(options.expectedMajor.split(".")[0]), signal = AbortSignal.any([options.signal, AbortSignal.timeout(15000)]);
    ensure(expectedMajor >= 10 && expectedMajor <= 99, "DATABASE_DATA_INPUT_INVALID", "نسخه PostgreSQL معتبر نیست.", 409);
    let client: PostgresObserverSession | null = null, queryCount = 0;
    const stop = () => client?.destroy(); signal.addEventListener("abort", stop, { once: true });
    try {
      const addresses = await abortable(() => this.resolve(target.host), signal);
      ensure(addresses.length > 0 && addresses.length <= 8 && addresses.every(privateAddress),
        "DATABASE_DATA_NETWORK_DENIED", "مقصد دیتابیس باید فقط در شبکهٔ خصوصی تأییدشده قابل دسترس باشد.", 409);
      const address = addresses[0]; ensure(address, "DATABASE_DATA_NETWORK_DENIED", "نشانی خصوصی دیتابیس در دسترس نیست.", 409);
      // Pin the checked address: pg never resolves the hostname a second time or follows an alternate endpoint.
      client = this.createSession({ ...target, address: address.address, network: transport });
      await abortable(() => client ? client.connect() : Promise.reject(), signal);
      const active = client;
      const query = async (sql: string, values: readonly unknown[] = []) => {
        ensure(++queryCount <= 29 && sql.length <= 32768 && Buffer.byteLength(json(values)) <= 32768,
          "DATABASE_DATA_LIMIT", "سقف سنجش خصوصی دیتابیس کافی نیست.", 409);
        options.take?.(); const rows = await abortable(() => active.query(sql, values), signal);
        ensure(rows.length <= 2 && Buffer.byteLength(json(rows)) <= 16384, "DATABASE_DATA_LIMIT", "پاسخ سنجش داده از سقف مجاز بزرگ‌تر است.", 409);
        return rows;
      };
      await query("BEGIN ISOLATION LEVEL REPEATABLE READ READ ONLY");
      await query("SELECT pg_catalog.set_config('statement_timeout','3000ms',true), pg_catalog.set_config('lock_timeout','1000ms',true), pg_catalog.set_config('idle_in_transaction_session_timeout','5000ms',true), pg_catalog.set_config('search_path','pg_catalog',true), pg_catalog.set_config('row_security','off',true)");
      const identityRows = await query("SELECT pg_catalog.current_database() AS database, CURRENT_USER AS username, pg_catalog.current_setting('server_version_num') AS version, pg_catalog.current_setting('transaction_read_only') AS readonly");
      ensure(identityRows.length === 1, "DATABASE_DATA_IDENTITY_CHANGED", "هویت نشست دیتابیس مشخص نیست.", 409);
      const identity = object(identityRows[0]);
      ensure(identity.database === target.database && identity.username === target.username && identity.readonly === "on" &&
        typeof identity.version === "string" && /^\d{6}$/.test(identity.version) && Math.floor(Number(identity.version) / 10000) === expectedMajor,
        "DATABASE_DATA_IDENTITY_CHANGED", "نام، نقش، نسخه یا حالت فقط‌خواندنی نشست دیتابیس تأیید نشد.", 409);
      const params: unknown[] = [], expected = oracle.columns.map(column => {
        const index = params.length; params.push(column.relation.slice(7), column.name, column.type, column.nullable);
        return `($${index + 1}::text,$${index + 2}::text,$${index + 3}::text,$${index + 4}::boolean)`;
      });
      const attributes = "FROM pg_catalog.pg_attribute a JOIN pg_catalog.pg_class c ON c.oid=a.attrelid JOIN pg_catalog.pg_namespace n ON n.oid=c.relnamespace JOIN pg_catalog.pg_type t ON t.oid=a.atttypid JOIN pg_catalog.pg_namespace tn ON tn.oid=t.typnamespace WHERE n.nspname='public' AND c.relname=expected.relation AND c.relkind IN ('r','p') AND a.attname=expected.name AND a.attnum>0 AND NOT a.attisdropped",
        safeType = "tn.nspname='pg_catalog' AND t.typname IN ('bool','int2','int4','int8','float4','float8','numeric','text','varchar','bpchar','bytea','date','time','timetz','timestamp','timestamptz','interval','uuid','json','jsonb')";
      const schemaRows = await query(`SELECT count(*) FILTER (WHERE EXISTS (SELECT 1 ${attributes} AND (${safeType}) AND pg_catalog.format_type(a.atttypid,a.atttypmod)=expected.type AND a.attnotnull=(NOT expected.nullable)))::integer AS matches, count(*) FILTER (WHERE EXISTS (SELECT 1 ${attributes} AND NOT (${safeType})))::integer AS unsupported FROM (VALUES ${expected.join(",")}) AS expected(relation,name,type,nullable)`, params);
      ensure(schemaRows.length === 1, "DATABASE_DATA_RESPONSE_INVALID", "شمار سنجش schema معتبر نیست.", 409);
      const schema = object(schemaRows[0]);
      ensure(integer(schema.unsupported, 0, oracle.columns.length) === 0, "DATABASE_DATA_TYPE_UNSUPPORTED", "سنجش مقدار فقط برای نوع‌های scalar داخلی PostgreSQL پشتیبانی می‌شود؛ تابع خروجی نوع سفارشی اجرا نشد.", 409);
      const matches = integer(schema.matches, 0, oracle.columns.length), schemaMatches = matches === oracle.columns.length;
      let rowChecks = 0, persistenceChecks = 0, rowsMatch = schemaMatches, persistencePresent = schemaMatches, persistenceNonNull = schemaMatches;
      const privatePersistence: string[] = [];
      if (schemaMatches) {
        for (const row of oracle.rows) {
          const columns = [...new Set(row.values.map(value => value.column))].map(quoted).join(","), values: unknown[] = [json(row.key.value), ...row.values.map(value => json(value.value))];
          const condition = row.values.map((value, i) => `${boundedJsonCell(quoted(value.column))} IS NOT DISTINCT FROM $${i + 2}::jsonb`).join(" AND ");
          const read = await query(`WITH selected AS (SELECT ${columns} FROM ${relation(row.relation)} WHERE ${boundedJsonCell(quoted(row.key.column))} IS NOT DISTINCT FROM $1::jsonb LIMIT 2) SELECT count(*)::integer AS count, COALESCE(bool_and(${condition}),false) AS ok FROM selected`, values);
          ensure(read.length === 1, "DATABASE_DATA_RESPONSE_INVALID", "نتیجهٔ سنجش ردیف معتبر نیست.", 409);
          const actual = object(read[0]); integer(actual.count, 0, 2); ensure(typeof actual.ok === "boolean", "DATABASE_DATA_RESPONSE_INVALID", "نتیجهٔ سنجش داده معتبر نیست.", 409);
          rowChecks++; rowsMatch = rowsMatch && actual.count === 1 && actual.ok;
        }
        for (const [i, row] of oracle.persistence.entries()) {
          const column = quoted(row.column), boundedValue = `pg_catalog.pg_column_size(${column})<=4096 AND pg_catalog.octet_length(${column}::text)<=4096`,
            read = await query(`WITH selected AS (SELECT CASE WHEN ${boundedValue} THEN pg_catalog.to_jsonb(${column}) ELSE NULL END AS value, COALESCE(NOT (${boundedValue}),false) AS oversized FROM ${relation(row.relation)} WHERE ${boundedJsonCell(quoted(row.key.column))} IS NOT DISTINCT FROM $1::jsonb LIMIT 2) SELECT count(*)::integer AS count, COALESCE(bool_or(oversized),false) AS oversized, (jsonb_agg(value))->0 AS value FROM selected`, [json(row.key.value)]);
          ensure(read.length === 1, "DATABASE_DATA_RESPONSE_INVALID", "نتیجهٔ سنجش state معتبر نیست.", 409);
          const actual = object(read[0]); integer(actual.count, 0, 2);
          ensure(actual.oversized === false && "value" in actual && Buffer.byteLength(json(actual.value)) <= 8192,
            "DATABASE_DATA_LIMIT", "مقدار خصوصی سنجش از سقف مجاز بزرگ‌تر است.", 409);
          const present = actual.count === 1; persistenceChecks++; persistencePresent = persistencePresent && present;
          persistenceNonNull = persistenceNonNull && present && actual.value !== null;
          privatePersistence.push(createHmac("sha256", options.digestKey).update(json({ oracle, index: i, present, value: actual.value })).digest("hex"));
        }
      }
      await query("ROLLBACK");
      ensure(!signal.aborted, "DATABASE_DATA_CANCELLED", "سنجش خصوصی دیتابیس پایان نیافت.", 409);
      return { observation: { checkedAt: Date.now(), serverMajor: expectedMajor, columnChecks: oracle.columns.length, rowChecks, persistenceChecks,
        schemaMatches, rowsMatch, persistencePresent, persistenceNonNull }, privatePersistence };
    } catch (error) {
      if (signal.aborted) throw new AppError("DATABASE_DATA_CANCELLED", "سنجش خصوصی دیتابیس لغو شد یا مهلت آن پایان یافت؛ وضعیت داده تأیید نشد.", 409);
      if (error instanceof AppError && error.code === "BUDGET_EXHAUSTED") throw new AppError("BUDGET_EXHAUSTED", "بودجهٔ سنجش مستقل دیتابیس تمام شد؛ نتیجه کامل نشده است.", 409);
      if (error instanceof AppError && error.code.startsWith("DATABASE_DATA_")) throw error;
      throw new AppError("DATABASE_DATA_UNAVAILABLE", "اتصال یا سنجش مستقل دیتابیس تأیید نشد؛ جزئیات خصوصی نمایش داده نمی‌شوند.", 409);
    } finally {
      signal.removeEventListener("abort", stop);
      if (client) { client.destroy(); await client.end().catch(() => undefined); }
    }
  }
}
