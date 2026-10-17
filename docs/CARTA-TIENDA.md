# Carta, activación de tienda y checkout

Entrega del 16 de octubre de 2026. Continúa el alta autogestionada de negocios. Cada propietario configura sus propios datos; los negocios existentes conservan su carta vacía y su tienda privada hasta que los configuren y activen.

## Recorrido

1. Abrir el negocio desde `/panel` y elegir **Carta**.
2. Agregar productos manualmente o elegir **Importar con IA**. La carga manual permite categorías, ingredientes, promociones, variantes con precio, adicionales opcionales y foto. La foto se sube desde el editor (JPG, PNG o WEBP, mínimo 600 px por lado): el navegador la achica antes de subirla y el servidor la normaliza a WebP en 1600 px y 800 px, guardada en Neon Object Storage (bucket público `pedipue-media`; los datos de cada foto quedan en la tabla `menu_images`) y servida en `/api/media/<id>`, que redirige al archivo con caché permanente. Sin credenciales de storage (desarrollo local) los bytes se guardan en `menu_images` como antes. También se puede pegar un enlace HTTPS. Los productos se pueden editar, pausar, reactivar y archivar.
3. En **Tienda**, configurar presentación, aclaraciones, horarios, retiro/delivery y medios de pago. Se admiten varios turnos por día y cierres después de medianoche en horario de Argentina. La importación puede sugerir horarios, pero aplicarlos requiere una acción del usuario.
4. Revisar la vista previa privada. **Guardar y activar tienda** publica la tienda (`slug.pedipue.com`, o `/t/:slug` sin dominio configurado) únicamente después de guardar una configuración válida y tener al menos un producto disponible. Pausar la tienda retira el acceso público. Una tienda activa no permite guardar horarios vacíos ni eliminar todas las modalidades de entrega.
5. El cliente arma su carrito, elige retiro o zona de delivery y completa sus datos. El servidor guarda el pedido pendiente y devuelve un enlace de WhatsApp con el resumen. El cliente todavía debe abrir ese enlace y enviar el mensaje.
6. En **Pedidos**, el negocio puede aceptar o rechazar. El pago continúa pendiente de verificación manual. Con [Gestión](./GESTION.md), aceptar registra la venta y consume los insumos configurados; todavía no genera comandas ni reservas separadas de cocina.

El delivery tiene tarifa y compra mínima por zona seleccionada por el cliente. El negocio verifica la dirección antes de aceptar; no hay cálculo de distancia, geocodificación ni asignación de repartidor. Si se deshabilita retiro, la dirección del local no se incluye en la respuesta pública.

## Importación con OpenAI

