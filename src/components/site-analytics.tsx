"use client";
import { Analytics } from "@vercel/analytics/next";

export function SiteAnalytics() {
  return <Analytics beforeSend={event => {
    // Order URLs are bearer links: keep them out of third-party analytics.
    return new URL(event.url).pathname.includes("/pedido/") ? null : event;
  }} />;
}
