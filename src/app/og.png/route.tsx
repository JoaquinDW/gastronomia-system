import { siteOgImage } from "@/server/og-image";

export const dynamic = "force-static";

export function GET() {
  return siteOgImage();
}
