import { NextRequest } from "next/server";
import { z } from "zod";
import {
  apiError,
  authorizeBusiness,
  json,
  readJson,
  sameOrigin,
} from "@/server/http";
import { orderStages } from "@/lib/checkout";
import { advanceOrder, decideOrder, listOrders } from "@/server/orders";
import { getKitchenConfig, productCategories } from "@/server/ticket";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
type Context = { params: Promise<{ id: string }> };
export async function GET(_r: Request, { params }: Context) {
  try {
    const { id } = await params;
    await authorizeBusiness(id, true);
    const [orders, categories, kitchen] = await Promise.all([
      listOrders(id),
      productCategories(id),
      getKitchenConfig(id),
    ]);
    return json({ orders, categories, kitchen });
  } catch (e) {
    return apiError(e);
  }
}
export async function POST(r: NextRequest, { params }: Context) {
  try {
    sameOrigin(r);
    const { id } = await params;
    const { user } = await authorizeBusiness(id, true);
    const target = {
      orderId: z.uuid(),
      version: z.number().int().positive(),
    };
    const body = z
      .union([
        z
          .object({ ...target, status: z.enum(["accepted", "rejected"]), preparationMinutes: z.number().int().min(5).max(180).optional() })
          .strict(),
        z.object({ ...target, stage: z.enum(orderStages) }).strict(),
      ])
      .parse(await readJson(r));
    if ("stage" in body)
      return json({
        order: await advanceOrder(id, body.orderId, body.version, body.stage),
      });
    return json({
      order: await decideOrder(
        id,
        body.orderId,
        body.version,
        body.status,
        user.id,
        body.preparationMinutes,
      ),
    });
  } catch (e) {
    return apiError(e);
  }
}
