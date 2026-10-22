import { test } from "node:test";
import assert from "node:assert/strict";
import { columns, comandaReceipt, encodeText, rasterize, ticketReceipt, wrap } from "../src/lib/escpos";
import type { Order } from "../src/lib/checkout";

export const sample: Order = {
  id: "o1", number: 7, status: "accepted", customerName: "Balthasar De Weert", customerPhone: "+5493794721825",
  fulfillment: "delivery", address: "Avenida Pedro Ferré 2798, Corrientes", zoneName: "Centro", paymentMethod: "transfer",
  note: "", version: 2, createdAt: "2026-10-19T15:07:00Z", subtotalCents: 2300000, deliveryCents: 280000, totalCents: 2580000,
  items: [
    { productId: "p1", name: "2 Sándwiches a elección", variant: "Única", addOns: [], choices: ["Sándwiches: 2 Pollo completo"], quantity: 1, unitCents: 2000000, lineCents: 2000000 },
    { productId: "p2", name: "Batido GREEN POWER", variant: "Única", addOns: [], quantity: 1, unitCents: 300000, lineCents: 300000 },
  ],
};
// Printable text of a receipt: drops ESC/POS commands and maps CP850 back.
export function plain(buffer: Uint8Array) {
  const back: Record<number, string> = { 0xa0: "á", 0x82: "é", 0xa1: "í", 0xa2: "ó", 0xa3: "ú", 0xa4: "ñ", 0xa7: "º" };
  let out = "";
  for (let i = 0; i < buffer.length; i++) {
    const b = buffer[i];
    if (b === 0x1b) i += buffer[i + 1] === 0x40 ? 1 : 2;
    else if (b === 0x1d) i += buffer[i + 1] === 0x56 ? 3 : 2;
    else out += back[b] ?? String.fromCharCode(b);
  }
  return out;
}

test("encodes Spanish text for code page 850", () => {
  assert.deepEqual(encodeText("Ñoño ¿ok?"), [0xa5, 0x6f, 0xa4, 0x6f, 0x20, 0xa8, 0x6f, 0x6b, 0x3f]);
  assert.deepEqual(encodeText("2 × 1 • ç"), [...Buffer.from("2 x 1 - c")]);
});

test("wraps words and lines up amounts", () => {
  assert.deepEqual(wrap("uno dos tres", 7), ["uno dos", "tres"]);
  assert.deepEqual(wrap("abcdefghij", 4), ["abcd", "efgh", "ij"]);
  assert.deepEqual(wrap("  + queso extra", 9), ["  + queso", "  extra"]);
  assert.deepEqual(columns("2 Sándwiches a elección", "$ 20.000", 24), ["2 Sándwiches a", "elección        $ 20.000"]);
});

test("ticket and comanda fit the paper and end with a cut", () => {
  for (const width of [32, 48]) {
    const ticket = ticketReceipt(sample, "Liviano Jujuy", [{ id: "p1", category: "Combos" }, { id: "p2", category: "Batidos" }], "¡Gracias!", width);
    const text = plain(ticket);
    for (const line of text.split("\n")) assert.ok(line.length <= width, line);
    assert.match(text, /COMBOS[\s\S]*BATIDOS/);
    assert.match(text, /Transferencia +\$ 25\.800/);
    assert.match(text, /Comprobante no válido como\s+factura/);
    assert.deepEqual([...ticket.subarray(-4)], [0x1d, 0x56, 0x42, 3]);
    const comanda = plain(comandaReceipt(sample, "Liviano Jujuy", width));
    for (const line of comanda.split("\n")) assert.ok(line.length <= width, line);
    assert.match(comanda, /#007 +DELIVERY/);
  }
});

test("packs a logo into a raster and prints it before the ticket", () => {
  // 10×2 pixels: a black dot at (0,0), a light one at (1,0), a transparent black one at (9,1).
  const rgba = new Uint8ClampedArray(10 * 2 * 4).fill(255);
  rgba.set([0, 0, 0, 255], 0);
  rgba.set([200, 200, 200, 255], 4);
  rgba.set([0, 0, 0, 0], (1 * 10 + 9) * 4);
  const logo = rasterize(rgba, 10, 2);
  assert.equal(logo.width, 16);
  assert.deepEqual([...logo.bits], [0x80, 0, 0, 0]);
  const bytes = ticketReceipt(sample, "Pecado", [], "", 48, logo);
  const at = Buffer.from(bytes).indexOf(Buffer.from([0x1d, 0x76, 0x30, 0, 2, 0, 2, 0]));
  assert.ok(at > 0 && at < Buffer.from(bytes).indexOf(Buffer.from("Delivery")));
  assert.deepEqual([...bytes.slice(at + 8, at + 12)], [0x80, 0, 0, 0]);
});
