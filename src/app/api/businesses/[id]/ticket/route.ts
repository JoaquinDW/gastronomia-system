import { NextRequest } from "next/server";
import { z } from "zod";
import { ticketConfigInput } from "@/lib/ticket";
import { saveTicketConfig } from "@/server/ticket";
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
    const { ticket } = z
      .object({ ticket: ticketConfigInput })
      .strict()
      .parse(await readJson(r));
    return json({ ticket: await saveTicketConfig(id, ticket) });
  } catch (e) {
    return apiError(e);
  }
}
