# Seguimiento de pedidos

Al confirmar el carrito, el pedido se guarda y el cliente llega a `/t/<slug>/pedido/<token>?confirm=1`. Con dominios por tienda, el enlace es `https://<slug>.<dominio>/pedido/<token>`. Un diálogo explica cómo enviar el resumen por WhatsApp. El mismo enlace queda incluido en el mensaje; abrir WhatsApp no cambia el estado ni verifica el pago.

La pantalla muestra el estado, detalle y precios guardados, envío, dirección o instrucciones de retiro, alias para transferencias y contacto. Las fotos se guardan con las nuevas líneas de pedido; los pedidos antiguos usan un ícono. El alias y las instrucciones de retiro reflejan la configuración actual del local.

## Estados y operación

- Pendiente → aceptado (en preparación) o rechazado.
- En preparación → listo.
- Delivery: listo → en camino → entregado.
- Retiro: listo → entregado.
- La anulación existente en Gestión sigue reflejándose como pedido anulado.

El panel permite indicar entre 10 y 90 minutos al aceptar; la API admite de 5 a 180. Sin estimación no se inventa un horario. La hora mostrada es de preparación, en la zona horaria del negocio, no de llegada del repartidor.

Se conserva el modelo de `main`: aceptación y anulación en `status`, y preparación, listo, en camino y entregado en `stage`. Los enlaces existentes con `tracking_token` siguen funcionando.

Las transiciones requieren sesión y pertenencia al negocio, verifican versión y estado bajo bloqueo, y solo la aceptación registra la venta. Avanzar la preparación no vuelve a descontar inventario ni registra otra venta.

El seguimiento consulta cada 10 segundos mientras la pestaña es visible. Pausa al ocultarse, reintenta al recuperar conexión y finaliza al entregar, rechazar o anular. Los errores de red se muestran sin descartar el último estado conocido. No es una suscripción por WebSocket.

Después de entregar, el cliente puede guardar o cambiar una calificación de 1 a 5 estrellas. La calificación aparece también en Pedidos.

## Pedidos de mostrador, teléfono y WhatsApp

**Nuevo pedido**, en la barra de Pedidos, carga lo que no entra por la tienda. Se elige la carta (presentación, adicionales y opciones obligatorias igual que en la tienda), el canal (Mostrador, Teléfono o WhatsApp), nombre y teléfono opcionales, retiro o delivery, pago, tiempo de preparación y nota para la cocina.

- El servidor vuelve a calcular los precios desde la carta y rechaza productos no disponibles o precios cambiados, como en el checkout.
- El pedido nace **aceptado y en preparación**, con la venta registrada en Gestión dentro de la misma transacción y los insumos descontados. La venta conserva el canal (`counter`, `phone`, `whatsapp`) para el reporte por canal.
- Comparte la numeración con la tienda, aparece en la bandeja, imprime comanda y ticket con la impresión automática configurada y tiene link de seguimiento. Sin teléfono no se ofrece mandar el seguimiento por WhatsApp.
- Delivery: una zona guardada fija nombre y tarifa; **Otro importe** permite escribir el envío. El mínimo de la zona y el horario de la tienda no se aplican: es una decisión del local.
- No requiere la tienda publicada ni configurada. `requestKey` evita duplicados ante doble toque o reintento.
- Endpoint privado `POST /api/businesses/:id/orders/manual`, para propietario o encargado.

## Semáforo y modo cocina

Cada pedido en preparación se pinta contra la demora prometida al aceptarlo (`estimated_ready_at`): verde a tiempo, amarillo cuando faltan pocos minutos y rojo cuando ya se pasó. Si se aceptó sin estimación, cuenta una demora por defecto. Las dos cifras se configuran en **Tiempos** y se guardan para todo el local en `store_settings.kitchen_config` (20 y 5 minutos de entrada). Los contadores usan la hora del servidor (encabezado `Date` de cada actualización), así una tablet con la hora mal igual pinta bien.

**Modo cocina** abre la misma bandeja a pantalla completa para una tablet: solo lo que está en preparación, del más urgente al menos urgente, letra grande, botón "Listo" grande, sin precios ni teléfonos, aviso de pedidos nuevos sin aceptar y la fila de listos para entregar. Mantiene la pantalla encendida donde el navegador lo permite. Con `?cocina=1` en la dirección de Pedidos abre directo en ese modo, para dejarlo como favorito.

## Privacidad

El token aleatorio existente del pedido funciona como enlace de acceso: quien lo tenga podrá consultar el pedido. Todas las consultas también verifican el slug del local; no existe consulta pública por número consecutivo. La respuesta pública omite teléfono, coordenadas y datos internos. El mensaje de WhatsApp sí contiene los datos necesarios para que el local procese la compra. Las páginas llevan `noindex` y `no-referrer`; el endpoint no usa caché y las visitas a seguimiento se excluyen de Analytics. La calificación exige el mismo origen.

## Base de datos y despliegue

La migración `0010_fancy_gladiator.sql` agrega `estimated_ready_at`, `rating` y un check entre 1 y 5. Ejecutar las migraciones pendientes antes de desplegar este código. Conserva el historial de migraciones anterior, incluida `0009` de delivery. La migración se validó en una rama aislada y se aplicó a producción el 19 de octubre de 2026 antes de subir el código a `main`.

La migración `0012_order_channel.sql` agrega `orders.channel` (`store` por defecto para los pedidos existentes) y suma `phone` a los canales de `management_sales`.

La migración `0013_kitchen_config.sql` agrega `store_settings.kitchen_config` con valores por defecto, sin tocar datos existentes.

## Validación

- `npm run test:kitchen`: colores del semáforo, demora por defecto, orden por urgencia y límites de la configuración.

- `npm run test:tracking`: estados, enlaces por dominio y resumen de WhatsApp.
- `npm run test:tracking:db`: requiere `GASTRONOMIA_ENV_FILE`, `TRACKING_TEST_HOST` y una `NEON_BRANCH` de prueba. Genera pedidos sintéticos y prueba aislamiento, reintentos, ETA, cambios de estado, registro único de venta y calificación. `TRACKING_FIXTURE_FILE` guarda los identificadores para el navegador.
- `npm run test:manual` y `npm run test:manual:db` (este con `GASTRONOMIA_ENV_FILE`, `MANUAL_TEST_HOST` y una `NEON_BRANCH` de prueba): pedidos de mostrador, teléfono y WhatsApp, venta única ante reintentos, envíos, validaciones, aislamiento entre negocios y numeración compartida con la tienda.
- `npm run test:tracking:browser`: usa los mismos datos y variables, más `APP_URL` de localhost. Prueba compra y redirección, diálogo, copiar alias, polling, rating persistente, falta de sesión, aislamiento por tienda, CSRF y tamaños 320/390/1280 px. Guarda capturas en `/tmp/pedipue-tracking-review`. No envía mensajes de WhatsApp.

La suite general contiene una prueba previa incompatible con el checkout actual: espera que el teléfono sea opcional. No se cambió esa política en esta funcionalidad.