Agregar `OPENAI_API_KEY` en `.env.local` y reiniciar la app. No pegar la clave en chats ni usar una variable `NEXT_PUBLIC_`. La carga manual funciona sin esa clave. `OPENAI_MENU_MODEL` permite cambiar el modelo; el predeterminado es **gpt-5.4-mini**, que admite visión y respuestas estructuradas según [OpenAI Docs](https://developers.openai.com/api/docs/models/gpt-5.4-mini).

La implementación usa Responses API, esquema estructurado validado con Zod, razonamiento `low`, `store: false`, timeout de 90 segundos y sin reintentos automáticos facturables. Se registran modelo y tokens por importación. El límite es 20 análisis por negocio y 50 por cuenta en 24 horas, con un análisis activo por negocio. El límite por cuenta es preventivo; solicitudes simultáneas desde negocios diferentes podrían compartir la misma ventana de conteo.

Se aceptan hasta cinco PNG/JPG/WEBP/PDF, ocho MB por archivo y doce MB por solicitud, o texto de hasta 30.000 caracteres. Las imágenes se validan por contenido, se orientan, se eliminan sus metadatos y se limita su resolución conservando texto pequeño. No se guardan los originales en Postgres. Los archivos seleccionados y el texto se envían a OpenAI para el análisis; los borradores estructurados quedan guardados en Neon.

La IA distingue precios argentinos (`$6.500` = 6500 pesos), precios decimales, variantes por peso/docena y promociones con precio total. Los precios ausentes quedan sin completar; no se inventan importes, ingredientes, horarios ni costos de envío. La comparación entre precio normalizado y texto original agrega una advertencia si encuentra una inconsistencia.

**La extracción requiere revisión humana.** Antes de guardar, el usuario puede editar nombres, ingredientes, categorías, variantes, precios y aclaraciones, o excluir filas. Los productos con precio desconocido necesitan completarse o desmarcarse. Se exige marcar la revisión de nombres, precios y promociones. Una importación confirmada se guarda una sola vez; los nombres ya existentes se omiten y no se sobrescriben. Los últimos borradores listos se pueden retomar desde la carta.

La imagen de BodoBurgers adjunta se usa como evaluación de referencia: seis sándwiches, papas y una promoción, con precios 6500, 8500, 9000, 11000, 14000, 9000, 4500 y 15000 pesos. La promo es una sola oferta de dos especiales por 15000. La prueba también exige conservar la nota de papas incluidas y los horarios de martes a domingo de 20:00 a 00:00. Este resultado esperado está escrito a mano a partir de la imagen; no es evidencia de una llamada exitosa al modelo.

## Persistencia y controles

La migración `0001_menu_storefront.sql` incorpora `menu_products`, `store_settings`, `menu_imports` y `orders`. Se probó primero en `dev-menu-storefront` (`br-blue-union-b57aehxv`), hija de producción, con vencimiento el 17 de octubre de 2026 a las 13:32 UTC. Sus credenciales están en un archivo temporal separado; `.env.local` conserva producción.

Tras las pruebas aisladas se aplicó a `production`: `npm run db:migrate` terminó con `migrations applied successfully!`, código 0. No se modificaron cartas ni se activaron tiendas existentes. La app principal se reinició en `http://127.0.0.1:3000` (`Ready in 69ms`) y se comprobó en el navegador la nueva sección Carta del negocio ya registrado.

Las mutaciones de carta, importación, configuración y pedidos exigen sesión y pertenencia con rol propietario o encargado. Los clientes públicos no pueden consultar pedidos ni datos de otros clientes. Las escrituras validan mismo origen, tamaño del cuerpo y esquema; las consultas son parametrizadas. La vista previa obtiene la identidad del servidor y permanece inaccesible para un visitante anónimo.

El checkout recalcula precios, adicionales, mínimos y envío desde la base; no acepta totales del navegador. Verifica publicación, horarios y disponibilidad dentro de una transacción que bloquea el negocio y asigna un número correlativo. Los pedidos conservan una copia de los ítems/precios del momento. La clave de idempotencia y el hash del contenido evitan duplicados en reintentos de una misma solicitud. Las ediciones y decisiones de pedidos usan versiones para rechazar cambios obsoletos.

## Verificación

Build final probado:

```text
$ npm run build
✓ Compiled successfully in 1149ms
  Finished TypeScript in 777ms ...
✓ Generating static pages using 11 workers (3/3) in 70ms
```

Código de salida 0; incluye las nuevas rutas de carta, importación, tienda pública, pedidos y configuración. `npm run test:menu` terminó con cuatro pruebas aprobadas sobre importes exactos, horarios nocturnos, turnos superpuestos y validación de pagos/zonas. La auditoría de dependencias reportó `found 0 vulnerabilities`.

`npm run typecheck`, `npm run test:db` y `npm run test:e2e` terminaron con código 0 después de actualizar producción. La prueba de DB usa operaciones temporales y rollback; la prueba HTTP confirmó el recorrido real de la app a Postgres:

```text
PASS: application pooled connection reads from Postgres
PASS: parameterized INSERT, SELECT, UPDATE and DELETE on a temporary table
PASS: rollback verified; no test table or test rows remain
PASS: GET / returns 200 and the planning page without connection secrets
PASS: GET /api/health/db returns 200 {"status":"ok","service":"postgres"} with no-store
PASS: running app -> route handler -> Neon Postgres -> HTTP response
```

El navegador se prueba contra Auth y Postgres reales en la rama aislada:

```sh
APP_URL=http://127.0.0.1:3001 TEST_STOREFRONT=1 npm run test:storefront
```

La prueba comprueba carga manual desde el formulario, pausa/reactivación, ediciones obsoletas, privacidad y activación, carrito móvil persistente, checkout con adicionales/envío, resumen de WhatsApp, reintentos concurrentes, importes alterados, compra mínima, aceptación de pedidos, aislamiento entre cuentas, local cerrado y pausa de tienda. No envía mensajes de WhatsApp. Capturas revisadas en `/tmp/gastronomia-carta-desktop.png`, `/tmp/gastronomia-tienda-config.png` y `/tmp/gastronomia-tienda-mobile.png`.

Salida real, código 0:

```text
PASS: manual menu UI stores variants and extras, parses Argentine prices, pauses/restores products and rejects stale edits
PASS: unpublished stores/preview protected; configuration persists; explicit activation makes store public
PASS: mobile cart survives reload; real checkout calculates extras/delivery, persists pending order, builds WhatsApp draft and rejects tampered prices/duplicate orders
PASS: order decision is protected against stale changes; other accounts cannot read/change menu, imports, settings or customers
PASS: closed hours prevent new checkout; pausing the store removes public access
```

También se volvió a ejecutar `test:onboarding` contra la rama aislada: seis verificaciones aprobadas de registro, sesión, alta, reintentos, separación entre cuentas y logout/login, código 0.

La evaluación real del modelo se ejecuta por separado:

```sh
MENU_TEST_IMAGE=/ruta/a/la/carta-bodoburgers.png npm run test:ai-menu
```

Además de esa imagen, evalúa texto de pastas con variantes por peso/docena y un precio decimal, adicionales, rotisería, promociones y precios desconocidos. `MENU_TEST_PDF=/ruta/a/carta.pdf` agrega un caso PDF. Para comprobar subida, análisis y revisión por navegador, agregar `AI_E2E=1 MENU_TEST_IMAGE=/ruta/a/la/imagen.png` al comando `test:storefront`. Estas pruebas hacen llamadas facturables a OpenAI.

**Estado de la prueba de IA:** no se pudo ejecutar una extracción real porque `OPENAI_API_KEY` aún no estaba configurada en `.env.local`. La integración y sus pruebas están implementadas, pero la precisión sobre la imagen y los otros casos no está verificada contra el proveedor. No se usaron respuestas simuladas para afirmar una extracción exitosa.

```text
$ MENU_TEST_IMAGE=/ruta/a/la/carta.png npm run test:ai-menu
Configure OPENAI_API_KEY in .env.local to run real model evaluation
```

Código 1, antes de hacer solicitudes al proveedor.

## Límites de esta entrega

No incluye grupos obligatorios de opciones, reservas de stock, inventario, cocina, caja, cobros automáticos ni WhatsApp Business API. La bandeja muestra los últimos 100 pedidos y se actualiza manualmente. El checkout público todavía no incorpora protección adicional contra pedidos automatizados; antes del lanzamiento abierto falta definir esos límites junto con los controles de cuentas ya indicados en la entrega de alta. El frontend sigue siendo local hasta configurar hosting.

Durante la verificación, el primer intento de formato falló por la restricción de red del sandbox; se completó al habilitar acceso a npm. El primer recorrido móvil falló porque el script intentaba marcar un adicional sin desplegar su sección; se corrigió la interacción del test y el flujo completo pasó. Una prueba unitaria detectó un separador de precio malformado que se aceptaba; se corrigió la validación antes de aplicar la migración de producción. El script aislado de IA inicialmente cargaba dependencias de autenticación/React a través del módulo de errores; se separó `HttpError` para que esa evaluación pueda ejecutarse directamente en Node y llegue correctamente al control de clave faltante.
