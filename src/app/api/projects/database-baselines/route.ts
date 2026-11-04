import { endpoint, reply } from "../../../../server/http.ts";
import { AppError, ensure } from "../../../../server/errors.ts";
import { dataObservationId } from "../../../../contracts/database-data.ts";
import { importDatabaseBaseline, listDatabaseBaselines, previewDatabaseBaseline } from "../../../../server/application/database-baselines.ts";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
function project(request: Request) {
  const query = new URL(request.url).searchParams;
  ensure([...query.keys()].length === 1 && query.has("projectId"), "INVALID_INPUT", "پروژه باید مشخص باشد.");
  return dataObservationId(query.get("projectId"));
}
export async function GET(request: Request) {
  return endpoint(request, false, ({ config, store, session }) => reply({ baselines: listDatabaseBaselines(config, store, session.actorId, project(request)) }));
}
export async function POST(request: Request) {
  return endpoint(request, true, async ({ config, store, session }) => {
    const projectId = project(request); listDatabaseBaselines(config, store, session.actorId, projectId);
    const type = request.headers.get("content-type") ?? "", limit = 8 * 1024 * 1024 + 8192;
    ensure(/^multipart\/form-data; boundary=/i.test(type) && Number(request.headers.get("content-length") ?? 0) <= limit, "DATABASE_DUMP_LIMIT", "فایل باید حداکثر ۸ مگابایت باشد.", 413);
    const reader = request.body?.getReader(); ensure(reader, "INVALID_INPUT", "فایل ساختار را انتخاب کنید.");
    const signal = AbortSignal.any([request.signal, AbortSignal.timeout(30000)]), chunks: Uint8Array[] = []; let bytes = 0;
    const cancel = () => { void reader.cancel().catch(() => undefined); }; signal.addEventListener("abort", cancel, { once: true });
    try { while (true) { const part = await reader.read(); if (part.done) break; bytes += part.value.byteLength;
      ensure(bytes <= limit && !signal.aborted, "DATABASE_DUMP_LIMIT", "فایل بیش از سقف بررسی است یا دریافت کامل نشد.", 413); chunks.push(part.value);
    } } finally { signal.removeEventListener("abort", cancel); await reader.cancel().catch(() => undefined); reader.releaseLock(); }
    ensure(!signal.aborted, "CANCELLED", "بررسی فایل لغو شد.", 409);
    let data: FormData;
    try { data = await new Response(Buffer.concat(chunks), { headers: { "content-type": type } }).formData(); }
    catch { throw new AppError("DATABASE_DUMP_INVALID", "دریافت فایل کامل یا معتبر نیست."); }
    ensure([...data.keys()].every(key => ["file", "tables", "requestKey"].includes(key)) && data.getAll("file").length === 1 && data.getAll("tables").length <= 1 && data.getAll("requestKey").length <= 1, "INVALID_INPUT", "ورودی فایل معتبر نیست.");
    const file = data.get("file"); ensure(file instanceof File && file.size <= 8 * 1024 * 1024, "DATABASE_DUMP_LIMIT", "فایل باید حداکثر ۸ مگابایت باشد.", 413);
    let input: string;
    try { input = new TextDecoder("utf-8", { fatal: true }).decode(await file.arrayBuffer()); }
    catch { throw new AppError("DATABASE_DUMP_ENCODING", "فایل باید متن معتبر UTF-8 باشد."); }
    const tablesValue = data.get("tables");
    if (tablesValue === null) return reply(previewDatabaseBaseline(config, store, session.actorId, projectId, input));
    ensure(typeof tablesValue === "string" && tablesValue.length <= 1024, "INVALID_INPUT", "جدول‌ها معتبر نیستند.");
    let tables: unknown;
    try { tables = JSON.parse(tablesValue); } catch { throw new AppError("INVALID_INPUT", "فهرست جدول‌ها معتبر نیست."); }
    ensure(Array.isArray(tables) && tables.every(table => typeof table === "string"), "INVALID_INPUT", "جدول‌ها معتبر نیستند.");
    return reply({ baseline: importDatabaseBaseline(config, store, session.actorId, projectId, dataObservationId(data.get("requestKey")), input, tables) });
  });
}
