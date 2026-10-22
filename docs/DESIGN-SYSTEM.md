# Design system Pedipue

Propuesta aprobada el 16 de octubre de 2026. El producto pasa a llamarse **Pedipue** (pedipue.com). Esta guía es la referencia para cualquier pantalla nueva o rediseñada; el lienzo con el sistema y las maquetas de la tienda está en [Pedipue Design System](https://claude.ai/artifact/RgD9EMwK9qiXxNJu6kbaEA).

Inspiración de tono: pedisy.com. No copiamos su interfaz; tomamos la actitud directa y una tienda más vistosa que la actual.

## Principios

1. **Directo, no frío.** Pocas palabras, botones grandes, precios siempre a la vista.
2. **Callejero, no desprolijo.** Bordes firmes, sombras duras tipo sticker y algún giro de pocos grados. La grilla siempre ordenada.
3. **La foto manda.** La interfaz es neutra para que el producto brille. El color fuerte se reserva para la acción: agregar, pedir, promo.

## Tokens

### Color

| Token | Valor | Uso |
| --- | --- | --- |
| `--ink` (Tinta) | `#121212` | Texto, header, botón secundario, chip activo |
| `--asphalt` (Asfalto) | `#2A2A2A` | Superficies oscuras, fondo de portada sin foto |
| `--paper` (Vereda) | `#F2F1EC` | Fondo general |
| `--surface` (Blanco) | `#FFFFFF` | Tarjetas de producto y paneles |
| `--soft` | `#E4E2DA` | Fondo de selectores y chips neutros |
| `--line` | `#D9D7CE` | Bordes suaves y divisores |
| `--muted` | `#5A5A55` | Texto secundario (cumple 4.5:1 sobre Vereda y Blanco) |
| `--accent` (Mostaza) | `#FFC72C` | Acción principal. **Siempre con texto Tinta encima** |
| `--promo` (Ketchup) | `#FF5A36` | Promos y descuentos. Siempre con texto Tinta |
| `--open` | `#1FA463` | Punto de estado "Abierto" |
| `--closed` | `#8A8A84` | Punto de estado "Cerrado" (no usar para texto) |

Reparto aproximado: 60 neutros, 30 tinta, 10 acción. Una sola acción mostaza por pantalla.

**Acento por local.** En la tienda pública `--accent` lo define cada negocio. Solo se ofrecen acentos claros y saturados (mostaza `#FFC72C`, lima `#B8F23C`, chicle `#FF8FB8`, celeste `#7CC4FF`) para que el texto Tinta encima siempre tenga contraste. El panel de gestión usa siempre Mostaza.

### Tipografía

| Rol | Familia | Pesos | Uso |
| --- | --- | --- | --- |
| Display | Bricolage Grotesque | 700, 800 | Nombre del local, títulos, categorías (en mayúscula) |
| UI y texto | Archivo | 400–700 | Párrafos, formularios, botones |
| Etiquetas | Space Mono | 400, 700 | Precios, horarios, número de pedido, badges |

Escala: H1 56/0.95 (72 en desktop de tienda, 128 en landing), H2 32/1, H3 19/1.2, cuerpo 15/1.5, precio 17 en Space Mono 700. Display con `letter-spacing` negativo (entre -1 y -3 px según tamaño).

Precios con formato `$ 12.500` (espacio después del signo, punto de miles).

### Forma

- Radio: 14 px en botones e inputs, 18–20 px en tarjetas, 999 px en chips y selectores, 22–32 px en el logo del local.
- Borde: 2 px Tinta en elementos de acción y stickers; 1.5 px `--line` en tarjetas en reposo, 1.5 px Tinta cuando el producto ya está en el pedido.
- Sombra dura: `3px 3px 0 var(--ink)` (2px en botones chicos, 4–6px en el logo). Nunca sombras difusas salvo la barra flotante del carrito.
- Giro: -3° a -6° solo en stickers (logo, badges NUEVO/PROMO). Nunca en texto corrido ni botones.
- Íconos: trazo lineal de 2.5–3 px, sin emoji.

## Componentes

- **Botón principal**: alto 52 px (44 mínimo), fondo `--accent`, borde 2 px Tinta, sombra dura, texto Archivo 700 Tinta.
- **Botón secundario**: fondo Tinta, texto Vereda. **Botón fantasma**: transparente con borde 2 px Tinta.
- **Botón +**: 44×44, radio 12, mostaza con sombra dura de 2 px; se monta sobre la esquina de la foto del producto.
- **Stepper de cantidad**: reemplaza al botón + cuando el producto ya está en el pedido; fondo Tinta, botón + en mostaza.
- **Chip de categoría**: pastilla de 40–44 px con borde 1.5 Tinta; activo con fondo Tinta y texto Vereda. Fila fija arriba al hacer scroll.
- **Selector Delivery / Retiro**: pastilla `--soft` con la opción elegida en Tinta.
- **Badges**: estado (`ABIERTO · HASTA 00:30`, fondo Tinta y punto verde), `CERRADO · ABRE 19:30` (fondo `--soft`), stickers `PROMO -20%` (Ketchup) y `NUEVO` / `MÁS PEDIDO` (acento). Todos en Space Mono 700 de 11–12 px.
- **Tarjeta de producto (lista, celular)**: texto a la izquierda, foto cuadrada de 108–128 px a la derecha, botón + sobre la foto. Sin foto, solo texto.
- **Tarjeta de producto (grilla, desktop)**: foto arriba de 170 px con el sticker encima, texto y precio abajo, botón "Agregar +".
- **Barra de pedido**: en celular flota abajo, fondo Tinta, contador mostaza, botón "Ver · $ total". En desktop es un panel lateral Tinta con líneas, envío y total.

## Tono

Rioplatense, de vos, como el del mostrador.

| Así sí | Así no |
| --- | --- |
| ¿Qué pinta hoy? | Seleccione los productos deseados |
| Listo, el local ya lo tiene. Te avisamos por WhatsApp. | Su orden ha sido procesada exitosamente |
| Ahora estamos cerrados. Abrimos 19:30. | El comercio no se encuentra disponible |

Mantener los avisos que ya existen sobre pago y confirmación (abrir WhatsApp no acredita el pago; el local confirma antes de preparar), solo con el tono nuevo.

## Plan de implementación

Las pantallas usan `src/app/globals.css` y `src/app/workspace.css`. **Estado: etapas 1 y 2 aplicadas** (tokens en `:root` de `globals.css`, sin colores sueltos salvo blancos y transparencias; `--serif` queda como alias de `--display` mientras se migra). Como Mostaza no alcanza contraste como texto sobre Vereda, el texto de énfasis usa `--accent-ink` (`#855700`). El orden, de menor a mayor riesgo:

1. **Tokens y fuentes.** Reemplazar los valores de `:root` por los de esta guía, agregar `--asphalt`, `--surface`, `--promo`, `--open`, `--closed`, `--display` y `--mono`, cambiar el `@import` de Google Fonts y apuntar `--serif` a la display mientras se migra. Sustituir los hex sueltos por tokens. Renombrar la marca en `brand.tsx` y en la metadata de `layout.tsx`. Solo esto ya cambia el aspecto de todas las pantallas.
2. **Componentes base compartidos.** `.primary-button`, `.secondary-button`, `.text-button`, `.icon-button`, inputs y selects de `.app-form`, `.small-badge`, `.store-status`, `.eyebrow` (pasa a Space Mono) y tarjetas. Al estar compartidas, se actualizan panel, alta y tienda a la vez.
3. **Tienda pública** (`/t/[slug]`, `storefront.tsx`). Es la pantalla protagonista: portada, logo montado, chips fijos, "Lo más pedido", tarjetas nuevas con botón + y stepper, barra flotante en celular y panel lateral en desktop. Necesita datos que hoy no existen en `store_settings`: **foto de portada, logo y color de acento** (migración nueva) y una forma de marcar destacados (por ejemplo, un indicador en `menu_products`). Hasta tenerlos: portada Asfalto, logo con las iniciales del local y acento Mostaza. **Portada aplicada** (`store_settings.cover_image_url` y punto de foco, migración 0005): foto con zoom de entrada y desplazamiento suave al hacer scroll; sin foto, Asfalto con el nombre del local pasando en contorno. El logo-sticker se monta sobre el borde inferior. **Logo aplicado** (`store_settings.logo_image_url`, migración 0018): se sube desde Tienda con un paso para encuadrarlo (centrado automático sobre el dibujo, arrastrar y tamaño; guarda un PNG cuadrado), entero sobre blanco dentro del sticker; sin logo, la inicial sobre Mostaza. El mismo logo va en el seguimiento del pedido, en la imagen para compartir y arriba del ticket del cliente. Las animaciones se apagan con `prefers-reduced-motion`.
4. **Landing y acceso** (`/`, `/registro`, `/ingresar`, `/alta`; `auth-form.tsx`, `business-form.tsx`). Header Tinta con el titular grande, mismos botones y formularios.
5. **Panel de gestión** (`/panel`, negocio, Carta, Tienda, Pedidos; `menu-manager`, `product-editor`, `menu-importer`, `store-configurator`, `order-inbox`). Más sobrio que la tienda: fondo Vereda, tarjetas blancas, mostaza solo en la acción principal, números de pedido y precios en Space Mono. En **Tienda** se suman los controles de portada, logo y acento con la vista previa en vivo. **Navegación aplicada** (`business-nav.tsx`, desde el layout del negocio): sidebar de un solo nivel agrupada en Operación, Números y Cocina, con el acceso a la tienda pública fijo abajo; en celular, barra inferior Tinta con Resumen, Pedidos, Caja, Carta y "Más", que abre todas las secciones.

Cada etapa se verifica con los scripts existentes (`npm run typecheck`, `npm run test:storefront`, `npm run test:browser`) y capturas en celular y desktop.
