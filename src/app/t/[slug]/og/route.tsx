import { businessKinds } from "@/lib/business-input";
import { rootDomain } from "@/lib/hosts";
import { publishedStoreCard } from "@/server/menu";
import { storeOgImage } from "@/server/og-image";
import { logoDataUrl } from "@/server/store-logo";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ slug: string }> },
) {
  const { slug } = await params;
  const store = await publishedStoreCard(slug);
  if (!store) return new Response("Not found", { status: 404 });
  const kind = businessKinds.find((k) => k.value === store.kind);
  return storeOgImage({
    name: store.name,
    kind: kind && kind.value !== "otro" ? kind.label : "",
    city: store.city,
    host: `${slug}.${rootDomain() || "pedipue.com"}`,
    logo: store.logoImageUrl ? await logoDataUrl(store.logoImageUrl) : null,
  });
}
