# Analítica con PostHog

PostHog (US Cloud, proyecto 679060) mide el embudo landing → registro → prueba gratis y los pedidos de las tiendas. Convive con Vercel Analytics.

## Configuración

- Se inicializa en `src/instrumentation-client.ts` (Next la carga antes de hidratar, en todas las páginas y subdominios).
- La clave de proyecto (`phc_…`) es pública y va como default en `src/lib/analytics.ts`. Se puede pisar con `NEXT_PUBLIC_POSTHOG_KEY`; no hace falta cargarla en Vercel.
- En desarrollo no manda nada salvo que definas `NEXT_PUBLIC_POSTHOG_KEY` en `.env.local`.
- Cada evento lleva `environment` (`production` / `preview` / `development`, desde `NEXT_PUBLIC_VERCEL_ENV`) para filtrar los deploys de preview.
- Los envíos van por `/ingest` del mismo dominio (rewrite en `next.config.ts`, excluido del proxy en `src/proxy.ts`) para que los bloqueadores no los corten.
- La cookie se comparte entre `pedipue.com`, `app.` y las tiendas, así un visitante de la landing que se registra queda como la misma persona.

## Privacidad

- El token de `/pedido/<token>` se reemplaza por `[token]` en toda propiedad antes de enviar.
- Los links `wa.me/…?text=` pierden el `?text=` (lleva nombre, teléfono y dirección del cliente).
- No se graba la sesión en la página de seguimiento del pedido; en el resto, los inputs se enmascaran.
- Solo se crean perfiles de personas identificadas (dueños de negocio, por id de usuario y email). Los clientes de las tiendas quedan anónimos.

## Eventos

| Evento | Dónde | Propiedades |
| --- | --- | --- |
| `landing_cta_clicked` | Botones y links de la landing | `cta` (`crear_tienda`, `ver_ejemplo`, `probar_panel`, `ver_precio`, `ingresar`), `place` |
| `founders_whatsapp_clicked` | "Postulate por WhatsApp" de Socios Fundadores | |
| `signed_up` | Cuenta creada en `/registro` | |
| `logged_in` | Ingreso en `/ingresar` | |
| `trial_started` | Negocio creado en `/alta` (arranca la prueba) | `business_id`, `kind`, `city` |
| `order_placed` | Pedido guardado en una tienda | `store`, `fulfillment`, `payment_method`, `items`, `total_cents` |
| `order_whatsapp_clicked` | "Confirmar por WhatsApp" del pedido | `store`, `place` (`dialog`, `page`, `cart`) |
| `order_contact_clicked` | "Contactar por WhatsApp" después de confirmado | `store`, `place` |

Además PostHog captura solo `$pageview`, `$pageleave` y clicks (autocapture).

Para medir un click nuevo sin JS, sumá al link `data-track="evento"`; cada `data-track-algo="x"` llega como propiedad `algo: "x"`. Desde un componente cliente, `track()` de `src/lib/analytics.ts`.
