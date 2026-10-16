import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { businessKinds } from "@/lib/business-input";
import { storeUrl } from "@/lib/hosts";
import { publishedStoreCard } from "@/server/menu";
import { currentUser } from "@/server/auth";
import { publicStore } from "@/server/menu";
import { isStoreOpen } from "@/lib/menu";
import { Storefront } from "@/components/storefront";
export const dynamic = "force-dynamic";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const store = await publishedStoreCard(slug);
  if (!store) return { title: "Tienda — Pedipue" };
  const kind = businessKinds.find((k) => k.value === store.kind);
  const place = [kind?.value === "otro" ? "" : kind?.label, store.city]
    .filter(Boolean)
    .join(" en ");
  const title = `${store.name} — pedí online`;
  const description =
    store.description?.trim() ||
    `${place ? `${place}. ` : ""}Mirá la carta y mandá tu pedido directo por WhatsApp.`;
  const url = storeUrl(slug);
  return {
    title,
    description,
    alternates: { canonical: url },
    openGraph: {
      type: "website",
      siteName: "Pedipue",
      locale: "es_AR",
      url,
      title,
      description,
      images: [
        {
          url: `${url}/og`,
          width: 1200,
          height: 630,
          alt: `${store.name}: pedí online en Pedipue`,
        },
      ],
    },
    twitter: { card: "summary_large_image", title, description },
  };
}
export default async function ShopPage({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ preview?: string }>;
}) {
  const { slug } = await params;
  const preview = (await searchParams).preview === "1";
  const user = preview ? await currentUser() : null;
  const store = await publicStore(slug, user?.id);
  if (!store) notFound();
  return (
    <Storefront
      {...store}
      initialOpen={isStoreOpen(
        store.settings.hours,
        new Date(),
        store.business.timezone,
      )}
      preview={preview}
    />
  );
}
