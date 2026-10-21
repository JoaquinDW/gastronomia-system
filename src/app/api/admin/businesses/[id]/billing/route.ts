import { NextRequest } from "next/server";
import { z } from "zod";
import { currentUser } from "@/server/auth";
import { updateBilling } from "@/server/billing";
import { HttpError, apiError, json, readJson, sameOrigin } from "@/server/http";
import { isSuperadminEmail } from "@/server/superadmin";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
type Context = { params: Promise<{ id: string }> };
const input = z.discriminatedUnion("action", [
  z.object({ action: z.literal("add_month") }).strict(),
  z.object({ action: z.literal("extend_trial") }).strict(),
  z.object({ action: z.literal("set_exempt"), exempt: z.boolean() }).strict(),
]);
export async function POST(r: NextRequest, { params }: Context) {
  try {
    sameOrigin(r);
    const user = await currentUser();
    if (!isSuperadminEmail(user?.email))
      throw new HttpError(404, "No encontramos la página.");
    const { id } = await params;
    if (!z.uuid().safeParse(id).success)
      throw new HttpError(404, "No encontramos el negocio.");
    await updateBilling(id, input.parse(await readJson(r)));
    return json({ ok: true });
  } catch (e) {
    return apiError(e);
  }
}
