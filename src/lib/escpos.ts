import { formatMoney } from "./menu";
import { channelLabels, isDeliveryFeePending, type Order } from "./checkout";
import { groupByCategory, type ProductCategory } from "./ticket";

// Raw ESC/POS for thermal printers, so the print app only has to forward
// bytes. Font A fits 48 columns on 80 mm paper and 32 on 58 mm.
export const columnsFor = (paper: "58" | "80") => (paper === "58" ? 32 : 48);

// Code page 850 (ESC t 2) covers Spanish on almost every ESC/POS printer.
const cp850: Record<string, number> = {
  á: 0xa0, é: 0x82, í: 0xa1, ó: 0xa2, ú: 0xa3, ñ: 0xa4, Ñ: 0xa5, ü: 0x81,
  Ü: 0x9a, Á: 0xb5, É: 0x90, Í: 0xd6, Ó: 0xe0, Ú: 0xe9, "¿": 0xa8,
  "¡": 0xad, º: 0xa7, ª: 0xa6, "°": 0xf8,
};
const fallback: Record<string, string> = {
  "×": "x", "•": "-", "·": "-", "–": "-", "—": "-", "“": '"', "”": '"',
  "‘": "'", "’": "'", "…": "...", " ": " ",
};
export function encodeText(text: string): number[] {
  const out: number[] = [];
  for (const ch of text) {
    const code = ch.codePointAt(0)!;
    if (code >= 0x20 && code < 0x7f) out.push(code);
    else if (cp850[ch]) out.push(cp850[ch]);
    else if (fallback[ch]) out.push(...encodeText(fallback[ch]));
    else {
      const plain = ch.normalize("NFD").replace(/[̀-ͯ]/g, "");
      out.push(plain !== ch && plain.length ? plain.charCodeAt(0) : 0x3f);
    }
  }
  return out;
}

// Breaks text into lines of at most `width` characters, on spaces when it can.
// Leading spaces indent every line of the paragraph.
export function wrap(text: string, width: number): string[] {
  const lines: string[] = [];
  for (const paragraph of text.split("\n")) {
    const indent = paragraph.match(/^ */)![0].slice(0, width - 1);
    const start = lines.length;
    width -= indent.length;
    let line = "";
    for (const word of paragraph.split(/\s+/).filter(Boolean)) {
      let w = word;
      while (w.length > width) {
        if (line) lines.push(line), (line = "");
        lines.push(w.slice(0, width));
        w = w.slice(width);
      }
      if (!w) continue;
      if (!line) line = w;
      else if (line.length + 1 + w.length <= width) line += " " + w;
      else lines.push(line), (line = w);
    }
    lines.push(line);
    for (let i = start; i < lines.length; i++) lines[i] = indent + lines[i];
    width += indent.length;
  }
  return lines;
}

// Left text and a right-aligned amount on the same line; the text wraps.
export function columns(left: string, right: string, width: number) {
  const room = width - right.length - 1;
  const lines = wrap(left, room);
  const last = lines.length - 1;
  return lines.map((l, i) =>
    i === last ? l.padEnd(room) + " " + right : l,
  );
}

// A 1-bit image for the printer: rows of `width / 8` bytes, top bit first, 1 = black.
export type Raster = { width: number; height: number; bits: Uint8Array };

/** Packs RGBA pixels (from a canvas) into a raster. Dark, opaque pixels print. */
export function rasterize(
  rgba: Uint8ClampedArray,
  width: number,
  height: number,
): Raster {
  const rowBytes = Math.ceil(width / 8);
  const bits = new Uint8Array(rowBytes * height);
  for (let y = 0; y < height; y++)
    for (let x = 0; x < width; x++) {
      const i = (y * width + x) * 4;
      const light = rgba[i] * 0.299 + rgba[i + 1] * 0.587 + rgba[i + 2] * 0.114;
      if (rgba[i + 3] > 127 && light < 128)
        bits[y * rowBytes + (x >> 3)] |= 0x80 >> (x & 7);
    }
  return { width: rowBytes * 8, height, bits };
}

type Style = { bold?: boolean; big?: boolean; center?: boolean };
export class Receipt {
  private bytes: number[] = [0x1b, 0x40, 0x1b, 0x74, 0x02];
  constructor(readonly width: number) {}
  line(text = "", style: Style = {}) {
    const width = style.big ? Math.floor(this.width / 2) : this.width;
    for (const l of wrap(text, width)) this.raw(l, style);
    return this;
  }
  /** One already laid-out line, written as is. */
  raw(text: string, style: Style = {}) {
    if (style.center) this.bytes.push(0x1b, 0x61, 1);
    if (style.bold) this.bytes.push(0x1b, 0x45, 1);
    if (style.big) this.bytes.push(0x1d, 0x21, 0x11);
    this.bytes.push(...encodeText(text), 0x0a);
    if (style.big) this.bytes.push(0x1d, 0x21, 0);
    if (style.bold) this.bytes.push(0x1b, 0x45, 0);
    if (style.center) this.bytes.push(0x1b, 0x61, 0);
    return this;
  }
  /** A centered picture, as raster bit image (GS v 0). */
  image({ width, height, bits }: Raster) {
    const rowBytes = width / 8;
    this.bytes.push(0x1b, 0x61, 1);
    this.bytes.push(0x1d, 0x76, 0x30, 0, rowBytes & 0xff, rowBytes >> 8, height & 0xff, height >> 8);
    for (const b of bits) this.bytes.push(b);
    this.bytes.push(0x0a, 0x1b, 0x61, 0);
    return this;
  }
  amount(left: string, right: string, style: Style = {}) {
    for (const l of columns(left, right, this.width)) this.raw(l, style);
    return this;
  }
  rule(char = "-") {
    return this.raw(char.repeat(this.width));
  }
  /** Feeds past the cutter and cuts, leaving a small hinge. */
  cut() {
    this.bytes.push(0x1d, 0x56, 0x42, 3);
    return this;
  }
  toBytes() {
    return Uint8Array.from(this.bytes);
  }
}

