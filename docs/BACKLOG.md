# Backlog de V1

La base, el alta, la carta manual/con IA, la configuración y publicación de tienda, el checkout por WhatsApp y la bandeja de pedidos ya están implementados; ver `VERIFICACION.md`, `ALTA-NEGOCIOS.md` y `CARTA-TIENDA.md`. TEN-01 y TEN-02 cubren las rutas implementadas. Siguen pendientes invitaciones, permisos editables, cocina, caja y stock. La carta admite variantes, adicionales opcionales y grupos de opciones con mínimo y máximo (CAT-02), con repetición para casos como los gustos de una docena. “P0” significa requisito para el piloto; “P1” mejora incluida antes de cerrar la V1.

| ID      | Prioridad | Entrega | Historia                        | Aceptación mínima                                                                                       |
| ------- | --------- | ------- | ------------------------------- | ------------------------------------------------------------------------------------------------------- |
| BASE-01 | P0        | 0       | Ejecutar la app y conectar Neon | Build exitoso; app iniciada; lectura y CRUD temporal comprobados; secretos excluidos                    |
| TEN-01  | P0        | 1       | Acceder y elegir negocio        | Sesión válida, membresía activa y selector solo de negocios autorizados                                 |
| TEN-02  | P0        | 1       | Separar datos                   | Usuario de A no puede consultar, mutar ni exportar datos de B, aunque cambie IDs en la URL              |
| TEN-03  | P0        | 1       | Dar permisos al equipo          | Cocina no accede a caja/clientes; caja no cambia permisos; revocación efectiva sin esperar nuevo login  |
| CAT-01  | P0        | 1       | Crear carta con variantes       | Simple/doble y bandejas 500 g/1 kg con precio y disponibilidad propios                                  |
| CAT-02  | P0        | 1       | Elegir opciones                 | Se respetan mínimos/máximos; opción inválida o ajena al producto es rechazada por servidor              |
| CAT-03  | P0        | 1       | Administrar combos              | Opciones limitadas, precio final y componentes de producción sin doble consumo                          |
| CAT-04  | P0        | 1       | Configurar atención             | Cruce de medianoche, cierre especial y pausa bloquean checkout según reglas visibles                    |
| CAT-05  | P1        | 1       | Gestionar fotos y precios       | Carga autorizada con límites; CSV con vista previa y errores por fila                                   |
| STO-01  | P0        | 2       | Comprar desde celular           | Carrito conserva selecciones; totales recalculados; controles utilizables en 360 px                     |
| STO-02  | P0        | 2       | Pedir retiro o delivery         | Dirección requerida solo en delivery; cobertura, cargo y mínimo validados en servidor                   |
| STO-03  | P0        | 2       | Finalizar por WhatsApp          | Pedido persistido antes del enlace; texto correcto; copia manual; no se declara enviado/aceptado        |
| STO-04  | P0        | 2       | Evitar duplicación              | Doble toque/reintento con misma clave devuelve mismo pedido; payload distinto con esa clave se rechaza  |
| STO-05  | P0        | 2       | Seguir el pedido                | Token no adivinable; sin datos personales; estados coherentes y reabrir WhatsApp sin nueva venta        |
| ORD-01  | P0        | 2       | Aceptar/rechazar                | Permisos, estado previo y versión validados; un solo efecto con dos operadores simultáneos              |
| ORD-02  | P0        | 2       | Tomar pedido de mostrador       | Precio/peso calculado, canal registrado y mismo flujo operativo que tienda                              |
| ORD-03  | P0        | 2       | Modificar/cancelar              | Motivo, historial y saldo correcto; enmiendas posteriores a aceptación visibles para cocina             |
| ORD-04  | P1        | 2       | Alertar pendientes y vencidos   | Alerta visible; vencimiento idempotente; expirado no se prepara ni se acepta sin revalidación           |
| KDS-01  | P0        | 3       | Preparar por estación           | Solo aceptados; cantidades, notas y opciones legibles; tareas de otras estaciones filtradas             |
| KDS-02  | P0        | 3       | Coordinar armado                | Pedido listo únicamente cuando todas sus tareas necesarias están terminadas                             |
| KDS-03  | P0        | 3       | Recuperar conexión              | Indicador de conexión, cola restaurada y reintento sin duplicar tareas ni estados                       |
| KDS-04  | P1        | 3       | Advertir demoras                | Temporizador con fecha de servidor, umbrales configurables y sonido tras habilitación del usuario       |
| PAY-01  | P0        | 4       | Registrar pagos                 | Efectivo/transferencia/tarjeta manual, parciales y divididos; no acreditar por captura o selector       |
| PAY-02  | P0        | 4       | Reintegrar cobros               | Máximo neto disponible, permiso, método, motivo y sin borrar el cobro original                          |
| CASH-01 | P0        | 4       | Abrir y cerrar turno            | Apertura única por caja; movimientos, esperado, declarado y diferencia verificables                     |
| CASH-02 | P0        | 4       | Vincular cobro y caja           | Una operación produce un movimiento; repetirla o reintentar no duplica saldo                            |
| RPT-01  | P0        | 4       | Entender ventas y cobros        | Ejemplo conciliable con 3 pedidos, pago parcial, dividido, cancelación y reintegro                      |
| RPT-02  | P1        | 4       | Exportar e imprimir             | CSV por negocio/período; ticket no fiscal, reimpresión identificada                                     |
| INV-01  | P0        | 5       | Registrar insumos               | Unidad base, conversión, entradas y merma con autor y motivo                                            |
| INV-02  | P0        | 5       | Reservar última unidad          | Dos aceptaciones simultáneas permiten una sola reserva; disponible nunca negativo                       |
| INV-03  | P0        | 5       | Consumir una receta             | Variante, adicionales y combo descuentan cantidades exactas una sola vez                                |
| INV-04  | P0        | 5       | Producir un lote de pastas      | Consumo de ingredientes + alta de producto terminado atómicos; venta no descuenta ingredientes de nuevo |
| INV-05  | P0        | 5       | Cancelar sin inventar stock     | Antes de cocinar libera; después registra merma/recuperación real con autorización                      |
| INV-06  | P1        | 5       | Ver costos y mínimos            | Costo promedio y fecha, alertas, costos faltantes visibles y margen bruto identificado como estimación  |
| OPS-01  | P0        | 6       | Operar con seguridad            | Autorización real, cookies seguras, validación, límites por ruta y datos personales fuera de logs       |
| OPS-02  | P0        | 6       | Recuperar una falla             | Restauración ensayada en ambiente aislado, monitoreo y procedimiento de soporte                         |
| PIL-01  | P0        | 6       | Validar tres rubros             | Un turno real por negocio con recorrido completo; problemas críticos resueltos antes de lanzamiento     |

## Primera porción a implementar después de esta planificación

**Negocio + usuario dueño + carta + checkout + bandeja de pendientes.** Se termina cuando un dueño puede configurar una hamburguesa con variantes y adicionales, un cliente genera un pedido real una sola vez, abre WhatsApp y el dueño lo acepta en su panel. Primero se prueban permisos y separación entre dos negocios; después se incorpora cocina, caja y stock transaccional.

Hasta implementar reservas, el piloto de esa porción debe limitarse a pedidos de prueba o a un catálogo sin control automático de existencias. No anunciar todavía una operación completa ni control de última unidad.
