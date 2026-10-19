# Gastronomía — planificación y base técnica

Plataforma para hamburgueserías, rotiserías y casas de pastas independientes. Incluye cuentas y alta de negocios con Neon Auth, **carta manual o importada con OpenAI, horarios, retiro/delivery, activación de tienda, carrito y pedidos pendientes con checkout por WhatsApp**. El módulo **Gestión** conecta ventas, stock, recetas, elaboración, compras, proveedores y gastos con resultados estimados. Cocina y caja completa siguen en el plan de V1.

## Documentos

- [Plan de V1](docs/PLAN-V1.md): alcance funcional, reglas, decisiones, exclusiones y entregas.
- [Arquitectura](docs/ARQUITECTURA.md): stack, entidades, permisos, concurrencia y operación.
- [Backlog](docs/BACKLOG.md): historias priorizadas y criterios de aceptación.
- [Verificación](docs/VERIFICACION.md): comandos ejecutados, resultados y límites.
- [Alta de negocios](docs/ALTA-NEGOCIOS.md): funcionamiento y verificación de la entrega actual.
- [Carta y tienda](docs/CARTA-TIENDA.md): configuración, importación con IA, checkout y pruebas.
- [Design system Pedipue](docs/DESIGN-SYSTEM.md): marca, colores, tipografía, componentes, tono y plan para aplicarlo en todas las pantallas.
- [Gestión y resultados](docs/GESTION.md): flujos, cálculos, permisos, migración y pruebas del módulo.
- [Delivery](docs/DELIVERY.md): plan por etapas, cobertura automática por radios, tarifas, configuración de mapas y pruebas.

Flujo acordado: **guardar pedido pendiente → abrir WhatsApp → el negocio confirma en el panel → cocina**. Abrir WhatsApp no acredita pago ni aceptación.

## Ejecutar

Requisito: Node.js 22.20 o superior y npm.

```sh
npm ci
npm run dev
```

App: http://localhost:3000. Desde “Crear mi tienda” se crea una cuenta y luego el negocio. En `/panel/negocios/:id` aparecen Carta, Tienda, Pedidos y Gestión. La tienda pública usa `/t/:slug`; con `NEXT_PUBLIC_ROOT_DOMAIN` pasa a `slug.<dominio>` (ver Dominios).

El alta guarda nombre, rubro, WhatsApp con código de país, ciudad y dirección opcional. Crea negocio, sucursal “Casa central” y membresía de propietario en una sola transacción. El identificador es único; los reintentos de la misma solicitud no duplican el negocio. El panel muestra solo los negocios asociados a la cuenta autenticada. Cada propietario configura su carta, horarios y entregas antes de activar la tienda explícitamente.

Para importar cartas, agregar `OPENAI_API_KEY` en `.env.local` y reiniciar el servidor. `OPENAI_MENU_MODEL` es opcional; usa `gpt-5.4-mini` por defecto. Acepta imágenes PNG/JPG/WEBP, PDF y texto. La respuesta se presenta como borrador editable: hay que revisar y seleccionar los productos antes de guardarlos. La clave se usa exclusivamente en el servidor. No hace falta configurarla para la carga manual.

Para producción local:

```sh
npm run build
npm run start
```

## Neon

Ya está vinculado el proyecto `soft-tooth-38969404`, organización `org-proud-voice-23148089`, rama `production`. La CLI creó `.neon`, `neon.ts` y `.env.local`. `.neon` y todos los archivos de entorno reales están excluidos de Git.

Para reproducir en otra carpeta o equipo, con una CLI actual:

```sh
npm i -g neon@latest
neon init -y --org-id org-proud-voice-23148089 --project-id soft-tooth-38969404 --branch production --services postgres,auth
neon deploy
```

Si la CLI necesita autenticación, ejecutar `neon login` y completar el inicio de sesión en el navegador. El entorno usado en esta entrega ya tenía credenciales.

