import { NextRequest } from "next/server";
import { z } from "zod";
import {
  apiError,
  authorizeBusiness,
  json,
  readJson,
  sameOrigin,
} from "@/server/http";
import { decideOrder, listOrders } from "@/server/orders";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
type Context = { params: Promise<{ id: string }> };
export async function GET(_r: Request, { params }: Context) {
  try {
    const { id } = await params;
    await authorizeBusiness(id, true);
    return json({ orders: await listOrders(id) });
  } catch (e) {
    return apiError(e);
  }
}
export async function POST(r: NextRequest, { params }: Context) {
  try {
    sameOrigin(r);
    const { id } = await params;
    await authorizeBusiness(id, true);
    const body = z
      .object({
        orderId: z.uuid(),
        version: z.number().int().positive(),
        status: z.enum(["accepted", "rejected"]),
      })
      .strict()
      .parse(await readJson(r));
    return json({
      order: await decideOrder(id, body.orderId, body.version, body.status),
    });
  } catch (e) {
    return apiError(e);
  }
}
