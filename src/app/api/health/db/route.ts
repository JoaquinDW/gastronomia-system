import { getPool } from "@/server/postgres";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const headers = { "Cache-Control": "no-store" };

export async function GET() {
  try {
    const { rows } = await getPool().query<{ ok: number }>("SELECT 1 AS ok");
    if (rows[0]?.ok !== 1) throw new Error("Unexpected health result");
    return Response.json({ status: "ok", service: "postgres" }, { headers });
  } catch {
    return Response.json(
      { status: "unavailable", service: "postgres" },
      { status: 503, headers },
    );
  }
}
