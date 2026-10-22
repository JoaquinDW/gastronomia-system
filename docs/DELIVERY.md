# Plan de delivery

## Objetivo

Cada comercio organiza su reparto. Pedipue determina cobertura, calcula lo que paga el cliente y conserva la dirección y ubicación del pedido. El costo del cadete es un gasto distinto de la tarifa cobrada al cliente.

## Etapa 1: cobertura y tarifa automática

Implementada en código, pendiente de activar Google Maps en el entorno de uso:

- Mantener las zonas manuales por barrio y sus mínimos de compra.
- Agregar un modo automático por radios desde una ubicación del local confirmada en el mapa.
- Definir radios entre 100 metros y 30 km, con precio y mínimo de compra por radio. El menor radio que incluya el punto gana, sin importar el orden ni el precio. Cada radio tiene que ser distinto.
- Buscar una dirección con su ciudad, elegir un resultado, usar la ubicación del dispositivo o marcar/mover el pin. La ubicación del dispositivo nunca se toma sin una acción del usuario.
- Mostrar el envío antes de confirmar; sin punto válido, mostrar “A calcular” y “Total sin envío”. Bloquear el delivery fuera de cobertura y ofrecer retiro cuando esté habilitado.
- Recalcular la zona y la tarifa en el servidor; rechazar una cotización desactualizada. No aceptar una tarifa ni una zona enviadas por el navegador sin comprobarlas.
- Guardar el punto, nombre de zona y tarifa históricos. Los reintentos conservan el mismo pedido aunque cambie la configuración. Incluir el enlace al punto en WhatsApp y en Pedidos.

**La distancia es en línea recta, no por calles.** No se cobran kilómetros de recorrido ni se promete una demora usando ese cálculo. El comercio debe tener en cuenta barreras, accesos y tiempos al elegir sus radios. Las zonas con formas irregulares quedan para la etapa 3.

### Delivery con confirmación del local

Tercera opción en Retiro y delivery, para cuando el local todavía no definió zonas ni tarifas. El cliente carga su dirección, no elige zona y ve “Envío: A confirmar” y “Total sin envío”; el local le confirma el costo por WhatsApp. Se guarda como `delivery_config = {"mode":"confirm"}` sin zonas, y el pedido queda con `zone_name` vacío y envío en cero, que es como el resto del sistema reconoce un envío a confirmar. Se usa esta opción o las zonas, no las dos a la vez; ambas se combinan con retiro. No requiere migración.

## Etapa 2: operación del reparto

Pendiente:

1. Repartidores por negocio, activos/inactivos y asignación manual.
2. Estados preparando, listo, en camino y entregado: ya incorporados en Pedidos y seguimiento. Queda integrar repartidor e incidencias; aceptar una venta no equivale a entregarla.
3. Guardar quién hizo cada cambio y cuándo; evitar asignaciones duplicadas.
4. Registrar costo del reparto y quién cobró efectivo. Vincular gastos de cadetería con Gestión sin contarlos dos veces.

## Etapa 3: cobertura avanzada y logística externa

Pendiente: polígonos/exclusiones, distancia por ruta, tarifa base + km, envío gratis con mínimo, pausas de reparto, integración con un proveedor disponible en cada ciudad. La cotización externa, el despacho, las cancelaciones y las actualizaciones del proveedor deben tener reintentos e identificación única. El seguimiento GPS requiere un flujo propio para el repartidor.

## Activación

1. Aplicar la migración Drizzle `0009_delivery_coverage.sql` antes de desplegar el código. Agrega `store_settings.delivery_config` con valor manual para los negocios existentes y `orders.delivery_location` opcional. No transforma zonas ni pedidos históricos.
2. En un proyecto de Google Cloud con facturación habilitada, habilitar Maps JavaScript API, Geocoding API y Places API (New), que da las sugerencias mientras se escribe la dirección. Crear una clave de navegador con restricciones de API y HTTP referrer para los dominios del panel y las tiendas. Contemplar subdominios si se usa `NEXT_PUBLIC_ROOT_DOMAIN`.
3. Configurar `NEXT_PUBLIC_GOOGLE_MAPS_API_KEY` y un `NEXT_PUBLIC_GOOGLE_MAPS_MAP_ID` de producción. En desarrollo se permite `DEMO_MAP_ID`. Las variables públicas se fijan al compilar: volver a construir/desplegar después de cambiarlas. La clave del navegador es pública por diseño; las restricciones se aplican en Google Cloud.
4. Tienda → Retiro y delivery → Automático por distancia. Escribir la dirección del local, marcar su ubicación y cargar los radios/tarifas/mínimos. Guardar y probar un domicilio cercano, uno lejano y uno fuera de cobertura.

