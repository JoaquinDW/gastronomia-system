# Caja: turno, cobros y arqueo ciego

Ruta: `/panel/negocios/:id/caja` (en **Operación**, y en la barra inferior del celular). Endpoint privado `GET/POST /api/businesses/:id/cash`, para propietario o encargado.

## Recorrido

1. **Abrir caja** con el cambio inicial. Hay un solo turno abierto por negocio; los turnos se numeran 1, 2, 3…
2. **Cobrar** desde la tarjeta del pedido en Pedidos o desde la lista **Por cobrar** de Caja. Medios: efectivo, transferencia, QR y tarjeta. En efectivo se puede indicar con cuánto paga y se muestra el vuelto (con billetes sugeridos). Un cobro menor al saldo es parcial: así se divide el pago entre medios o personas.
3. **Ingreso** y **Retiro** registran efectivo que entra o sale sin ser un cobro (más cambio, pago al cadete), siempre con motivo.
4. **Anular** un cobro o movimiento del turno abierto, con motivo. La fila queda tachada y deja de contar; nunca se borra. Un turno cerrado no se toca: si se devolvió plata después, se registra un retiro en el turno actual.
5. **Cerrar caja** con **arqueo ciego**: se cuenta el efectivo (total o por billete, más monedas) sin ver cuánto debería haber. Recién al confirmar se muestran el esperado, lo contado, la diferencia (cuadra, sobran o faltan), lo cobrado por cada medio y los pedidos del turno que quedaron sin cobrar.

El propietario ve los últimos 20 turnos cerrados con su diferencia; el encargado ve el resultado del turno que cierra.

## Reglas

- Esperado en efectivo = cambio inicial + cobros en efectivo + ingresos − retiros, sin filas anuladas. Se calcula y se guarda al cerrar (`expected_cents`, `declared_cents`); cambiar algo después no lo reescribe.
- El turno abierto nunca expone el esperado: no está en la pantalla ni en la respuesta de la API. Los movimientos sí se ven, para poder anularlos.
- Solo se cobran pedidos aceptados. No se cobra más que el saldo (total − cobros vigentes). Una tarjeta, QR o transferencia no lleva vuelto.
- Transferencia: cobrar cuando la plata está en la cuenta, no por una captura. QR y tarjeta: cuando el posnet o la app confirman.
- **Por cobrar** lista los pedidos aceptados en las últimas 24 horas con saldo. Los pedidos más viejos no se vuelven a pedir, para que la historia previa a usar Caja no aparezca como deuda.
- Si un pedido cobrado se anula en Gestión, Pedidos y Caja avisan para anular el cobro o registrar la devolución.
- Cada comando corre en una transacción con bloqueo por negocio. Apertura, cobros, movimientos y cierre llevan `requestKey`: un reintento devuelve el mismo resultado y la misma clave con otros datos devuelve 409. Dos cobros simultáneos del mismo saldo dejan pasar uno solo.
- Cobrar no cambia la venta registrada en Gestión: la venta se reconoce al aceptar, el cobro es otra cosa.

## Base de datos

La migración `0014_cash_register.sql` crea `cash_sessions` (turno, con índice único parcial para un solo turno abierto por negocio) y `cash_movements` (cobros, ingresos y retiros, con anulación lógica). Solo agrega tablas; no modifica datos existentes. Hay que aplicarla antes de desplegar este código.

## Pendiente

- Cuentas de caja con PIN (TEN-03). Hoy el arqueo es ciego para quien cuenta en esa pantalla, pero el propietario y el encargado usan la misma cuenta del panel.
- Reintegros vinculados al cobro original (PAY-02) y una sola caja por negocio, sin varias cajas por sucursal.

## Validación

- `npm run test:cash`: esperado, diferencia, vuelto, billetes sugeridos, conteo por billete y validación de comandos.
- `npm run test:cash:db` (con `GASTRONOMIA_ENV_FILE`, `CASH_TEST_HOST` y una `NEON_BRANCH` de prueba): un solo turno abierto, cobros parciales y divididos con vuelto, sin cobrar de más con cobros simultáneos, pedidos pendientes, rechazados y anulados, ingresos, retiros, anulaciones, cierre ciego con esperado congelado, reintentos y aislamiento entre negocios.
