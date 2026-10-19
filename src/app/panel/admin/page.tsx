import { AutoRefresh } from "@/components/auto-refresh";
import { SuperadminOverview } from "@/components/superadmin-overview";
import { adminOverview } from "@/server/admin-overview";
import { requireSuperadmin } from "@/server/superadmin";
import "./admin.css";

export const metadata = { title: "Superadmin — Pedipue", robots: "noindex" };

export default async function AdminPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string | string[] }>;
}) {
  await requireSuperadmin();
  const [{ q }, overview] = await Promise.all([searchParams, adminOverview()]);
  return (
    <>
      <AutoRefresh seconds={60} />
      <SuperadminOverview
        overview={overview}
        query={typeof q === "string" ? q.slice(0, 100) : ""}
        now={Date.now()}
      />
    </>
  );
}