`DATABASE_URL` es la conexión pooled de la app. `DATABASE_URL_UNPOOLED` se reserva para migraciones y pruebas que necesitan sesión directa. La app valida sus variables en el servidor con `@neon/env`, usa `pg` y verifica el certificado TLS. Nunca anteponer `NEXT_PUBLIC_` a estas variables.

`neon deploy` también descarga `NEON_AUTH_BASE_URL` y `NEON_AUTH_JWKS_URL`. Agregar `NEON_AUTH_COOKIE_SECRET` a `.env.local`: un secreto aleatorio privado de al menos 32 caracteres, distinto por entorno. En este equipo ya está generado. Usar un gestor de secretos en el hosting; no copiarlo al repositorio.

## Fotos (Neon Object Storage)

Las fotos de productos y portadas se guardan en el bucket público `pedipue-media` de Neon Object Storage, declarado en `neon.ts`; Postgres guarda solo sus datos y la ruta del archivo (`menu_images.storage_key`). Las URLs que usa la app siguen siendo `/api/media/<id>` y redirigen al archivo público del bucket.

Configuración:

1. `neon deploy` crea el bucket en la rama.
2. `neon env pull --file .env.local` escribe `AWS_ACCESS_KEY_ID`, `AWS_SECRET_ACCESS_KEY`, `AWS_ENDPOINT_URL_S3` y `AWS_REGION`.
3. Cargar esas cuatro variables en Vercel (Production). Para no reusar la credencial local: `neon credentials create --scope storage:read --scope storage:write --name vercel`.

Sin esas variables las fotos nuevas se guardan en Postgres, así el desarrollo local funciona sin storage.

Para copiar al bucket las fotos que ya estaban en Postgres, con las variables de producción en `.env.local`:

```sh
npm run images:to-storage              # copia y deja los bytes en Postgres como respaldo
npm run images:to-storage -- --liberar # además borra de Postgres los bytes de las fotos ya copiadas
```

Se puede correr más de una vez y con el sitio funcionando.

## Dominios

Con `NEXT_PUBLIC_ROOT_DOMAIN=pedipue.com`, `src/proxy.ts` rutea por host:

- `pedipue.com` (y `www.`): landing. `/ingresar`, `/registro`, `/panel` y `/alta` redirigen a `app.`.
- `app.pedipue.com`: login, registro, alta y la lista de negocios (`/panel`). `/` lleva a `/panel`. La gestión de cada local vive en `app.pedipue.com/<slug>` (`/<slug>/carta`, `/<slug>/pedidos`, `/<slug>/tienda`, `/<slug>/gestion/...`), servida internamente desde `/panel/negocios/:id`. Sin sesión, se ingresa y se vuelve al local.
- `<slug>.pedipue.com`: la tienda pública (se reescribe internamente a `/t/:slug`). `/t/:slug` en otro host del dominio redirige al subdominio.
- Redirecciones de links viejos: `/panel/negocios/:id/...` y `<slug>.pedipue.com/panel/...` llevan a `app.pedipue.com/<slug>/...`.
- La sesión usa una cookie del dominio `.pedipue.com` (`sessionCookieDomain` en `src/lib/hosts.ts`) para que la vista previa privada de la tienda funcione en su subdominio.
- Los slugs reservados (`app`, `www`, `api`, `admin`, `panel`, `alta`, `ingresar`, etc., en `src/lib/hosts.ts`) no se pueden usar como tienda: chocan con subdominios o con rutas de `app.`.

Hace falta un registro DNS comodín `*.pedipue.com` y su certificado; en Vercel, el dominio tiene que usar sus nameservers. La variable se lee al compilar: configurarla solo en el entorno Production de Vercel, así los previews (`*.vercel.app`) siguen funcionando en un solo host. Sin la variable todo funciona como antes, con `/t/:slug` y `/panel/negocios/:id`.

En local: `NEXT_PUBLIC_ROOT_DOMAIN=lvh.me:3000` (`lvh.me` y sus subdominios apuntan a 127.0.0.1, y a diferencia de `localhost` permiten compartir la cookie). Abrir `http://lvh.me:3000`, `http://app.lvh.me:3000/<slug>` y `http://<slug>.lvh.me:3000`. Neon Auth tiene que permitir esos orígenes.

