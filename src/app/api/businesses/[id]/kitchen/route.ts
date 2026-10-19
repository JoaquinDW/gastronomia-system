import { NextRequest } from "next/server";
import { z } from "zod";
import { kitchenConfigInput } from "@/lib/kitchen";
import { saveKitchenConfig } from "@/server/ticket";
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
export async function PUT(r: NextRequest, { params }: Context) {
  try {
    sameOrigin(r);
    const { id } = await params;
    await authorizeBusiness(id, true);
    const { kitchen } = z
      .object({ kitchen: kitchenConfigInput })
      .strict()
      .parse(await readJson(r));
    return json({ kitchen: await saveKitchenConfig(id, kitchen) });
  } catch (e) {
    return apiError(e);
  }
}
