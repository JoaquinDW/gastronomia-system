# Gestión y resultados

Entrega del 16 de octubre de 2026. Ruta: `/panel/negocios/:id/gestion`.

## Recorrido

1. En **Inventario**, cargar insumos, envases y terminados, su unidad base (g, ml o unidad), mínimos y existencia inicial. El valor inicial es el costo total de esa existencia; vacío significa desconocido.
2. Registrar **Proveedores** opcionales y **Compras** con varias líneas. kg y litros convierten a g y ml; una presentación declara su contenido en unidades base. El costo es el total de la línea, en pesos, sin separador de miles y con coma decimal.
3. En **Recetas y preparación**, configurar los consumos de cada variante y adicional por unidad vendida. Una opción sin consumo debe declararse expresamente. Los combos tienen composición explícita; no consumen automáticamente otros productos de la carta.
4. Para elaborar, crear previamente un terminado y registrar ingredientes reales utilizados y cantidad real obtenida. Esta versión consume solo insumos en la elaboración. La receta de venta utiliza el terminado y puede agregar envases u otros componentes; no vuelve a consumir sus ingredientes.
5. Aceptar pedidos de tienda registra su venta y descuenta stock. **Ventas** permite cargar mostrador, WhatsApp y otros con sus precios efectivos, incluyendo adicionales. El cargo de envío se informa aparte. Ninguna acción acredita un cobro.
6. Registrar **Gastos** por fecha y categoría, incluyendo reparto, servicios, alquiler y sueldos. Las compras de inventario no se repiten como gastos. Se admiten fechas de la jornada actual o anteriores, sin recurrencias automáticas.
7. En **Resultados**, elegir hoy, últimos siete días, mes o un rango de hasta 366 días. Los gráficos, ranking, comparación y CSV consultan todo el período, independientemente de la paginación de las listas.

El dashboard usa palabras cotidianas: **Total vendido**, **Ventas menos su costo**, **Pérdidas** y **Lo que te queda (estimado)**. Las pérdidas son insumos o productos que ya no se pueden usar o vender.

Si aparece **Faltan costos**, los accesos directos abren el formulario de costo del stock o el de ingredientes por producto. Inventario también ofrece **Cargar costo** junto a cada insumo con stock positivo sin costo. Estos cambios completan las próximas ventas; no reescriben costos históricos.

## Costos y resultados

- Cantidades y costos unitarios: decimales exactos con seis posiciones. Aritmética `BigInt` con redondeo al centavo en cada componente vendido; no se calculan importes con coma flotante. El costo por unidad de inventario se expresa internamente en centavos por unidad base.
- Promedio ponderado móvil: sumar el valor de la existencia positiva y el costo recibido, dividir por la nueva existencia. Con saldo previo cero o negativo, tomar el costo unitario de la recepción para movimientos futuros. Si la existencia positiva no estaba valorizada, no se inventa su costo: un conteo con valor total permite completarlo.
- Las ventas capturan nombres, opciones, cantidades y costos conocidos. Las recetas son revisiones inmutables; los movimientos conservan qué insumos se utilizaron. Cambiar una receta, precio o compra no revaloriza ventas anteriores.
- Se permiten negativos con advertencias. El último costo conocido se mantiene durante el déficit; sin costo previo, la valoración queda pendiente. Movimientos de stock se registran en el momento actual, sin recálculo retroactivo.
- **Margen bruto estimado = ventas netas − costo vendido**. **Resultado operativo estimado = margen bruto − gastos − mermas**. Se reconoce el costo al vender o registrar merma, no al comprar y volver a vender.
- Los costos desconocidos se muestran como parciales. Un margen con costos de venta pendientes y un resultado con ventas o mermas sin valorizar no se muestran como cifras completas. El resultado es siempre estimado y depende de los gastos efectivamente cargados.
- Ventas incluye los cargos de envío; el costo del reparto se registra como gasto. Caja, conciliación, facturación, obligaciones fiscales y cuentas corrientes de proveedores no forman parte de este módulo.

## Correcciones y jornadas