El origen de la aplicación debe estar permitido en Neon Auth. Con dominios, hay que permitir `https://app.pedipue.com`. Para el desarrollo local hay que tener permitido `http://localhost:3000`. Al desplegar, agregar el dominio HTTPS del hosting en la rama correspondiente.

El build no consulta la base. `GET /api/health/db` sí la consulta en cada request y devuelve 200 si funciona o 503 si falla, sin credenciales ni errores internos y sin caché. Es un diagnóstico de conectividad, no una prueba de que existan módulos de negocio.

El esquema está en `src/server/schema.ts` y la migración versionada en `drizzle/`. Para preparar una base vacía después de configurar las variables:

```sh
npm run db:migrate
```

Para cambiar el esquema: editarlo y ejecutar `npm run db:generate`; revisar el SQL y probarlo en una rama de desarrollo antes de aplicarlo en producción. Para usar un archivo de entorno separado en una migración, pasar `GASTRONOMIA_ENV_FILE=/ruta/al/archivo`. Esto conserva `.env.local`.

## Verificación

Con `.env.local` configurado:

```sh
npm run build
npm run typecheck
npm run test:db
npm run test:menu
npm run test:management
```

`test:db` usa la misma conexión pooled que la app para leer y la conexión directa para hacer INSERT, SELECT, UPDATE y DELETE en una tabla temporal dentro de una transacción. Después ejecuta rollback y comprueba que la tabla desapareció. No añade datos comerciales.

Con `npm run start` ejecutándose en otra terminal:

```sh
npm run test:e2e
npm run test:browser
```

`test:e2e` comprueba la página y el recorrido real HTTP → servidor → Neon. `test:browser` requiere Google Chrome instalado: prueba escritorio a 1440 px, móvil a 390 px, conexión real, respuesta 503 simulada en el navegador y recuperación. Guarda capturas en `/tmp/gastronomia-desktop.png` y `/tmp/gastronomia-mobile.png`. La simulación no reemplaza la prueba real de Postgres.

Para usar otro puerto, iniciar `npm run start -- --port 3001` y pasar `APP_URL=http://localhost:3001` a los scripts de HTTP/navegador.

Para probar altas completas, usar una rama Neon aislada, permitir su origen en Auth y servir la app con sus variables. El script crea dos cuentas y negocios sintéticos, por lo que requiere habilitación explícita:

```sh
APP_URL=http://localhost:3001 TEST_ONBOARDING=1 npm run test:onboarding
```

Comprueba registro, sesión restaurada, alta, propietario, reintentos, validación, colisión de identificadores, aislamiento entre cuentas, logout y login. Los datos sintéticos quedan en la rama aislada hasta su vencimiento; no ejecutar contra una base con datos reales. No hay contraseñas de prueba fijas en el repositorio.

Para probar carta y checkout en esa misma instalación aislada:

```sh
APP_URL=http://localhost:3001 TEST_STOREFRONT=1 npm run test:storefront
```

Con OpenAI configurado, `MENU_TEST_IMAGE=/ruta/carta.png npm run test:ai-menu` evalúa la imagen de hamburguesas de referencia y ejemplos de pastas y rotisería. Agregar `AI_E2E=1 MENU_TEST_IMAGE=/ruta/carta.png` al comando de navegador prueba también la importación real y su confirmación en la UI. Estos comandos hacen solicitudes facturables al proveedor.

## Próxima entrega

Cocina, caja completa, invitaciones de equipo y edición de permisos. Aceptar un pedido registra la venta y descuenta los consumos configurados; todavía no crea comandas. Las transferencias se verifican manualmente; elegir ese medio de pago no acredita el pedido.

El seguimiento público, los estados y la migración necesaria están documentados en [docs/ORDER-TRACKING.md](docs/ORDER-TRACKING.md).
