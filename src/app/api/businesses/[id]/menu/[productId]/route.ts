import { NextRequest } from "next/server";
import { z } from "zod";
import { productInput } from "@/lib/menu";
import { archiveProduct, saveProduct } from "@/server/menu";
import {
  apiError,
  authorizeBusiness,
  json,
  readJson,
  sameOrigin,
} from "@/server/http";
export const runtime = "nodejs";
type Context = { params: Promise<{ id: string; productId: string }> };
export async function PUT(r: NextRequest, { params }: Context) {
  try {
    sameOrigin(r);
    const { id, productId } = await params;
    await authorizeBusiness(id, true);
    z.uuid().parse(productId);
    const body = z
      .object({ product: productInput, version: z.number().int().positive() })
      .strict()
      .parse(await readJson(r));
    return json({
      product: await saveProduct(id, body.product, productId, body.version),
    });
  } catch (e) {
    return apiError(e);
  }
}
export async function DELETE(r: NextRequest, { params }: Context) {
  try {
    sameOrigin(r);
    const { id, productId } = await params;
    await authorizeBusiness(id, true);
    z.uuid().parse(productId);
    const { version } = z
      .object({ version: z.number().int().positive() })
      .strict()
      .parse(await readJson(r));
    await archiveProduct(id, productId, version);
    return json({ ok: true });
  } catch (e) {
    return apiError(e);
  }
}
