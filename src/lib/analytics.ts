"use client";

import posthog from "posthog-js";

// La clave de proyecto de PostHog es pública (va al navegador igual que en el
// snippet oficial). Se puede pisar con NEXT_PUBLIC_POSTHOG_KEY.
export const posthogKey =
  process.env.NEXT_PUBLIC_POSTHOG_KEY ||
  "phc_uyemnCZfu4D6VcjsTyaHVZrjE9D2VvBBdxeEu4hGKsMi";

// Los links de seguimiento de pedidos son links con permiso (quien lo tiene ve
// el pedido): el token nunca sale hacia terceros. Los links de WhatsApp llevan
// el pedido armado (nombre, teléfono, dirección) en ?text=: se saca también.
const orderToken = /(\/pedido\/)[^/?#\s"';]+/g;
const whatsappText = /(wa\.me\/\d*)\?[^"'\s;]*/g;
export const redactUrls = (value: string) =>
  value.replace(orderToken, "$1[token]").replace(whatsappText, "$1");
export const isOrderTrackingPath = (path: string) => /\/pedido\//.test(path);

export function analyticsEnabled() {
  return (
    process.env.NODE_ENV === "production" ||
    Boolean(process.env.NEXT_PUBLIC_POSTHOG_KEY)
  );
}

type Props = Record<string, string | number | boolean | null | undefined>;

export function track(
  event: string,
  properties?: Props,
  // Para eventos justo antes de cambiar de página: no esperar al lote.
  { beforeNavigation = false } = {},
) {
  if (!analyticsEnabled()) return;
  posthog.capture(
    event,
    properties,
    beforeNavigation ? { send_instantly: true, transport: "sendBeacon" } : undefined,
  );
}

export function identify(user: { id: string; email: string; name?: string }) {
  if (!analyticsEnabled()) return;
  if (posthog.get_distinct_id() === user.id) return;
  posthog.identify(user.id, { email: user.email, name: user.name });
}

export function resetAnalytics() {
  if (analyticsEnabled()) posthog.reset();
}
