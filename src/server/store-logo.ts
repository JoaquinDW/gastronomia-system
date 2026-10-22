import "server-only";
import sharp from "sharp";
import { readMenuImage } from "./menu-images";

// The store logo is always an upload (/api/media/<id>), so the server can read
// it back to draw it in the share image and on printed tickets.
async function logoBytes(url: string): Promise<Buffer | null> {
  const id = url.match(/^\/api\/media\/([0-9a-f-]{36})$/)?.[1];
  if (!id) return null;
  const image = await readMenuImage(id, "small");
  if (!image) return null;
  if ("data" in image) return image.data;
  const r = await fetch(image.url);
  return r.ok ? Buffer.from(await r.arrayBuffer()) : null;
}

/** PNG data URL for next/og, which doesn't read WebP. Null if it can't be read. */
export async function logoDataUrl(url: string, size = 256) {
  try {
    const bytes = await logoBytes(url);
    if (!bytes) return null;
    const png = await sharp(bytes)
      .resize(size, size, { fit: "inside", withoutEnlargement: true })
      .png()
      .toBuffer();
    return `data:image/png;base64,${png.toString("base64")}`;
  } catch {
    return null;
  }
}

// Thermal heads print 8 dots per mm: 576 across 80 mm paper, 384 across 58 mm.
// The logo takes a bit less than half the width, like a printed header.
export const ticketLogoBox = {
  "80": { width: 256, height: 160 },
  "58": { width: 192, height: 120 },
};

/** Black and white PNG of the logo, sized in printer dots. Width is a multiple of 8. */
export async function ticketLogo(url: string, paper: "58" | "80") {
  const bytes = await logoBytes(url);
  if (!bytes) return null;
  const box = ticketLogoBox[paper];
  const { data, info } = await sharp(bytes)
    .flatten({ background: "#ffffff" })
    .resize(box.width, box.height, { fit: "inside", withoutEnlargement: true })
    .greyscale()
    .normalise()
    .raw()
    .toBuffer({ resolveWithObject: true });
  const width = Math.ceil(info.width / 8) * 8;
  return sharp(dither(data, info.width, info.height, info.channels, width), {
    raw: { width, height: info.height, channels: 1 },
  })
    .png({ colours: 2, palette: true })
    .toBuffer();
}

// Floyd–Steinberg: mid tones become dot patterns, so a colored logo keeps
// its shapes instead of turning into a solid black block. Pads with white.
function dither(
  grey: Buffer,
  width: number,
  height: number,
  channels: number,
  outWidth: number,
) {
  const level = new Float32Array(width * height);
  for (let i = 0; i < level.length; i++) level[i] = grey[i * channels];
  const out = Buffer.alloc(outWidth * height, 255);
  for (let y = 0; y < height; y++)
    for (let x = 0; x < width; x++) {
      const i = y * width + x;
      const black = level[i] < 128;
      const error = level[i] - (black ? 0 : 255);
      if (black) out[y * outWidth + x] = 0;
      if (x + 1 < width) level[i + 1] += (error * 7) / 16;
      if (y + 1 < height) {
        if (x > 0) level[i + width - 1] += (error * 3) / 16;
        level[i + width] += (error * 5) / 16;
        if (x + 1 < width) level[i + width + 1] += error / 16;
      }
    }
  return out;
}
