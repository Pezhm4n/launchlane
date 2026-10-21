export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export function GET() {
  return Response.json(
    {
      service: "launchlane",
      status: "ok",
      stage: "offline_foundation",
      integrations: { liara: "unverified", model: "unverified" },
    },
    { headers: { "Cache-Control": "no-store" } },
  );
}
