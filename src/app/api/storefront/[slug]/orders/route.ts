import { NextRequest } from "next/server";
import { checkoutInput } from "@/lib/checkout";
import { checkout } from "@/server/orders";
import {
  apiError,
  json,
  readJson,
  requestOrigin,
  sameOrigin,
} from "@/server/http";
export const runtime = "nodejs";
export async function POST(
  r: NextRequest,
  { params }: { params: Promise<{ slug: string }> },
) {
  try {
    sameOrigin(r);
    const { slug } = await params;
    const input = checkoutInput.parse(await readJson(r, 30000));
    return json(await checkout(slug, input, requestOrigin(r)!), 201);
  } catch (e) {
    return apiError(e);
  }
}
