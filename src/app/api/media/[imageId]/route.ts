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
    const image = await readMenuImage(imageId, size);
    if (!image) return new Response(null, { status: 404 });
    // Photos in Object Storage: send the browser to the public file. The CDN keeps the redirect.
    if ("url" in image)
      return new Response(null, {
        status: 308,
        headers: {
          Location: image.url,
          "Cache-Control":
            "public, max-age=31536000, s-maxage=31536000, immutable",
        },
      });
    return new Response(new Uint8Array(image.data), {
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
