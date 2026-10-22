import type { Metadata } from "next";
import { headers } from "next/headers";
import { notFound, redirect } from "next/navigation";
import { storeUrl } from "@/lib/hosts";
import { renamedSlug } from "@/server/business-hosts";
import { getOrderTracking } from "@/server/orders";
import { OrderTracking } from "@/components/order-tracking";
import "./tracking.css";

export const dynamic = "force-dynamic";
export const metadata: Metadata = {
  title: "Seguí tu pedido — Pedipue",
  robots: { index: false, follow: false },
  referrer: "no-referrer",
};
export default async function TrackingPage({ params, searchParams }: {
  params: Promise<{ slug: string; token: string }>;
  searchParams: Promise<{ confirm?: string }>;
}) {
  const [{ slug, token }, query, h] = await Promise.all([params, searchParams, headers()]);
  const origin = `${h.get("x-forwarded-proto") ?? "http"}://${h.get("host") ?? "localhost:3000"}`;
  const data = await getOrderTracking(slug, token, origin);
  if (!data) {
    const moved = await renamedSlug(slug);
    if (moved)
      redirect(`${storeUrl(moved)}/pedido/${encodeURIComponent(token)}${query.confirm === "1" ? "?confirm=1" : ""}`);
    notFound();
  }
  return <OrderTracking initial={JSON.parse(JSON.stringify(data))} confirm={query.confirm === "1"} />;
}
