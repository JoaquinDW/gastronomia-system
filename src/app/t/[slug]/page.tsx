import { notFound } from "next/navigation";
import { currentUser } from "@/server/auth";
import { publicStore } from "@/server/menu";
import { isStoreOpen } from "@/lib/menu";
import { Storefront } from "@/components/storefront";
export const dynamic = "force-dynamic";
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
