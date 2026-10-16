# Gastronomía — planificación y base técnica

Plataforma para hamburgueserías, rotiserías y casas de pastas independientes. **Ya están implementados el registro de cuentas, el alta de negocios y el acceso privado del propietario, con Neon Auth y Postgres.** Catálogo, pedidos, cocina, caja y stock siguen en el plan de V1.

## Documentos

- [Plan de V1](docs/PLAN-V1.md): alcance funcional, reglas, decisiones, exclusiones y entregas.
- [Arquitectura](docs/ARQUITECTURA.md): stack, entidades, permisos, concurrencia y operación.
- [Backlog](docs/BACKLOG.md): historias priorizadas y criterios de aceptación.
- [Verificación](docs/VERIFICACION.md): comandos ejecutados, resultados y límites.
- [Alta de negocios](docs/ALTA-NEGOCIOS.md): funcionamiento y verificación de la entrega actual.

Flujo acordado: **guardar pedido pendiente → abrir WhatsApp → el negocio confirma en el panel → cocina**. Abrir WhatsApp no acredita pago ni aceptación.

## Ejecutar

Requisito: Node.js 22.20 o superior y npm.

```sh
npm ci
npm run dev
```

App: http://127.0.0.1:3000. Desde “Registrar mi negocio” se crea una cuenta y luego el negocio. Rutas: `/registro`, `/ingresar`, `/alta`, `/panel` y `/panel/negocios/:id`.

El alta guarda nombre, rubro, WhatsApp con código de país, ciudad y dirección opcional. Crea negocio, sucursal “Casa central” y membresía de propietario en una sola transacción. El identificador es único; los reintentos de la misma solicitud no duplican el negocio. El panel muestra solo los negocios asociados a la cuenta autenticada. La tienda comercial todavía no se publica.

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

El origen de la aplicación debe estar permitido en Neon Auth. Para el desarrollo local actual está configurado `http://127.0.0.1:3000`. Al desplegar, agregar el dominio HTTPS del hosting en la rama correspondiente.

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
```

`test:db` usa la misma conexión pooled que la app para leer y la conexión directa para hacer INSERT, SELECT, UPDATE y DELETE en una tabla temporal dentro de una transacción. Después ejecuta rollback y comprueba que la tabla desapareció. No añade datos comerciales.

Con `npm run start` ejecutándose en otra terminal:

```sh
npm run test:e2e
npm run test:browser
```

`test:e2e` comprueba la página y el recorrido real HTTP → servidor → Neon. `test:browser` requiere Google Chrome instalado: prueba escritorio a 1440 px, móvil a 390 px, conexión real, respuesta 503 simulada en el navegador y recuperación. Guarda capturas en `/tmp/gastronomia-desktop.png` y `/tmp/gastronomia-mobile.png`. La simulación no reemplaza la prueba real de Postgres.

Para usar otro puerto, iniciar `npm run start -- --port 3001` y pasar `APP_URL=http://127.0.0.1:3001` a los scripts de HTTP/navegador.

Para probar altas completas, usar una rama Neon aislada, permitir su origen en Auth y servir la app con sus variables. El script crea dos cuentas y negocios sintéticos, por lo que requiere habilitación explícita:

```sh
APP_URL=http://127.0.0.1:3001 TEST_ONBOARDING=1 npm run test:onboarding
```

Comprueba registro, sesión restaurada, alta, propietario, reintentos, validación, colisión de identificadores, aislamiento entre cuentas, logout y login. Los datos sintéticos quedan en la rama aislada hasta su vencimiento; no ejecutar contra una base con datos reales. No hay contraseñas de prueba fijas en el repositorio.

## Próxima entrega

Catálogo con variantes/opciones, horarios, checkout idempotente y bandeja de pendientes. El alta ya asigna el rol de propietario; invitaciones de equipo y edición de permisos están pendientes. Cocina, caja y stock completan las entregas siguientes.
