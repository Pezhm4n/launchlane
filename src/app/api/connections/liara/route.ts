import { exactKeys, object, string } from "../../../../contracts/validation.ts";
import { connectLiara } from "../../../../server/connections/liara.ts";
import { ensure } from "../../../../server/errors.ts";
import { endpoint, jsonBody, reply } from "../../../../server/http.ts";
import { openCredential } from "../../../../server/connections/credentials.ts";

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
    store.disconnectConnection(session.actorId, "liara");
    return reply({ disconnected: true, providerRevoked: false });
  });
}
export async function POST(request: Request) {
  return endpoint(request, true, async ({ config, store, session }) => {
    const input = object(await jsonBody(request)),
      operation = string(input.operation, 16);
    ensure(
      ["connect", "refresh", "select"].includes(operation),
      "INVALID_OPERATION",
      "این درخواست اتصال پشتیبانی نمی‌شود.",
    );
    exactKeys(input, [
      "operation",
      ...(operation === "connect" ? ["key"] : operation === "select" ? ["app"] : []),
    ]);
    const saved = store.getConnection(session.actorId, "liara");
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
      )
        store.saveConnection(session.actorId, {
          ...saved,
          view: { ...saved.view, status: "reauth_required" },
        });
      throw error;
    }
  });
}