- Anular una venta revierte sus ingresos y costo capturado en la jornada de anulación. El operador declara qué cantidades recuperó: se reponen con su valor original y se incorporan al promedio vigente. Lo no recuperado se registra como pérdida con cantidad de stock cero, porque ya se había descontado al vender.
- Un gasto se anula con un movimiento compensatorio en la jornada actual, conservando el gasto original.
- Una compra o elaboración confirmada no se sobrescribe ni borra. **Registrar ajuste** abre un conteo vinculado a la operación original. Para corregir una elaboración deben ajustarse también los insumos afectados desde Inventario. El conteo permite reemplazar el saldo real y valorizarlo; una merma descuenta solo la cantidad perdida.
- Los conteos y ediciones comprueban versión. Compras, ventas, elaboración y anulaciones son transacciones completas con clave idempotente, actor y bloqueo por negocio y saldos ordenados. Un reintento idéntico devuelve su resultado; reutilizar una clave con otros datos devuelve 409.
- Zona horaria del negocio y corte inicial **04:00**. La jornada de cada operación queda capturada; cambiar el corte afecta solo operaciones nuevas. Para históricos que carecen de fecha de aceptación se usa la fecha de creación con el corte actual, y se identifican como históricos.
- Los pedidos nuevos conservan identificadores de producto, variante y adicionales. Los antiguos siguen siendo legibles, sin asociarlos por nombre ni descontarles stock retroactivamente. Los antiguos aceptados aparecen en resultados con costo pendiente; los pendientes antiguos que se acepten conservan esa limitación.

## Interfaces y permisos

- Endpoint privado `/api/businesses/:id/management`.
- `GET`: datos operativos paginados; `view=report` agrega resultados; `view=export-results` y `view=export-movements` descargan CSV con fechas `from`/`to`; `view=consumptions&saleId=…` devuelve consumos para anulación.
- Listas de ventas y operaciones: 50 por página; movimientos: 100. Parámetros `salesOffset`, `operationsOffset`, `movementsOffset`. El reporte no toma datos de estas listas limitadas.
- `POST`: comando validado con Zod y `requestKey` UUID. Tipos: `item`, `supplier`, `recipe`, `purchase`, `production`, `adjustment`, `sale`, `cancel_sale`, `expense`, `reverse_expense`, `settings`.
- Propietario: acceso completo. Encargado: operación, costos unitarios y de ventas, sin gastos ni resultados financieros agregados. Caja/cocina no acceden. La autorización se controla en cada endpoint, incluidos CSV, y los recursos se validan dentro del mismo negocio.
- Los CSV usan centavos enteros, cantidades decimales y encabezados en español; las celdas de texto con prefijos de fórmula se neutralizan.

## Migración y verificación

La migración `0002_wonderful_red_ghost.sql` agrega las tablas del módulo, `orders.accepted_at` y claves compuestas para aislar relaciones entre negocios. No modifica ni consume inventario histórico. Debe aplicarse antes de ejecutar el código actualizado contra una base existente. Se validó primero en una rama temporal de Neon; producción no se migra desde las pruebas.

```sh
npm run typecheck
npm run build
npm run test:management
```

Las pruebas de integración y navegador crean datos y cuentas sintéticos. Requieren una rama aislada, variables de esa rama en un archivo privado y el hostname del endpoint explícito. El servidor de navegador debe usar la misma base y Auth aisladas.

```sh
TEST_MANAGEMENT=1 MANAGEMENT_TEST_HOST=HOST_AISLADO GASTRONOMIA_ENV_FILE=/ruta/privada.env npm run test:management:db
APP_URL=http://localhost:3001 TEST_MANAGEMENT=1 MANAGEMENT_TEST_HOST=HOST_AISLADO GASTRONOMIA_ENV_FILE=/ruta/privada.env npm run test:management:browser
```

La suite cubre conversiones, promedio, anulaciones parciales, costos históricos, producción, negativos, rollback, recursos de otro negocio, idempotencia concurrente, aceptación de pedidos, más de cien ventas y exportaciones. El navegador cubre sesión real, roles, retención del formulario ante error y secciones móviles. Las capturas usan datos sintéticos.

Incidencia preexistente: `tests/checkout.test.ts` espera poder omitir `customerPhone`, mientras el esquema actual de checkout y la base lo requieren. Este módulo no modifica ese contrato.