const zone = "America/Argentina/Cordoba";
const dateTime = new Intl.DateTimeFormat("es-AR", {
  timeZone: zone, day: "2-digit", month: "2-digit", year: "numeric",
  hour: "2-digit", minute: "2-digit", hourCycle: "h23",
});
const day = new Intl.DateTimeFormat("es-AR", {
  timeZone: zone, weekday: "long", day: "numeric", month: "long", year: "numeric",
});
const time = new Intl.DateTimeFormat("es-AR", {
  timeZone: zone, hour: "2-digit", minute: "2-digit", hourCycle: "h23",
});
const money = (cents: number) => formatMoney(cents).replace(/ /g, " ");
const payment = (o: Order) =>
  o.paymentMethod === "cash" ? "Efectivo" : "Transferencia";

// Same content as the printable comanda in the orders inbox.
export function comandaReceipt(o: Order, businessName: string, width: number) {
  const r = new Receipt(width);
  r.line(businessName.toUpperCase(), { center: true }).rule("=");
  r.amount(
    `#${o.number.toString().padStart(3, "0")}`,
    o.fulfillment === "delivery" ? "DELIVERY" : "RETIRA",
    { bold: true },
  );
  r.rule("=").line(
    `${dateTime.format(new Date(o.createdAt))}${o.channel && o.channel !== "store" ? ` - ${channelLabels[o.channel].toUpperCase()}` : ""}`,
  );
  r.line([o.customerName, o.customerPhone].filter(Boolean).join(" - "), { bold: true });
  if (o.address)
    r.line(`${o.address}${o.zoneName ? ` (${o.zoneName})` : ""}`);
  r.rule();
  for (const i of o.items) {
    r.line(
      `${i.quantity} x ${i.name}${i.variant !== "Única" ? ` - ${i.variant}` : ""}`,
      { bold: true },
    );
    if (i.addOns.length) r.line(`  + ${i.addOns.join(", ")}`);
    for (const c of i.choices ?? []) r.line(`  ${c}`);
  }
  r.rule();
  if (o.note) r.line(`NOTA: ${o.note}`, { bold: true }).rule();
  r.amount(payment(o), money(o.totalCents), { bold: true });
  return r.line().line().cut().toBytes();
}

// Same content as the customer ticket in the orders inbox.
export function ticketReceipt(
  o: Order,
  businessName: string,
  categories: ProductCategory[],
  footer: string,
  width: number,
  logo?: Raster | null,
) {
  const created = new Date(o.createdAt);
  const feePending = isDeliveryFeePending(o);
  const r = new Receipt(width);
  if (logo) r.image(logo).line();
  r.line(`${o.fulfillment === "delivery" ? "Delivery" : "Retiro"} Nº${o.number}`, { big: true });
  r.line(businessName, { bold: true });
  r.line(day.format(created).replace(",", ""));
  r.line(`Creado a las ${time.format(created)}`).line();
  r.line(o.customerName, { bold: true });
  if (o.customerPhone) r.line(o.customerPhone);
  if (o.address) {
    r.line().line(o.address);
    if (o.zoneName) r.line(o.zoneName);
  }
  for (const g of groupByCategory(o.items, categories)) {
    r.line().line(g.category.toUpperCase(), { bold: true });
    for (const i of g.items) {
      r.amount(`${i.quantity} ${i.name}`, money(i.lineCents));
      if (i.variant !== "Única") r.line(`  ${i.variant}`);
      if (i.addOns.length) r.line(`  + ${i.addOns.join(", ")}`);
      for (const c of i.choices ?? []) r.line(`  - ${c}`);
    }
  }
  if (o.note) r.line().line(`Nota: ${o.note}`);
  r.line().amount("Subtotal", money(o.subtotalCents));
  if (o.fulfillment === "delivery")
    r.amount("Envío", feePending ? "A confirmar" : money(o.deliveryCents));
  r.rule().amount(
    `${feePending ? "Sin envío - " : ""}${payment(o)}`,
    money(o.totalCents),
    { bold: true },
  );
  r.rule().line().line("Comprobante no válido como factura.");
  if (footer) r.line().line(footer, { center: true });
  r.line().line("Pedido hecho con pedipue.com", { center: true });
  return r.line().line().cut().toBytes();
}

// Printed from the settings to check the connection and the paper width.
export function testPage(businessName: string, width: number) {
  const r = new Receipt(width);
  r.line("Pedipue", { big: true, center: true });
  r.line(businessName, { center: true }).rule();
  r.line("La impresora quedó conectada. Los pedidos van a salir solos por acá.");
  r.rule().raw("1234567890".repeat(5).slice(0, width));
  r.line(`Esta línea mide ${width} caracteres, el ancho del papel.`);
  return r.line().line().cut().toBytes();
}
