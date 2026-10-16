# Verificación de la entrega inicial

Histórico de la base inicial. La entrega de registro y alta de negocios se documenta en [ALTA-NEGOCIOS.md](./ALTA-NEGOCIOS.md).

Fecha del trabajo: 15 de octubre de 2026, zona horaria del usuario `America/Argentina/Cordoba`.

## Cambios realizados

- Proyecto Next.js 16.4.2, React 19.3.1 y TypeScript, con scripts de build, ejecución y verificación.
- Página responsive de planificación, con botón de consulta real a Postgres y estados de carga, éxito y error.
- Conexión de servidor mediante `pg` 8.23.1, pool reutilizable, validación de variables con `@neon/env` y TLS con verificación de certificado/hostname.
- Endpoint `GET /api/health/db`: solo lectura, sin caché, respuesta reducida y 503 ante fallos.
- `neon.ts`, dependencias de configuración y variables descargadas por la CLI a `.env.local`.
- `.env.local` con permisos `600`; patrones `.env`, `.env.*` y `.neon` excluidos de Git. `.env.example` contiene solo nombres sin credenciales.
- Plan, arquitectura y backlog. No se aplicaron migraciones ni se crearon tablas del dominio comercial.

## 1. Instalación y setup Neon

El primer intento de instalación dentro del sandbox falló por acceso a npm (`ENOTFOUND registry.npmjs.org`). La instalación con acceso de red permitido terminó correctamente:

```text
$ npm i -g neon@latest
added 18 packages, and changed 137 packages in 8s

$ neon --version
8.7.2
```

La CLI 6.3.0 preexistente rechazó `--services postgres` y sugería `none`. Después de actualizar, 8.7.2 rechazó `none` y admitió el comando original solicitado. El resultado exitoso fue:

```text
$ neon init -y --org-id org-proud-voice-23148089 --project-id soft-tooth-38969404 --branch production --services postgres

Linked .neon
  Project         gastronomia-system (soft-tooth-38969404)
  Branch          production
  Org             org-proud-voice-23148089

Creating neon.ts...
Pulled 3 Neon variables into .env.local from branch production (br-empty-resonance-b5ar105u)
  Postgres        DATABASE_URL, DATABASE_URL_UNPOOLED
  Branch          NEON_BRANCH

Neon setup complete.
```

La CLI instaló el plugin y las guías de Neon en los agentes que detectó en el equipo, y configuró sus conectores. Advirtió que no encontró `copilot` en PATH y usó su alternativa de skills/MCP. La inicialización terminó con código 0. No hizo falta login: reutilizó credenciales ya configuradas.

```text
$ neon deploy
→ Applying to branch production (br-empty-resonance-b5ar105u)
No changes — branch production already matches the policy.

Utilized services: Postgres
Pulled 3 Neon variables into .env.local
  Postgres        DATABASE_URL, DATABASE_URL_UNPOOLED
  Branch          NEON_BRANCH
```

Esto aplica la infraestructura de Neon. No publica Next.js en un hosting web.

## 2. Build y tipos

Último build, después de dar formato al código y corregir el espaciado móvil:

```text
$ npm run build
▲ Next.js 16.4.2 (Turbopack)
- Environments: .env.local
✓ Compiled successfully in 313ms
  Running TypeScript ...
  Finished TypeScript in 223ms ...
✓ Generating static pages using 5 workers (3/3) in 199ms
  Finalizing page optimization ...

Route (app)
┌ ○ /
├ ○ /_not-found
└ ƒ /api/health/db
```

Código de salida: **0**. `npm run typecheck` también terminó con código **0**, sin errores. El build final volvió a ejecutar TypeScript satisfactoriamente.

## 3. Prueba real del servicio Postgres

```text
$ npm run test:db
PASS: application pooled connection reads from Postgres
PASS: parameterized INSERT, SELECT, UPDATE and DELETE on a temporary table
PASS: rollback verified; no test table or test rows remain
```

Código de salida: **0**. La prueba usa la conexión pooled de la aplicación para lectura. Para CRUD temporal usa `DATABASE_URL_UNPOOLED`, manteniendo toda la prueba en una conexión y transacción. Se verificaron valores parametrizados y caracteres especiales. La tabla temporal se revierte; no quedan filas ni tablas de prueba.

## 4. App iniciada y recorrido HTTP hasta Neon

Se inició la compilación final:

```text
$ npm run start
▲ Next.js 16.4.2
- Local:         http://127.0.0.1:3000
- Network:       http://127.0.0.1:3000
✓ Ready in 70ms
```

Con la app ejecutándose:

```text
$ npm run test:e2e
PASS: GET / returns 200 and the planning page without connection secrets
PASS: GET /api/health/db returns 200 {"status":"ok","service":"postgres"} with no-store
PASS: running app -> route handler -> Neon Postgres -> HTTP response
```

Código de salida: **0**. El endpoint ejecutó una consulta real, sin mock. Se comprobó respuesta exacta y caché deshabilitada.

## 5. Navegador

```text
$ npm run test:browser
PASS: desktop interaction verifies the real Neon connection; no horizontal overflow
PASS: simulated unavailable response displays an error; retry recovers with a real query
PASS: mobile layout, scope navigation and database interaction; no JavaScript errors
```

Código de salida: **0**. Chrome headless, escritorio 1440 × 1080 y móvil 390 × 844. Se revisaron visualmente capturas de ambas versiones. Durante esa revisión se corrigió un espacio entre frases en móvil y se configuró la captura para terminar animaciones antes de guardar la imagen.

El caso de respuesta no disponible se simuló mediante interceptación del navegador; no se provocó una caída de Neon. La conexión exitosa y la recuperación se probaron contra la base real. Capturas locales en `/tmp/gastronomia-desktop.png` y `/tmp/gastronomia-mobile.png`.

## Límites y pendientes

- La V1 está planificada; no están implementados login, multiempresa, carta, checkout comercial, cocina, caja ni stock.
- La DB comercial no fue migrada. Las pruebas no demuestran los criterios de aceptación futuros del backlog.
- Solamente se configuró Postgres. Auth, almacenamiento, funciones y otros servicios no se provisionaron.
- El frontend funciona localmente; falta elegir y configurar el hosting.
- La carpeta no era un repositorio Git. No se inicializó Git, no hay commit ni PR. Los patrones de exclusión están preparados para cuando se inicialice.
- No quedaron fallos funcionales pendientes en las pruebas de esta base. Los problemas iniciales de red y versión de CLI se resolvieron como se describe arriba.
