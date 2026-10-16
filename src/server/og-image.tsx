import "server-only";
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { ImageResponse } from "next/og";

// Imágenes Open Graph (1200×630) con los tokens de docs/DESIGN-SYSTEM.md.
// Las fuentes van en el repo porque next/og no lee Google Fonts.

export const ogSize = { width: 1200, height: 630 };

const ink = "#121212";
const asphalt = "#2A2A2A";
const paper = "#F2F1EC";
const accent = "#FFC72C";
const open = "#1FA463";

const fontDir = join(process.cwd(), "src/assets/fonts");
let fonts: Promise<NonNullable<ConstructorParameters<typeof ImageResponse>[1]>["fonts"]>;

function loadFonts() {
  const font = (file: string) => readFile(join(fontDir, file));
  fonts ??= Promise.all([
    font("bricolage-800.woff"),
    font("archivo-500.woff"),
    font("archivo-700.woff"),
    font("spacemono-700.woff"),
  ]).then(([display, ui, uiBold, mono]) => [
    { name: "Display", data: display, weight: 800, style: "normal" },
    { name: "UI", data: ui, weight: 500, style: "normal" },
    { name: "UI", data: uiBold, weight: 700, style: "normal" },
    { name: "Mono", data: mono, weight: 700, style: "normal" },
  ]);
  return fonts;
}

async function render(node: React.ReactElement, headers?: HeadersInit) {
  return new ImageResponse(node, { ...ogSize, fonts: await loadFonts(), headers });
}

function Wordmark({ dark = false }: { dark?: boolean }) {
  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        gap: 14,
        fontFamily: "Display",
        fontWeight: 800,
        fontSize: 38,
        letterSpacing: -1.6,
        color: dark ? paper : ink,
      }}
    >
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          width: 54,
          height: 54,
          paddingBottom: 6,
          borderRadius: 15,
          background: accent,
          border: `3px solid ${ink}`,
          boxShadow: `3px 3px 0 ${dark ? paper : ink}`,
          color: ink,
          fontSize: 40,
        }}
      >
        p
      </div>
      <div style={{ display: "flex" }}>
        pedipue<span style={{ color: dark ? accent : "#855700" }}>.</span>
      </div>
    </div>
  );
}

function Tag({ children, dark = false }: { children: string; dark?: boolean }) {
  return (
    <div
      style={{
        display: "flex",
        padding: "9px 16px",
        borderRadius: 999,
        border: `2px solid ${dark ? paper : ink}`,
        color: dark ? paper : ink,
        fontFamily: "Mono",
        fontWeight: 700,
        fontSize: 18,
        letterSpacing: 0.5,
      }}
    >
      {children}
    </div>
  );
}

const slipLines = [
  ["2×", "Doble cheddar", "$ 25.000"],
  ["1×", "Papas con bacon", "$ 7.500"],
  ["1×", "Limonada", "$ 3.200"],
];

