import { NextRequest } from "next/server";
import { productInput } from "@/lib/menu";
import { getProducts, getSettings, saveProduct } from "@/server/menu";
import {
  apiError,
  authorizeBusiness,
  json,
  readJson,
  sameOrigin,
} from "@/server/http";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
type Context = { params: Promise<{ id: string }> };
export async function GET(_r: Request, { params }: Context) {
  try {
    const { id } = await params;
    await authorizeBusiness(id);
    const [products, settings] = await Promise.all([
      getProducts(id),
      getSettings(id),
    ]);
    return json({
      products,
      settings,
      aiAvailable: Boolean(process.env.OPENAI_API_KEY),
    });
  } catch (e) {
    return apiError(e);
  }
}
export async function POST(request: NextRequest, { params }: Context) {
  try {
    sameOrigin(request);
    const { id } = await params;
    await authorizeBusiness(id, true);
    const input = productInput.parse(await readJson(request));
    return json({ product: await saveProduct(id, input) }, 201);
  } catch (e) {
    return apiError(e);
  }
}
