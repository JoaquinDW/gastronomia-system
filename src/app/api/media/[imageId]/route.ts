import { z } from "zod";
import { readMenuImage } from "@/server/menu-images";
export const runtime = "nodejs";
type Context = { params: Promise<{ imageId: string }> };
export async function GET(request: Request, { params }: Context) {
  const { imageId } = await params;
  if (!z.uuid().safeParse(imageId).success)
    return new Response(null, { status: 404 });
  const size =
    new URL(request.url).searchParams.get("size") === "small"
      ? "small"
      : "large";
  try {
    const data = await readMenuImage(imageId, size);
    if (!data) return new Response(null, { status: 404 });
    return new Response(new Uint8Array(data), {
      headers: {
        "Content-Type": "image/webp",
        // Each upload gets a new id, so the bytes behind a URL never change.
        "Cache-Control": "public, max-age=31536000, immutable",
        "X-Content-Type-Options": "nosniff",
      },
    });
  } catch {
    return new Response(null, {
      status: 503,
      headers: { "Cache-Control": "no-store" },
    });
  }
}
