import { NextRequest } from "next/server";
import { z } from "zod";
import { settingsInput } from "@/lib/menu";
import { getSettings, publishStore, saveSettings } from "@/server/menu";
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
    return json({ settings: await getSettings(id) });
  } catch (e) {
    return apiError(e);
  }
}
export async function PUT(r: NextRequest, { params }: Context) {
  try {
    sameOrigin(r);
    const { id } = await params;
    await authorizeBusiness(id, true);
    const body = z
      .object({ settings: settingsInput, version: z.number().int().min(0) })
      .strict()
      .parse(await readJson(r));
    return json({
      settings: await saveSettings(id, body.settings, body.version),
    });
  } catch (e) {
    return apiError(e);
  }
}
export async function POST(r: NextRequest, { params }: Context) {
  try {
    sameOrigin(r);
    const { id } = await params;
    await authorizeBusiness(id, true);
    const { publish } = z
      .object({ publish: z.boolean() })
      .strict()
      .parse(await readJson(r));
    return json({ settings: await publishStore(id, publish) });
  } catch (e) {
    return apiError(e);
  }
}
