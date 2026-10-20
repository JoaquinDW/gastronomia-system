import { NextRequest } from "next/server";
import {
  apiError,
  authorizeBusiness,
  json,
  readJson,
  sameOrigin,
} from "@/server/http";
import { cashCommand } from "@/lib/cash";
import { getCashState, runCashCommand } from "@/server/cash";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
type Context = { params: Promise<{ id: string }> };
// Cash register shift: open, charge orders, cash in/out, void and blind close.
export async function GET(_r: Request, { params }: Context) {
  try {
    const { id } = await params;
    const { business } = await authorizeBusiness(id, true);
    return json(await getCashState(id, business.role === "owner"));
  } catch (e) {
    return apiError(e);
  }
}
export async function POST(r: NextRequest, { params }: Context) {
  try {
    sameOrigin(r);
    const { id } = await params;
    const { user } = await authorizeBusiness(id, true);
    const command = cashCommand.parse(await readJson(r, 8_000));
    return json(await runCashCommand(id, user.id, command));
  } catch (e) {
    return apiError(e);
  }
}
