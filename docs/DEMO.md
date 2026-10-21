# Demo del panel

`pedipue.com/demo` muestra el panel de **Brasa Club**, un local de ejemplo, sin cuenta ni registro. Se entra desde la landing ("Probar el panel").

## Cómo funciona

- **Datos.** `src/lib/demo/brasa-snapshot.json` es una foto de lo que leen las pantallas del panel. La genera `npm run demo:snapshot` (`scripts/demo-snapshot.ts`): carga Brasa Club con la lógica real del sistema (carta, insumos, recetas, compras, dos semanas de pedidos, un turno de caja cerrado, uno abierto y pedidos de hoy en todos los estados) en un Postgres **local y vacío**, y guarda el resultado. El script se niega a correr contra un host que no sea `localhost`.
- **Fechas.** `src/server/demo.ts` corre todas las fechas del snapshot al momento de cada visita, así los pedidos de hoy son de recién y el semáforo de cocina tiene sentido.
- **Fotos.** Se toman de la tienda publicada de Brasa Club por nombre de producto (solo lectura). Sin esa tienda, la demo sale sin fotos.
- **Pedidos, cocina, caja, carta y tienda** corren en el navegador (`src/lib/demo/sandbox.ts`). Las pantallas son las mismas del panel; `DemoProvider` desvía sus pedidos a `/api/businesses/demo/...` a ese sandbox en memoria. Cada visitante tiene su copia, nada viaja a la base y al recargar vuelve a empezar. Cada 75 segundos entra un pedido nuevo de la tienda, hasta seis.
- **Gestión** se sirve desde el servidor (`src/app/api/businesses/demo/[...path]/route.ts`), de solo lectura: Resultados se calcula para cualquier período con las mismas cuentas que el reporte real. Registrar compras, gastos o ventas responde que es una demo. Las ventas que se aceptan en Pedidos durante la demo no aparecen en Gestión.
- Subir fotos e importar la carta con IA están deshabilitados.

`demo` es un slug reservado: ningún negocio puede usarlo, y `app.pedipue.com/demo` redirige a la raíz.

## Regenerar los datos

Con un Postgres local vacío y un archivo de entorno que tenga `DATABASE_URL` y `DATABASE_URL_UNPOOLED` apuntando a él:

```text
GASTRONOMIA_ENV_FILE=<env local> npx drizzle-kit migrate
GASTRONOMIA_ENV_FILE=<env local> npm run demo:snapshot
npm run test:demo
```

Conviene regenerarlo cuando cambie la forma de los datos de alguna pantalla (por ejemplo, un campo nuevo en pedidos o en Gestión).
