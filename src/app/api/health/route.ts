export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export function GET() {
  return Response.json(
    {
      service: "launchlane",
      status: "ok",
      stage: "preparation",
      integrations: { liara: "unverified", model: "unconfigured" },
    },
    { headers: { "Cache-Control": "no-store" } },
  );
}
