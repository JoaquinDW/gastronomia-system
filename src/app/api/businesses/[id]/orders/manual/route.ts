import { NextRequest } from "next/server";
import {
  apiError,
  authorizeBusiness,
  json,
  readJson,
  sameOrigin,
} from "@/server/http";
import { manualOrderInput } from "@/lib/checkout";
import { createManualOrder } from "@/server/orders";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
type Context = { params: Promise<{ id: string }> };
// Counter, phone and chat orders loaded from the orders panel.
export async function POST(r: NextRequest, { params }: Context) {
  try {
    sameOrigin(r);
    const { id } = await params;
    const { user } = await authorizeBusiness(id, true);
    const input = manualOrderInput.parse(await readJson(r));
    return json({ order: await createManualOrder(id, user.id, input) }, 201);
  } catch (e) {
    return apiError(e);
  }
}
