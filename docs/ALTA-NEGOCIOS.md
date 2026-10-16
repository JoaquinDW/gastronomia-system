# Alta autogestionada de negocios

Entrega del 15 de octubre de 2026. Incluye cuentas personales con Neon Auth y creación de negocios en Postgres. La publicación en GitHub no despliega el frontend: la app continúa ejecutándose localmente hasta configurar hosting.

## Recorrido disponible

1. Desde la portada, elegir **Registrar mi negocio**.
2. En `/registro`, completar nombre, email, contraseña y confirmación.
3. Con la cuenta autenticada, `/alta` pide nombre del negocio, identificador, rubro, WhatsApp con código de país, ciudad y dirección opcional.
4. El servidor crea el negocio, la sucursal **Casa central** y una membresía de **propietario** dentro de una transacción.
5. Se abre `/panel/negocios/:id` con los datos guardados y el estado de los siguientes pasos.
6. En `/panel`, el usuario puede abrir sus negocios o dar de alta otro. `/ingresar` permite volver a entrar; el panel incluye cierre de sesión.

La dirección del local es opcional para permitir emprendimientos sin atención al público. El identificador se propone a partir del nombre y puede personalizarse; solo admite minúsculas, números y guiones entre palabras. Su unicidad se garantiza en la DB. El WhatsApp se normaliza al formato internacional.

La tienda aún no está publicada: no hay catálogo, recepción de pedidos, cocina ni caja habilitados por el alta. Las invitaciones y la edición de permisos del equipo quedan pendientes. Las cuentas y negocios se guardan realmente, sin depender del almacenamiento del navegador.

## Diseño y controles

- Identidad administrada por **Neon Auth / Managed Better Auth**. No se guardan contraseñas en las tablas de la aplicación.
- Sesión revisada en páginas, API y operaciones del servidor; el proxy de rutas es una protección adicional.
- `GET /api/businesses` filtra por membresía del usuario autenticado. `GET /api/businesses/:id` devuelve 404 para un negocio que no pertenece a su cuenta.
- `POST /api/businesses` toma el propietario exclusivamente de la sesión. No admite `userId`, roles ni campos extra enviados por el cliente.
- Validación compartida con Zod, validación final en servidor, consultas SQL parametrizadas, origen de solicitud comprobado y cuerpo limitado a 8 KiB.
- Creación atómica con restricciones y claves foráneas. Si falla un paso, no queda un negocio sin propietario.
- Clave de idempotencia por usuario y hash del payload. Un reintento conserva el resultado; reutilizar la clave con otros datos se rechaza. Colisión de identificador muestra un error en el formulario.
- La autorización entre negocios está implementada en el servidor. RLS y el rol de base de mínimo privilegio siguen siendo trabajo posterior, como se indica en la arquitectura.
- Los errores de autenticación se manejan tanto si el SDK devuelve un error como si rechaza la promesa. La UI conserva los campos y no presenta una contraseña incorrecta como éxito.

## Infraestructura y esquema

`neon.ts` declara `auth: true`, conservando la política de ramas existente. `neon deploy` habilitó Auth en la rama `production` y descargó sus variables de entorno. Se generó un secreto de cookies local; ningún secreto se incluyó en Git.

Se permitió explícitamente el origen de desarrollo `http://127.0.0.1:3000` en Auth de `production`. La app de prueba usó `http://127.0.0.1:3001` permitido en su propia rama.

Esquema en `src/server/schema.ts`. Migración versionada `drizzle/0000_business_onboarding.sql` con tablas `businesses`, `locations` y `memberships`, enums, unicidad, validaciones e índices.

La migración se probó primero en **dev-business-onboarding**, rama `br-restless-hall-b5uspnn9`, con vencimiento automático el 16 de octubre de 2026 a las 22:39 de Argentina. Sus credenciales se guardaron en un archivo temporal separado; `.env.local` siempre conservó `production`. Las cuentas y negocios sintéticos de las pruebas están únicamente en esa rama y vencerán con ella.

## Verificación

Build de la versión final:

```text
$ npm run build
✓ Compiled successfully in 565ms
  Finished TypeScript in 883ms ...
✓ Generating static pages using 11 workers (3/3) in 71ms
```

Código de salida **0**. Se generaron las rutas de registro, ingreso, alta, panel y API; el proxy también compiló.

Después de la validación aislada se ejecutó `npm run db:migrate` sobre `production`: **migrations applied successfully**, código 0. La app principal se reinició con `npm run start` y quedó disponible en `http://127.0.0.1:3000`.

Prueba real en Chrome contra la rama Neon aislada, sin mocks de identidad ni de negocios:

```text
$ APP_URL=http://127.0.0.1:3001 TEST_ONBOARDING=1 npm run test:onboarding
PASS: unauthenticated API reads/writes denied; protected panel redirects to login
PASS: real Neon Auth signup and session restoration after reload
PASS: business, initial location and owner persist; normalized WhatsApp and automatic slug
PASS: idempotent retries, duplicate slug, payload validation and cross-origin protection
PASS: two real accounts cannot list or open each other's business; mobile form has no overflow
PASS: sign out revokes browser access; invalid login rejected; real sign in restores the owner's panel
```

Código de salida **0**. Dos cuentas distintas, escritorio de 1440 px y móvil de 390 px. Se revisaron las capturas de alta y panel. `npm run typecheck` pasó; el build final volvió a comprobar tipos.

Se ejecutó una revisión de los archivos elegibles para commit contra los valores reales de conexión y del secreto de cookies: no se encontraron secretos. `git check-ignore .env.local .neon` confirma ambos archivos excluidos. `npm audit --omit=dev --audit-level=moderate` reportó **0 vulnerabilidades**; la revisión completa tras corregir la dependencia de desarrollo también reportó 0.

## Problemas encontrados y resueltos

- El plan de Neon no permitió ajustar la suspensión del cómputo al crear la rama de validación. Se creó con los parámetros predeterminados y vencimiento automático.
- La primera migración de prueba detectó un escape incorrecto en la expresión regular de WhatsApp. Se corrigieron esquema, SQL y snapshot antes de una aplicación exitosa; producción recibió la versión corregida.
- Next normaliza ciertas URLs internas como `localhost`; la validación de origen ahora usa el host efectivo de la solicitud/proxy. Se verificó que un origen ajeno siga siendo rechazado.
- Neon Auth rechazó `127.0.0.1` como origen no permitido. Se registraron explícitamente las direcciones locales en sus respectivas ramas.
- El SDK lanza una excepción ante ciertos intentos inválidos de ingreso. Se agregó su manejo y se verificó que después se pueda ingresar correctamente.
- La herramienta de migraciones traía una versión antigua de esbuild. Se acotó un override a esa dependencia de desarrollo y la auditoría quedó sin vulnerabilidades reportadas. Persisten advertencias de peers en dependencias opcionales de UI del SDK, sin bloquear instalación, build ni flujo probado.

## Antes del despliegue público

Configurar las variables en el hosting, migrar su DB correspondiente y registrar el dominio HTTPS en Auth. El entorno actual permite registro por email/contraseña sin exigir verificación de email, que es la configuración inicial de Neon comprobada durante la implementación. No se presenta como email verificado.

Antes de un lanzamiento abierto, definir verificación de email, recuperación de contraseña y SMTP propio según la [guía de producción de Neon Auth](https://neon.com/docs/auth/production-checklist), además de límites de uso del alta y condiciones del servicio. No se habilitaron envíos automáticos de emails durante las pruebas.
