import { NextRequest } from "next/server";
import { apiError, authorizeBusiness, HttpError } from "@/server/http";
import { getSettings } from "@/server/menu";
import { ticketLogo } from "@/server/store-logo";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
type Context = { params: Promise<{ id: string }> };
// The logo for the customer ticket, already in black and white at printer size.
// Same origin, so the orders screen can read its pixels for the USB printer.
export async function GET(r: NextRequest, { params }: Context) {
  try {
    const { id } = await params;
    await authorizeBusiness(id);
    const paper = r.nextUrl.searchParams.get("paper") === "58" ? "58" : "80";
    const { logoImageUrl } = await getSettings(id);
    const png = logoImageUrl ? await ticketLogo(logoImageUrl, paper) : null;
    if (!png) throw new HttpError(404, "El negocio no tiene logo.");
    return new Response(new Uint8Array(png), {
      headers: {
        "Content-Type": "image/png",
        // The URL carries the logo's id, so a new logo is a new URL.
        "Cache-Control": "private, max-age=86400",
        "X-Content-Type-Options": "nosniff",
      },
    });
  } catch (e) {
    return apiError(e);
  }
}