// Imagen de la landing: titular grande y el pedido como sticker.
export function siteOgImage() {
  return render(
    <div
      style={{
        display: "flex",
        width: "100%",
        height: "100%",
        background: paper,
        padding: "56px 64px",
        fontFamily: "UI",
        color: ink,
      }}
    >
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-between",
          width: 640,
        }}
      >
        <Wordmark />
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            fontFamily: "Display",
            fontWeight: 800,
            fontSize: 84,
            lineHeight: 0.95,
            letterSpacing: -3,
          }}
        >
          <span>Tu tienda online.</span>
          <span>Los pedidos,</span>
          <div style={{ display: "flex", marginTop: 10 }}>
            <span
              style={{
                padding: "0 18px 10px",
                background: accent,
                border: `3px solid ${ink}`,
                borderRadius: 14,
                boxShadow: `5px 5px 0 ${ink}`,
                transform: "rotate(-3deg)",
              }}
            >
              directo.
            </span>
          </div>
        </div>
        <div style={{ display: "flex", gap: 12 }}>
          <Tag>SIN COMISIONES</Tag>
          <Tag>PEDIDOS POR WHATSAPP</Tag>
        </div>
      </div>

      <div
        style={{
          display: "flex",
          flex: 1,
          alignItems: "center",
          justifyContent: "flex-end",
        }}
      >
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            width: 400,
            padding: "26px 28px 28px",
            background: ink,
            color: paper,
            borderRadius: 22,
            boxShadow: `8px 8px 0 ${accent}`,
            transform: "rotate(4deg)",
          }}
        >
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              fontFamily: "Mono",
              fontWeight: 700,
              fontSize: 18,
              color: accent,
            }}
          >
            <span>PEDIDO</span>
            <span>#0142</span>
          </div>
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 10,
              marginTop: 18,
              fontFamily: "Mono",
              fontWeight: 700,
              fontSize: 15,
            }}
          >
            <div
              style={{ width: 12, height: 12, borderRadius: 99, background: open }}
            />
            ABIERTO · HASTA 00:30
          </div>
          <div style={{ display: "flex", flexDirection: "column", marginTop: 14 }}>
            {slipLines.map(([qty, name, price]) => (
              <div
                key={name}
                style={{
                  display: "flex",
                  alignItems: "center",
                  padding: "13px 0",
                  borderBottom: `1.5px solid ${asphalt}`,
                  fontSize: 21,
                }}
              >
                <span style={{ fontFamily: "Mono", fontWeight: 700, width: 42, color: accent }}>
                  {qty}
                </span>
                <span style={{ flex: 1, fontWeight: 500 }}>{name}</span>
                <span style={{ fontFamily: "Mono", fontWeight: 700 }}>{price}</span>
              </div>
            ))}
          </div>
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              marginTop: 16,
              fontFamily: "Mono",
              fontWeight: 700,
              fontSize: 24,
            }}
          >
            <span>TOTAL</span>
            <span>$ 35.700</span>
          </div>
          <div
            style={{
              display: "flex",
              justifyContent: "center",
              marginTop: 22,
              padding: "16px 0",
              background: accent,
              color: ink,
              border: `2px solid ${paper}`,
              borderRadius: 14,
              fontWeight: 700,
              fontSize: 22,
            }}
          >
            Enviar pedido por WhatsApp
          </div>
        </div>
      </div>
    </div>,
  );
}

type StoreCard = { name: string; kind: string; city: string | null; host: string };

// Imagen de cada tienda: portada Asfalto, logo con la inicial y acento
// Mostaza hasta que existan la foto de portada, el logo y el acento propios.
export function storeOgImage(store: StoreCard) {
  const nameSize = store.name.length > 22 ? 76 : store.name.length > 14 ? 96 : 120;
  const detail = [store.kind, store.city].filter(Boolean).join(" · ").toUpperCase();
  return render(
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        justifyContent: "space-between",
        width: "100%",
        height: "100%",
        background: asphalt,
        padding: "56px 64px",
        fontFamily: "UI",
        color: paper,
      }}
    >
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            width: 132,
            height: 132,
            paddingBottom: 10,
            borderRadius: 30,
            background: accent,
            border: `3px solid ${ink}`,
            boxShadow: `6px 6px 0 ${ink}`,
            transform: "rotate(-5deg)",
            color: ink,
            fontFamily: "Display",
            fontWeight: 800,
            fontSize: 92,
          }}
        >
          {store.name.trim().slice(0, 1).toUpperCase()}
        </div>
        <div
          style={{
            display: "flex",
            padding: "8px 16px",
            background: paper,
            color: ink,
            border: `2px solid ${ink}`,
            borderRadius: 999,
            boxShadow: `3px 3px 0 ${ink}`,
            transform: "rotate(4deg)",
            fontFamily: "Mono",
            fontWeight: 700,
            fontSize: 20,
          }}
        >
          SIN APPS EN EL MEDIO
        </div>
      </div>

      <div style={{ display: "flex", flexDirection: "column", gap: 18 }}>
        {detail && (
          <div
            style={{
              display: "flex",
              fontFamily: "Mono",
              fontWeight: 700,
              fontSize: 24,
              color: accent,
            }}
          >
            {detail}
          </div>
        )}
        <div
          style={{
            display: "flex",
            fontFamily: "Display",
            fontWeight: 800,
            fontSize: nameSize,
            lineHeight: 0.95,
            letterSpacing: -3,
            maxWidth: 1072,
          }}
        >
          {store.name}
        </div>
      </div>

      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 20 }}>
          <div
            style={{
              display: "flex",
              padding: "16px 28px",
              background: accent,
              color: ink,
              border: `2px solid ${ink}`,
              borderRadius: 14,
              boxShadow: `3px 3px 0 ${ink}`,
              fontWeight: 700,
              fontSize: 28,
            }}
          >
            Pedí online →
          </div>
          <span style={{ fontFamily: "Mono", fontWeight: 700, fontSize: 22 }}>{store.host}</span>
        </div>
        <Wordmark dark />
      </div>
    </div>,
    { "Cache-Control": "public, max-age=3600, s-maxage=86400, stale-while-revalidate=604800" },
  );
}
