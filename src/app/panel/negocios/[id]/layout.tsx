import { panelBase, rootDomain } from "@/lib/hosts";
import { PanelBaseProvider } from "@/components/panel-base";
import { businessSlugForId } from "@/server/business-hosts";

export default async function BusinessLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const slug = rootDomain() ? ((await businessSlugForId(id)) ?? "") : "";
  return (
    <PanelBaseProvider base={panelBase(id, slug)}>{children}</PanelBaseProvider>
  );
}