Sin clave, los comercios pueden usar las zonas manuales. Si el mapa falla, no se convierte un envío automático desconocido en envío gratis ni se omite la validación. La dirección escrita y el pin deben corresponder: el cliente los revisa y el local puede abrir el punto guardado. No se guarda GPS del cliente en el almacenamiento local del navegador.

## Verificación

- `npm run test:delivery`: coordenadas inválidas, cálculo en metros, selección de zona, límites exactos, cobertura, envío gratis y validación de configuración.
- `npm run test:delivery:db`: requiere `GASTRONOMIA_ENV_FILE` de una rama de prueba, `DELIVERY_TEST_HOST` explícito y `NEON_BRANCH` de desarrollo. Crea datos sintéticos. Comprueba configuración, checkout, precios manipulados/desactualizados, mínimos, idempotencia, compatibilidad manual y guardado de coordenadas.
- `npm run test:delivery:browser`: requiere `APP_URL` local, `GASTRONOMIA_ENV_FILE`, `DELIVERY_FIXTURE_FILE` generado por la prueba de base de datos y `TEST_DELIVERY=1`. Compilar/iniciar esa instancia contra la misma rama con una clave pública de prueba; el script intercepta Maps JS y simula geocodificación. `DELIVERY_CAPTURE=1` guarda capturas en `/tmp/pedipue-delivery-review`. No usa una clave de Google real ni despacha envíos.
- Verificar en navegador de escritorio y celular: configuración, elección del punto, cálculo, fuera de cobertura, cambio de dirección y confirmación. Las pruebas con mapas simulados no sustituyen una verificación con la clave y las APIs habilitadas.

Referencias: [carga de Maps JS](https://developers.google.com/maps/documentation/javascript/load-maps-js-api), [geocodificación](https://developers.google.com/maps/documentation/javascript/geocoding), [marcadores](https://developers.google.com/maps/documentation/javascript/advanced-markers/start).

## Estado de verificación — 17 de octubre de 2026

- Migración aplicada a la rama temporal `codex-delivery-validation`, creada desde producción con vencimiento el 19 de octubre de 2026. La conexión de producción no se modificó.
- Pruebas unitarias tras integrar la versión actual: 8 de delivery, 8 de carta/configuración y 7 de Gestión correctas.
- Integración real con Postgres: correcta, incluyendo rechazo de tarifa alterada, cambio de tarifa después de cotizar, mínimo por zona, retiro sin ubicación y vuelta al modo manual.
- Flujo de navegador en escritorio y celular: correcto, con guardado real del pedido y Maps simulado. Se probaron configuración, error del proveedor, invalidación del punto al cambiar la dirección y bloqueo fuera de cobertura, sin errores de JavaScript ni hidratación.
- Compilación de Next.js y comprobación de tipos correctas.
- En la revisión se corrigió un desborde de un input de foto oculto y el formato de fecha de Pedidos para que servidor y navegador muestren el mismo texto durante la hidratación.
- Falta habilitar y probar Maps JS/Geocoding con una clave real antes de activar el modo automático en producción. El servicio real no se consumió en las pruebas.

## Preparación para producción

La migración original de delivery ya está aplicada en producción: se verificaron ambas columnas y su hash en el historial de Drizzle. Al integrar los cambios posteriores de opciones de producto y seguimiento, se renumeró a `0009_delivery_coverage.sql`, conservando exactamente el SQL, hash y fecha de aplicación originales. El snapshot ahora parte de la migración de seguimiento. No se repite el ALTER TABLE sobre las columnas existentes.

Se conservaron las opciones obligatorias de productos, estados de cocina, seguimiento por enlace y actualización de Pedidos incorporados en los PR 15 y 16. La configuración de Google Maps y el despliegue siguen pendientes mientras el permiso del navegador para Google Cloud y Vercel esté denegado.

La suite de checkout de la rama principal conserva un fallo previo: el test espera que el teléfono sea opcional, pero el esquema y la tienda actuales lo requieren. Los otros tres casos de checkout pasan. No se cambió esa regla como parte de la activación de mapas.
