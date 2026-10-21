import posthog from "posthog-js";
import {
  analyticsEnabled,
  isOrderTrackingPath,
  posthogKey,
  redactUrls,
  track,
} from "@/lib/analytics";

if (analyticsEnabled()) {
  posthog.init(posthogKey, {
    // Pasa por /ingest (rewrite en next.config.ts) para que no lo frenen los bloqueadores.
    api_host: "/ingest",
    ui_host: "https://us.posthog.com",
    defaults: "2026-08-30",
    person_profiles: "identified_only",
    session_recording: { maskAllInputs: true },
    before_send: (event) => {
      if (!event) return event;
      for (const bag of [event.properties, event.$set, event.$set_once]) {
        if (!bag) continue;
        for (const [key, value] of Object.entries(bag))
          if (typeof value === "string") bag[key] = redactUrls(value);
      }
      return event;
    },
    loaded: (ph) => {
      ph.register({ environment: process.env.NEXT_PUBLIC_VERCEL_ENV ?? process.env.NODE_ENV });
      // Las grabaciones guardan la URL completa: no grabar el seguimiento del pedido.
      if (isOrderTrackingPath(location.pathname)) ph.stopSessionRecording();
    },
  });

  // Clicks declarativos: <a data-track="evento" data-track-cta="hero"> funciona
  // también en componentes de servidor (la landing). Cada data-track-x va como
  // propiedad x del evento.
  document.addEventListener(
    "click",
    (event) => {
      const target = (event.target as Element | null)?.closest?.<HTMLElement>("[data-track]");
      if (!target?.dataset.track) return;
      const properties: Record<string, string> = {};
      for (const [key, value] of Object.entries(target.dataset)) {
        if (key === "track" || !key.startsWith("track") || value === undefined) continue;
        const name = key.slice("track".length);
        properties[name[0].toLowerCase() + name.slice(1).replace(/[A-Z]/g, (c) => `_${c.toLowerCase()}`)] = value;
      }
      track(target.dataset.track, properties, { beforeNavigation: true });
    },
    { capture: true },
  );
}
