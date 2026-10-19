import { NextRequest } from "next/server";
import { z } from "zod";
import { getOrderTracking, rateOrder } from "@/server/orders";
import { apiError, json, readJson, requestOrigin, sameOrigin } from "@/server/http";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
type Context = { params: Promise<{ slug: string; token: string }> };
export async function GET(r: NextRequest, { params }: Context) {
  try {
    const { slug, token } = await params;
    const data = await getOrderTracking(slug, token, requestOrigin(r)!);
    return data ? json(data) : json({ error: "No encontramos el pedido." }, 404);
  } catch (e) { return apiError(e); }
}
export async function POST(r: NextRequest, { params }: Context) {
  try {
    sameOrigin(r);
    const { slug, token } = await params;
    const { rating } = z.object({ rating: z.number().int().min(1).max(5) }).strict().parse(await readJson(r, 1000));
    return json(await rateOrder(slug, token, rating));
  } catch (e) { return apiError(e); }
}
