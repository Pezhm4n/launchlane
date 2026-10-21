import { exactKeys, object, string } from "../../../../contracts/validation.ts";
import { connectLiara } from "../../../../server/connections/liara.ts";
import { AppError, ensure } from "../../../../server/errors.ts";
import { endpoint, jsonBody, reply } from "../../../../server/http.ts";
import { openCredential } from "../../../../server/connections/credentials.ts";
import { parseProbeOrigins } from "../../../../server/policy/probe-target.ts";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export async function GET(request: Request) {
  return endpoint(request, false, ({ config, store, session }) =>
    reply({
      connection: store.getConnection(session.actorId, "liara")?.view ?? null,
      configuredKey: Boolean(config.liaraToken),
      teamConfigured: Boolean(config.teamId),
      serviceReadsEnabled: config.enableLiveLiara,
    }),
  );
}
export async function DELETE(request: Request) {
  return endpoint(request, true, ({ store, session }) => {
    store.invalidateProjectApproval(session.actorId);
    store.disconnectConnection(session.actorId, "liara");
    return reply({ disconnected: true, providerRevoked: false });
  });
}
export async function POST(request: Request) {
  return endpoint(request, true, async ({ config, store, session }) => {
    const input = object(await jsonBody(request)),
      operation = string(input.operation, 16);
    ensure(
      ["connect", "refresh", "select", "site"].includes(operation),
      "INVALID_OPERATION",
      "این درخواست اتصال پشتیبانی نمی‌شود.",
    );
    exactKeys(input, [
      "operation",
      ...(operation === "connect"
        ? ["key"]
        : operation === "select"
          ? ["app"]
          : operation === "site"
            ? ["origin"]
            : []),
    ]);
    const saved = store.getConnection(session.actorId, "liara");
    if (operation === "site") {
      ensure(
        saved?.view.status === "connected" &&
          saved.view.teamId === config.teamId &&
          saved.view.selectedApp &&
          (!config.apps.length || config.apps.includes(saved.view.selectedApp)),
        "LIARA_APP_REQUIRED",
        "ابتدا برنامه مقصد را از حساب متصل انتخاب کنید.",
        403,
      );
      let origin: string;
      try {
        const raw = string(input.origin, 512).trim(),
          url = new URL(raw.includes("://") ? raw : `https://${raw}`);
        ensure(
          url.pathname === "/" &&
            !url.search &&
            !url.hash &&
            !url.username &&
            !url.password &&
            !url.port,
          "SITE_ADDRESS_INVALID",
          "نشانی سایت معتبر نیست.",
        );
        origin = url.origin;
        parseProbeOrigins(JSON.stringify({ [saved.view.selectedApp]: origin }), [
          saved.view.selectedApp,
        ]);
      } catch {
        throw new AppError(
          "SITE_ADDRESS_INVALID",
          "فقط نام سایت را بدون مسیر صفحه، رمز، پارامتر یا شماره پورت وارد کنید؛ مثلاً example.com. اتصال امن https لازم است.",
        );
      }
      ensure(
        !config.probeOrigins[saved.view.selectedApp] ||
          config.probeOrigins[saved.view.selectedApp] === origin,
        "SITE_ADDRESS_FIXED",
        "نشانی بررسی این برنامه در تنظیمات نصب ثابت شده است. برای تغییر آن از مسئول نصب کمک بگیرید.",
        403,
      );
      store.setProbeOrigin(
        session.actorId,
        { teamId: config.teamId, app: saved.view.selectedApp },
        origin,
      );
      return reply({ connection: saved.view, probeOrigin: origin, contactedSite: false });
    }
    if (operation === "select") {
      const app = string(input.app, 63);
      ensure(
        saved?.view.status === "connected" &&
          saved.view.apps.some((row) => row.name === app) &&
          (!config.apps.length || config.apps.includes(app)),
        "LIARA_APP_REQUIRED",
        "این برنامه در فهرست مجاز حساب متصل نیست. فهرست را تازه کنید.",
        403,
      );
      if (saved.view.selectedApp !== app) store.invalidateProjectApproval(session.actorId);
      return reply({
        connection: store.saveConnection(session.actorId, {
          ...saved,
          view: { ...saved.view, selectedApp: app },
        }),
      });
    }
    const key =
      operation === "connect"
        ? input.key === undefined
          ? config.liaraToken
          : string(input.key, 4096)
        : saved?.ciphertext
          ? openCredential(saved.ciphertext, config.sessionSecret, session.actorId, "liara")
          : "";
    ensure(key, "LIARA_KEY_REQUIRED", "کلید دسترسی حساب لیارا را وارد کنید.");
    try {
      return reply({
        connection: await connectLiara(config, store, session.actorId, key, request.signal),
      });
    } catch (error) {
      if (
        saved &&
        typeof error === "object" &&
        error !== null &&
        "code" in error &&
        ["LIARA_AUTH_REQUIRED", "LIARA_ACCESS_DENIED", "LIARA_TEAM_MISMATCH"].includes(
          String(error.code),
        )
      ) {
        store.saveConnection(session.actorId, {
          ...saved,
          view: { ...saved.view, status: "reauth_required" },
        });
        store.invalidateProjectApproval(session.actorId);
      }
      throw error;
    }
  });
}
