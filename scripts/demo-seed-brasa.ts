// Carga Brasa Club con datos de demo en la base indicada por .env.local.
// Uso (desde la raíz del repo): node --conditions=react-server --import tsx <ruta>/seed.ts <carpeta-fotos>
import { randomUUID } from "node:crypto";
import { readFileSync } from "node:fs";
import { createBusiness } from "../src/server/businesses";
import { getPool } from "../src/server/postgres";
import { saveProduct, saveSettings, publishStore } from "../src/server/menu";
import { saveMenuImage } from "../src/server/menu-images";
import { advanceOrder, checkout, createManualOrder, decideOrder } from "../src/server/orders";
import { saveTicketConfig, saveKitchenConfig } from "../src/server/ticket";
import { runCashCommand } from "../src/server/cash";
import { executeManagement } from "../src/server/management";
import { checkoutInput, manualOrderInput } from "../src/lib/checkout";
import { productInput, settingsInput } from "../src/lib/menu";
import { commandSchema } from "../src/lib/management";
import { cashCommand } from "../src/lib/cash";

process.loadEnvFile(".env.local");
const IMG = process.argv[2];
const USER = "demo-user-brasa";
const pool = getPool();
const id = () => randomUUID();
const $ = (pesos: number) => Math.round(pesos * 100);
let seed = 42;
const rnd = () => ((seed = (seed * 1103515245 + 12345) % 2 ** 31) / 2 ** 31);
const pick = <T,>(a: T[]) => a[Math.floor(rnd() * a.length)];

async function photo(name: string, businessId: string) {
  const img = await saveMenuImage(businessId, USER, readFileSync(`${IMG}/${name}.jpg`));
  return img.url;
}

type P = { name: string; desc: string; cat: string; img: string; variants: [string, number][]; addOns?: [string, number][]; groups?: { name: string; min: number; max: number; options: [string, number][] }[]; kind?: "product" | "combo" };

const menu: P[] = [
  { cat: "Hamburguesas", name: "Clásica", img: "clasica", desc: "Pan de papa, medallón de 120 g, queso tybo, lechuga, tomate y salsa Brasa. Con papas.", variants: [["Simple", 6500], ["Doble", 8500]], addOns: [["Extra cheddar", 900], ["Panceta", 1200], ["Huevo frito", 700]], groups: [{ name: "Punto de la carne", min: 1, max: 1, options: [["Jugosa", 0], ["A punto", 0], ["Bien cocida", 0]] }] },
  { cat: "Hamburguesas", name: "Cheddar & bacon", img: "cheddar-bacon", desc: "Doble cheddar fundido, panceta ahumada crocante y huevo frito. Con papas.", variants: [["Simple", 9000], ["Doble", 11000]], addOns: [["Extra cheddar", 900], ["Cebolla caramelizada", 800]], groups: [{ name: "Punto de la carne", min: 1, max: 1, options: [["Jugosa", 0], ["A punto", 0], ["Bien cocida", 0]] }] },
  { cat: "Hamburguesas", name: "Doble Brasa", img: "doble-brasa", desc: "Dos medallones a la brasa, doble queso, jamón cocido y huevo. La más pedida.", variants: [["Doble", 11000], ["Triple", 13500]], addOns: [["Panceta", 1200], ["Extra cheddar", 900]] },
  { cat: "Hamburguesas", name: "Crispy onion", img: "crispy-onion", desc: "Medallón, cheddar, aros de cebolla crocantes y salsa barbacoa casera.", variants: [["Simple", 9500], ["Doble", 11500]], addOns: [["Panceta", 1200]] },
  { cat: "Hamburguesas", name: "Picante", img: "picante", desc: "Medallón, pepper jack, jalapeños, cebolla morada y mayo chipotle. Pica en serio.", variants: [["Simple", 9200], ["Doble", 11200]] },
  { cat: "Hamburguesas", name: "Veggie", img: "veggie", desc: "Medallón de garbanzos y quinoa, palta, rúcula, tomate y alioli. Con papas.", variants: [["Simple", 8500]] },
  { cat: "Sándwiches", name: "Lomito completo", img: "lomito", desc: "Lomo de ternera, jamón, queso, huevo, lechuga, tomate y mayonesa en pan árabe.", variants: [["Individual", 10500], ["Para compartir", 18500]] },
  { cat: "Sándwiches", name: "Pollo crispy", img: "pollo-crispy", desc: "Pechuga rebozada crocante, coleslaw, pepinos y salsa honey mustard.", variants: [["Individual", 8800]] },
  { cat: "Sándwiches", name: "Pancho Brasa", img: "pancho", desc: "Salchicha alemana, papas pay, cheddar y panceta crocante.", variants: [["Individual", 4500]] },
  { cat: "Papas y extras", name: "Papas fritas", img: "papas", desc: "Papas bastón doble cocción con sal de la casa.", variants: [["Chicas", 3500], ["Grandes", 5000]], groups: [{ name: "Elegí la salsa", min: 0, max: 2, options: [["Ketchup", 0], ["Mayo de ajo", 0], ["Barbacoa", 0], ["Chipotle", 300]] }] },
  { cat: "Papas y extras", name: "Papas cheddar & bacon", img: "papas-cheddar", desc: "Papas grandes con salsa cheddar, panceta y verdeo.", variants: [["Para compartir", 6500]] },
  { cat: "Papas y extras", name: "Aros de cebolla", img: "aros", desc: "Diez aros rebozados en cerveza, con dip barbacoa.", variants: [["Porción", 4200]] },
  { cat: "Papas y extras", name: "Nuggets de pollo", img: "nuggets", desc: "Pollo casero rebozado, con salsa a elección.", variants: [["6 unidades", 4800], ["12 unidades", 8500]] },
  { cat: "Combos", kind: "combo", name: "Combo Clásica", img: "combo-clasica", desc: "Clásica simple, papas chicas y gaseosa de 500 ml.", variants: [["Combo", 10500]], groups: [{ name: "Gaseosa", min: 1, max: 1, options: [["Coca-Cola", 0], ["Coca-Cola Zero", 0], ["Sprite", 0], ["Fanta", 0]] }] },
  { cat: "Combos", kind: "combo", name: "Combo Doble Brasa", img: "combo-doble", desc: "Doble Brasa, papas grandes y gaseosa de 500 ml.", variants: [["Combo", 14500]], groups: [{ name: "Gaseosa", min: 1, max: 1, options: [["Coca-Cola", 0], ["Coca-Cola Zero", 0], ["Sprite", 0], ["Fanta", 0]] }] },
  { cat: "Combos", kind: "combo", name: "2 sándwiches a elección", img: "combo-2-sandwiches", desc: "Elegí dos sándwiches y llevalos con una porción de papas para compartir.", variants: [["Combo", 20000]], groups: [{ name: "Sándwiches", min: 2, max: 2, options: [["Lomito completo", 0], ["Pollo crispy", 0], ["Pancho Brasa", 0]] }] },
  { cat: "Bebidas", name: "Gaseosa 500 ml", img: "gaseosa", desc: "Coca-Cola, Coca-Cola Zero, Sprite o Fanta.", variants: [["500 ml", 2000]], groups: [{ name: "Sabor", min: 1, max: 1, options: [["Coca-Cola", 0], ["Coca-Cola Zero", 0], ["Sprite", 0], ["Fanta", 0]] }] },
  { cat: "Bebidas", name: "Pinta artesanal", img: "cerveza", desc: "Cerveza tirada de cervecería local. Mayores de 18.", variants: [["Golden", 4000], ["IPA", 4500], ["Stout", 4500]] },
  { cat: "Bebidas", name: "Limonada con jengibre", img: "limonada", desc: "Hecha en el momento, con menta y jengibre.", variants: [["Vaso 500 ml", 2800], ["Jarra 1 L", 5000]] },
  { cat: "Bebidas", name: "Agua mineral", img: "agua", desc: "Con o sin gas.", variants: [["500 ml", 1500]] },
  { cat: "Postres", name: "Brownie con helado", img: "brownie", desc: "Brownie tibio de chocolate semiamargo con bocha de americana.", variants: [["Porción", 4500]] },
  { cat: "Postres", name: "Flan casero", img: "flan", desc: "Con dulce de leche o crema.", variants: [["Porción", 3500]] },
];

const names = ["Martina Gómez", "Lucas Fernández", "Sofía Benítez", "Tomás Romero", "Valentina Acosta", "Facundo Ojeda", "Camila Sosa", "Nicolás Duarte", "Agustina Ramírez", "Joaquín Leiva", "Florencia Cáceres", "Matías Aguirre", "Julieta Vallejos", "Santiago Insaurralde", "Rocío Maidana", "Franco Escobar", "Micaela Galarza", "Ignacio Ponce"];
const streets = ["Av. 3 de Abril 1240", "Junín 856", "San Juan 1532", "Av. Costanera 2100, depto 4B", "Mendoza 760", "Belgrano 1988", "La Rioja 545", "Av. Maipú 3200", "Catamarca 1120", "Pellegrini 1450", "Bolívar 980", "Av. Pedro Ferré 2798"];
const notes = ["", "", "", "Sin cebolla, por favor", "Tocar timbre 2", "Mayo aparte", "Pago con $20.000", "", "La papas bien crocantes", "Dejar en portería"];

async function main() {
  const existing = await pool.query("SELECT id FROM businesses WHERE slug='brasa-club'");
  if (existing.rowCount) throw new Error("brasa-club ya existe en esta base");

  const businessId = await createBusiness(USER, { name: "Brasa Club", slug: "brasa-club", kind: "hamburgueseria", whatsapp: "+5493794550123", city: "Corrientes", address: "Junín 1450", requestKey: id() });
  console.log("negocio", businessId);

  const cover = await photo("cover", businessId);
  const products: (Awaited<ReturnType<typeof saveProduct>> & { p: P })[] = [];
  for (const [i, p] of menu.entries()) {
    const saved = await saveProduct(businessId, productInput.parse({
      name: p.name, description: p.desc, category: p.cat, kind: p.kind ?? "product",
      variants: p.variants.map(([name, pesos]) => ({ id: id(), name, priceCents: $(pesos) })),
      addOns: (p.addOns ?? []).map(([name, pesos]) => ({ id: id(), name, priceCents: $(pesos) })),
      optionGroups: (p.groups ?? []).map((g) => ({ id: id(), name: g.name, min: g.min, max: g.max, repeat: false, options: g.options.map(([name, pesos]) => ({ id: id(), name, priceCents: $(pesos) })) })),
      imageUrl: await photo(p.img, businessId), sortOrder: i,
    }));
    products.push({ ...saved, p });
  }
  console.log("productos", products.length);

  const zones = [
    { id: id(), name: "Centro", feeCents: $(1500), minimumCents: $(8000) },
    { id: id(), name: "Camba Cuá y San Benito", feeCents: $(2200), minimumCents: $(10000) },
    { id: id(), name: "Barrio Libertad y Laguna Seca", feeCents: $(2800), minimumCents: $(12000) },
  ];
  const hours = [0, 1, 2, 3, 4, 5, 6].flatMap((day) => [{ day, opens: "11:30", closes: "15:30" }, { day, opens: "19:00", closes: "03:00" }]);
  await saveSettings(businessId, settingsInput.parse({
    description: "Hamburguesas a la brasa, papas de verdad y pintas bien frías. Pedí directo y retirá en Junín 1450 o te lo llevamos.",
    menuNote: "Todas las hamburguesas salen con papas. Si tenés alguna alergia, avisanos en la nota del pedido.",
    coverImageUrl: cover, coverFocusX: 70, coverFocusY: 50, hours,
    pickupEnabled: true, pickupInstructions: "Retirá por Junín 1450, mostrador de la izquierda. Avisanos tu nombre.",
    deliveryEnabled: true, deliveryZones: zones, deliveryConfig: { mode: "manual" },
    paymentMethods: ["cash", "transfer"], transferAlias: "brasa.club.ctes",
  }), 1);
  await publishStore(businessId, true);
  await saveTicketConfig(businessId, { enabled: true, paper: "80", footer: "¡Gracias por pedir directo! @brasaclub.ctes" });
  await saveKitchenConfig(businessId, { defaultMinutes: 25, warnMinutes: 7 });

  // Gestión: insumos, proveedores y compras antes de vender, así las ventas descuentan stock.
  const mg = (c: unknown) => executeManagement(businessId, USER, commandSchema.parse(c), true);
  // nombre: unidad, mínimo, kind, proveedor, [cantidad, unidad de compra, total en pesos]
  const items: [string, "g" | "ml" | "unit", string, "ingredient" | "finished", string, [string, string, number]][] = [
    ["Pan de papa", "unit", "40", "ingredient", "Panificadora Don Ramón", ["500", "unit", 225000]],
    ["Pan árabe", "unit", "20", "ingredient", "Panificadora Don Ramón", ["120", "unit", 72000]],
    ["Pan de pancho", "unit", "20", "ingredient", "Panificadora Don Ramón", ["150", "unit", 30000]],
    ["Medallón 120 g", "unit", "60", "ingredient", "Frigorífico Litoral", ["700", "unit", 910000]],
    ["Panceta ahumada", "g", "1000", "ingredient", "Frigorífico Litoral", ["12", "kg", 204000]],
    ["Lomo de ternera", "g", "2000", "ingredient", "Frigorífico Litoral", ["20", "kg", 380000]],
    ["Jamón cocido", "g", "500", "ingredient", "Frigorífico Litoral", ["12", "kg", 144000]],
    ["Pechuga de pollo", "g", "2000", "ingredient", "Frigorífico Litoral", ["25", "kg", 175000]],
    ["Salchicha alemana", "unit", "20", "ingredient", "Frigorífico Litoral", ["150", "unit", 75000]],
    ["Cheddar en fetas", "unit", "80", "ingredient", "Distribuidora Guaraní", ["900", "unit", 234000]],
    ["Salsa cheddar", "g", "1000", "ingredient", "Distribuidora Guaraní", ["8", "kg", 64000]],
    ["Papas bastón congeladas", "g", "8000", "ingredient", "Distribuidora Guaraní", ["120", "kg", 480000]],
    ["Huevos", "unit", "30", "ingredient", "Distribuidora Guaraní", ["360", "unit", 72000]],
    ["Gaseosa 500 ml", "unit", "24", "ingredient", "Distribuidora Guaraní", ["400", "unit", 440000]],
    ["Agua mineral 500 ml", "unit", "24", "ingredient", "Distribuidora Guaraní", ["200", "unit", 120000]],
    ["Cerveza tirada", "ml", "10000", "ingredient", "Distribuidora Guaraní", ["120", "l", 360000]],
    ["Medallón veggie", "unit", "10", "ingredient", "Distribuidora Guaraní", ["60", "unit", 54000]],
    ["Helado americana", "g", "1000", "ingredient", "Distribuidora Guaraní", ["6", "kg", 42000]],
    ["Lechuga", "g", "500", "ingredient", "Verdulería El Puerto", ["8", "kg", 24000]],
    ["Tomate", "g", "1000", "ingredient", "Verdulería El Puerto", ["15", "kg", 36000]],
    ["Cebolla", "g", "1000", "ingredient", "Verdulería El Puerto", ["10", "kg", 12000]],
    ["Palta", "unit", "6", "ingredient", "Verdulería El Puerto", ["30", "unit", 30000]],
    ["Limones", "unit", "20", "ingredient", "Verdulería El Puerto", ["200", "unit", 30000]],
    ["Jalapeños", "g", "300", "ingredient", "Verdulería El Puerto", ["2", "kg", 16000]],
    ["Brownie", "unit", "10", "finished", "Panificadora Don Ramón", ["80", "unit", 96000]],
    ["Flan casero", "unit", "10", "finished", "Panificadora Don Ramón", ["80", "unit", 64000]],
  ];
  for (const [name, unit, minimum, kind] of items)
    await mg({ requestKey: id(), type: "item", name, kind, unit, minimum });
  for (const s of [["Panificadora Don Ramón", "379 442-1180"], ["Frigorífico Litoral", "379 455-9012"], ["Distribuidora Guaraní", "379 461-3344"], ["Verdulería El Puerto", "379 470-2210"]])
    await mg({ requestKey: id(), type: "supplier", name: s[0], contact: s[1] });
  const itemId = async (n: string) => (await pool.query<{ id: string }>("SELECT id FROM inventory_items WHERE business_id=$1 AND name=$2", [businessId, n])).rows[0].id;
  const supplierId = async (n: string) => (await pool.query<{ id: string }>("SELECT id FROM suppliers WHERE business_id=$1 AND name=$2", [businessId, n])).rows[0].id;
  for (const supplier of new Set(items.map((i) => i[4])))
    await mg({ requestKey: id(), type: "purchase", supplierId: await supplierId(supplier), lines: await Promise.all(items.filter((i) => i[4] === supplier).map(async ([name, , , , , [quantity, unit, pesos]]) => ({ itemId: await itemId(name), quantity, unit, totalCents: String($(pesos)) }))) });

  const prod = (n: string) => products.find((p) => p.name === n)!;
  type L = [string, string] | [string, string, string];
  const lines = (ls: L[]) => Promise.all(ls.map(async (l) => l.length === 2 ? { itemId: await itemId(l[0]), quantity: l[1] } : { productId: prod(l[0]).id, variantId: prod(l[0]).variants.find((v) => v.name === l[1])!.id, quantity: l[2] }));
  const recipe = async (n: string, variant: string, ls: L[]) => {
    const p = prod(n);
    await mg({ requestKey: id(), type: "recipe", productId: p.id, optionId: p.variants.find((v) => v.name === variant)!.id, optionKind: "variant", version: 0, lines: await lines(ls) });
  };
  const burger = (med: string, ched: string, extra: [string, string][]): L[] => [["Pan de papa", "1"], ["Medallón 120 g", med], ["Cheddar en fetas", ched], ["Papas bastón congeladas", "180"], ...extra];
  await recipe("Clásica", "Simple", burger("1", "1", [["Lechuga", "15"], ["Tomate", "30"]]));
  await recipe("Clásica", "Doble", burger("2", "2", [["Lechuga", "15"], ["Tomate", "30"]]));
  await recipe("Cheddar & bacon", "Simple", burger("1", "2", [["Panceta ahumada", "40"], ["Huevos", "1"]]));
  await recipe("Cheddar & bacon", "Doble", burger("2", "3", [["Panceta ahumada", "60"], ["Huevos", "1"]]));
  await recipe("Doble Brasa", "Doble", burger("2", "2", [["Jamón cocido", "40"], ["Huevos", "1"]]));
  await recipe("Doble Brasa", "Triple", burger("3", "3", [["Jamón cocido", "60"], ["Huevos", "1"]]));
  await recipe("Crispy onion", "Simple", burger("1", "1", [["Cebolla", "120"]]));
  await recipe("Crispy onion", "Doble", burger("2", "2", [["Cebolla", "120"]]));
  await recipe("Picante", "Simple", burger("1", "1", [["Jalapeños", "30"], ["Cebolla", "30"]]));
  await recipe("Picante", "Doble", burger("2", "2", [["Jalapeños", "30"], ["Cebolla", "30"]]));
  await recipe("Veggie", "Simple", [["Pan de papa", "1"], ["Medallón veggie", "1"], ["Palta", "0.5"], ["Tomate", "30"], ["Lechuga", "15"], ["Papas bastón congeladas", "180"]]);
  await recipe("Lomito completo", "Individual", [["Pan árabe", "1"], ["Lomo de ternera", "180"], ["Jamón cocido", "40"], ["Cheddar en fetas", "1"], ["Huevos", "1"], ["Lechuga", "15"], ["Tomate", "30"]]);
  await recipe("Lomito completo", "Para compartir", [["Pan árabe", "2"], ["Lomo de ternera", "360"], ["Jamón cocido", "80"], ["Cheddar en fetas", "2"], ["Huevos", "2"], ["Lechuga", "30"], ["Tomate", "60"]]);
  await recipe("Pollo crispy", "Individual", [["Pan de papa", "1"], ["Pechuga de pollo", "180"], ["Lechuga", "20"]]);
  await recipe("Pancho Brasa", "Individual", [["Pan de pancho", "1"], ["Salchicha alemana", "1"], ["Cheddar en fetas", "1"], ["Panceta ahumada", "20"]]);
  await recipe("Papas fritas", "Chicas", [["Papas bastón congeladas", "200"]]);
  await recipe("Papas fritas", "Grandes", [["Papas bastón congeladas", "350"]]);
  await recipe("Papas cheddar & bacon", "Para compartir", [["Papas bastón congeladas", "350"], ["Salsa cheddar", "120"], ["Panceta ahumada", "40"]]);
  await recipe("Aros de cebolla", "Porción", [["Cebolla", "250"]]);
  await recipe("Nuggets de pollo", "6 unidades", [["Pechuga de pollo", "150"]]);
  await recipe("Nuggets de pollo", "12 unidades", [["Pechuga de pollo", "300"]]);
  await recipe("Gaseosa 500 ml", "500 ml", [["Gaseosa 500 ml", "1"]]);
  await recipe("Pinta artesanal", "Golden", [["Cerveza tirada", "500"]]);
  await recipe("Pinta artesanal", "IPA", [["Cerveza tirada", "500"]]);
  await recipe("Pinta artesanal", "Stout", [["Cerveza tirada", "500"]]);
  await recipe("Limonada con jengibre", "Vaso 500 ml", [["Limones", "2"]]);
  await recipe("Limonada con jengibre", "Jarra 1 L", [["Limones", "4"]]);
  await recipe("Agua mineral", "500 ml", [["Agua mineral 500 ml", "1"]]);
  await recipe("Brownie con helado", "Porción", [["Brownie", "1"], ["Helado americana", "80"]]);
  await recipe("Flan casero", "Porción", [["Flan casero", "1"]]);
  await recipe("Combo Clásica", "Combo", [["Clásica", "Simple", "1"], ["Papas fritas", "Chicas", "1"], ["Gaseosa 500 ml", "500 ml", "1"]]);
  await recipe("Combo Doble Brasa", "Combo", [["Doble Brasa", "Doble", "1"], ["Papas fritas", "Grandes", "1"], ["Gaseosa 500 ml", "500 ml", "1"]]);
  await recipe("2 sándwiches a elección", "Combo", [["Papas fritas", "Grandes", "1"]]);
  // Adicionales con insumos; las elecciones (punto, salsa, sabor) no consumen, salvo los sándwiches del combo.
  const addonStock: Record<string, L[]> = { "Extra cheddar": [["Cheddar en fetas", "1"]], Panceta: [["Panceta ahumada", "40"]], "Huevo frito": [["Huevos", "1"]], "Cebolla caramelizada": [["Cebolla", "80"]], "Lomito completo": [["Lomito completo", "Individual", "1"]], "Pollo crispy": [["Pollo crispy", "Individual", "1"]], "Pancho Brasa": [["Pancho Brasa", "Individual", "1"]] };
  for (const p of products)
    for (const o of [...p.addOns, ...p.optionGroups.flatMap((g) => g.options)]) {
      const ls = addonStock[o.name];
      await mg({ requestKey: id(), type: "recipe", productId: p.id, optionId: o.id, optionKind: "addon", version: 0, lines: ls ? await lines(ls) : [], noConsumption: !ls });
    }

  // Pedidos. Cada línea elige variante y, si hace falta, las opciones mínimas.
  const line = (n: string, qty = 1, variantIdx = 0, extras = 0) => {
    const p = prod(n);
    const v = p.variants[Math.min(variantIdx, p.variants.length - 1)];
    const addOns = (p.addOns ?? []).slice(0, extras);
    const choiceIds = (p.optionGroups ?? []).flatMap((g) => g.options.slice(0, g.min).map((o, i) => (g.min === 1 ? pick(g.options) : g.options[i]).id));
    const choicePrice = (p.optionGroups ?? []).flatMap((g) => g.options).filter((o) => choiceIds.includes(o.id)).reduce((s, o) => s + o.priceCents, 0);
    return { productId: p.id, variantId: v.id, addOnIds: addOns.map((a) => a.id), choiceIds, quantity: qty, quotedUnitCents: v.priceCents + addOns.reduce((s, a) => s + a.priceCents, 0) + choicePrice };
  };
  const carts = [
    () => [line("Clásica", 2), line("Papas fritas", 1, 1), line("Gaseosa 500 ml", 2)],
    () => [line("Cheddar & bacon", 1, 1), line("Pinta artesanal", 1, 1)],
    () => [line("Combo Doble Brasa", 2), line("Brownie con helado")],
    () => [line("Doble Brasa", 1, 0, 1), line("Papas cheddar & bacon"), line("Limonada con jengibre", 1, 1)],
    () => [line("2 sándwiches a elección"), line("Gaseosa 500 ml", 2)],
    () => [line("Combo Clásica", 3), line("Nuggets de pollo", 1, 1)],
    () => [line("Lomito completo", 1, 1), line("Papas fritas", 1, 1), line("Pinta artesanal", 2)],
    () => [line("Crispy onion"), line("Picante", 1, 1), line("Aros de cebolla"), line("Gaseosa 500 ml", 2)],
    () => [line("Veggie"), line("Limonada con jengibre"), line("Flan casero")],
    () => [line("Pollo crispy", 2), line("Papas fritas"), line("Agua mineral", 2)],
    () => [line("Pancho Brasa", 3), line("Gaseosa 500 ml", 3)],
  ];

  const storeOrder = async (opts: { delivery?: boolean; pay?: "cash" | "transfer" }) => {
    const delivery = opts.delivery ?? rnd() < 0.6;
    const zone = pick(zones);
    let items = pick(carts)();
    const sub = () => items.reduce((s, l) => s + l.quotedUnitCents * l.quantity, 0);
    while (delivery && sub() < zone.minimumCents) items = [...items, line("Gaseosa 500 ml")];
    return checkout("brasa-club", checkoutInput.parse({
      requestKey: id(), customerName: pick(names), customerPhone: `+54937946${String(Math.floor(rnd() * 90000) + 10000)}`,
      fulfillment: delivery ? "delivery" : "pickup", address: delivery ? pick(streets) : "", zoneId: delivery ? zone.id : null,
      paymentMethod: opts.pay ?? (rnd() < 0.55 ? "transfer" : "cash"), note: pick(notes), items,
    }), "http://localhost:3000");
  };
  const manualOrder = (channel: "counter" | "phone" | "whatsapp") => {
    const delivery = channel !== "counter" && rnd() < 0.5;
    return createManualOrder(businessId, USER, manualOrderInput.parse({
      requestKey: id(), channel, customerName: channel === "counter" ? "" : pick(names), customerPhone: channel === "counter" ? "" : `379 46${Math.floor(rnd() * 90000) + 10000}`,
      fulfillment: delivery ? "delivery" : "pickup", address: delivery ? pick(streets) : "", zoneId: delivery ? pick(zones).id : null,
      paymentMethod: rnd() < 0.5 ? "cash" : "transfer", items: pick(carts)(), preparationMinutes: 25,
    }));
  };
  const orderIdOf = (o: unknown) => (o as { order?: { id: string }; id?: string }).order?.id ?? (o as { id: string }).id;
  const row = async (oid: string) => (await pool.query<{ version: number; fulfillment: string; total_cents: number; payment_method: string }>("SELECT version,fulfillment,total_cents,payment_method FROM orders WHERE id=$1", [oid])).rows[0];
  const accept = async (oid: string, minutes = 25) => decideOrder(businessId, oid, (await row(oid)).version, "accepted", USER, minutes);
  const advance = async (oid: string, stage: "preparing" | "ready" | "on_the_way" | "delivered") => advanceOrder(businessId, oid, (await row(oid)).version, stage);
  const finish = async (oid: string) => {
    await advance(oid, "ready");
    if ((await row(oid)).fulfillment === "delivery") await advance(oid, "on_the_way");
    await advance(oid, "delivered");
  };

  // Historial: 14 días anteriores, 6 a 14 pedidos por día, todos entregados.
  const history: { id: string; at: Date }[] = [];
  for (let d = 14; d >= 1; d--) {
    const n = 6 + Math.floor(rnd() * 9) + (d % 7 === 1 || d % 7 === 2 ? 5 : 0);
    for (let k = 0; k < n; k++) {
      const o = rnd() < 0.75 ? orderIdOf(await storeOrder({})) : orderIdOf(await manualOrder(pick(["counter", "phone", "whatsapp"])));
      const pending = (await pool.query("SELECT status FROM orders WHERE id=$1", [o])).rows[0].status === "pending_confirmation";
      if (pending && rnd() < 0.06) await decideOrder(businessId, o, (await row(o)).version, "rejected", USER);
      else { if (pending) await accept(o); await finish(o); }
      const at = new Date(Date.now() - d * 864e5 - (rnd() < 0.3 ? 8 + rnd() * 2 : 0.2 + rnd() * 3) * 36e5);
      history.push({ id: o, at });
    }
  }
  for (const h of history) {
    await pool.query("UPDATE orders SET created_at=$2, accepted_at=$2::timestamptz + interval '2 min', estimated_ready_at=$2::timestamptz + interval '27 min', stage_changed_at=$2::timestamptz + interval '40 min', rating=CASE WHEN random()<0.4 THEN (4 + (random()>0.3)::int) END WHERE id=$1", [h.id, h.at]);
    await pool.query("UPDATE management_sales SET created_at=$2, operational_date=to_char(($2::timestamptz AT TIME ZONE 'America/Argentina/Cordoba') - interval '5 hours','YYYY-MM-DD') WHERE order_id=$1", [h.id, h.at]);
  }
  console.log("historial", history.length);

  // Turno de ayer: cobra lo entregado en las últimas 30 h y cierra con el arqueo.
  const cash = (c: unknown) => runCashCommand(businessId, USER, cashCommand.parse(c));
  const recent = (await pool.query<{ id: string; total_cents: number; payment_method: string; created_at: Date }>("SELECT id,total_cents,payment_method,created_at FROM orders WHERE business_id=$1 AND status='accepted' AND accepted_at > now() - interval '30 hours' ORDER BY created_at", [businessId])).rows;
  await cash({ type: "open", requestKey: id(), openingCents: $(30000) });
  let cashIn = $(30000);
  for (const o of recent) {
    await cash({ type: "payment", requestKey: id(), orderId: o.id, method: o.payment_method, amountCents: o.total_cents, tenderedCents: null });
    if (o.payment_method === "cash") cashIn += o.total_cents;
    await pool.query("UPDATE cash_movements SET created_at=$2::timestamptz + interval '35 min' WHERE order_id=$1", [o.id, o.created_at]);
  }
  const prev = (await pool.query<{ id: string }>("SELECT id FROM cash_sessions WHERE business_id=$1 AND closed_at IS NULL", [businessId])).rows[0].id;
  await cash({ type: "close", requestKey: id(), sessionId: prev, declaredCents: cashIn - $(500), note: "Faltaron $500, seguro un vuelto." });
  if (recent.length) await pool.query("UPDATE cash_sessions SET opened_at=$2::timestamptz - interval '40 min', closed_at=$3::timestamptz + interval '90 min' WHERE id=$1", [prev, recent[0].created_at, recent[recent.length - 1].created_at]);

  // Hoy: caja abierta y pedidos en todos los estados.
  await cash({ type: "open", requestKey: id(), openingCents: $(30000) });
  const ago = async (oid: string, createdMin: number, acceptedMin?: number, promise?: number) => {
    await pool.query(`UPDATE orders SET created_at=now() - make_interval(mins => $2), accepted_at=CASE WHEN $3::int IS NULL THEN accepted_at ELSE now() - make_interval(mins => $3::int) END, estimated_ready_at=CASE WHEN $3::int IS NULL THEN estimated_ready_at ELSE now() - make_interval(mins => $3::int) + make_interval(mins => $4::int) END, stage_changed_at=CASE WHEN $3::int IS NULL THEN stage_changed_at ELSE now() - make_interval(mins => $3::int) END WHERE id=$1`, [oid, createdMin, acceptedMin ?? null, promise ?? 25]);
  };
  const payFor = async (oid: string, method?: "cash" | "transfer" | "qr" | "card") => {
    const r = await row(oid);
    const m = method ?? (r.payment_method as "cash" | "transfer");
    await cash({ type: "payment", requestKey: id(), orderId: oid, method: m, amountCents: r.total_cents, tenderedCents: m === "cash" ? Math.ceil(r.total_cents / 1000000) * 1000000 : null });
  };
  // Entregados más temprano, cobrados.
  for (let k = 0; k < 9; k++) {
    const o = k % 3 === 0 ? orderIdOf(await manualOrder("counter")) : orderIdOf(await storeOrder({}));
    if ((await pool.query("SELECT status FROM orders WHERE id=$1", [o])).rows[0].status === "pending_confirmation") await accept(o);
    await finish(o);
    await ago(o, 150 - k * 12, 148 - k * 12);
    await payFor(o, k === 4 ? "qr" : k === 6 ? "card" : undefined);
  }
  await cash({ type: "movement", requestKey: id(), kind: "withdrawal", amountCents: $(8000), note: "Pago al repartidor del mediodía" });
  await pool.query("UPDATE cash_sessions SET opened_at=now() - interval '170 min' WHERE business_id=$1 AND closed_at IS NULL", [businessId]);
  await pool.query("UPDATE cash_movements m SET created_at=o.created_at + interval '38 min' FROM orders o WHERE m.order_id=o.id AND m.created_at > now() - interval '5 min'");
  await pool.query("UPDATE cash_movements SET created_at=now() - interval '60 min' WHERE kind='withdrawal' AND created_at > now() - interval '5 min'");
  // Uno rechazado.
  const rej = orderIdOf(await storeOrder({ delivery: true }));
  await decideOrder(businessId, rej, (await row(rej)).version, "rejected", USER);
  await ago(rej, 95);
  // En camino y listos.
  const otw = orderIdOf(await storeOrder({ delivery: true, pay: "cash" })); await accept(otw, 30); await advance(otw, "ready"); await advance(otw, "on_the_way"); await ago(otw, 42, 40, 30);
  const rd1 = orderIdOf(await storeOrder({ delivery: false, pay: "transfer" })); await accept(rd1, 20); await advance(rd1, "ready"); await ago(rd1, 30, 28, 20);
  const rd2 = orderIdOf(await manualOrder("counter")); await advance(rd2, "ready"); await ago(rd2, 22, 22, 20); await payFor(rd2, "cash");
  // En preparación: verde, amarillo y rojo en el semáforo.
  const p1 = orderIdOf(await storeOrder({ delivery: true })); await accept(p1, 25); await ago(p1, 21, 20, 25); // amarillo
  const p2 = orderIdOf(await storeOrder({ delivery: false })); await accept(p2, 25); await ago(p2, 6, 4, 25); // verde
  const p3 = orderIdOf(await manualOrder("phone")); await ago(p3, 38, 37, 25); // rojo
  const p4 = orderIdOf(await manualOrder("whatsapp")); await ago(p4, 15, 14, 25); // verde
  // Nuevos sin aceptar.
  const n1 = orderIdOf(await storeOrder({ delivery: true })); await ago(n1, 3);
  const n2 = orderIdOf(await storeOrder({ delivery: false })); await ago(n2, 1);
  console.log("hoy listo");

  await mg({ requestKey: id(), type: "expense", date: new Date(Date.now() - 864e5 * 12).toISOString().slice(0, 10), category: "Alquiler", amountCents: String($(650000)), concept: "Alquiler del local", supplierId: null });
  await mg({ requestKey: id(), type: "expense", date: new Date(Date.now() - 864e5 * 10).toISOString().slice(0, 10), category: "Sueldos", amountCents: String($(480000)), concept: "Quincena cocina y mostrador", supplierId: null });
  await mg({ requestKey: id(), type: "expense", date: new Date(Date.now() - 864e5 * 6).toISOString().slice(0, 10), category: "Servicios", amountCents: String($(96000)), concept: "Luz y gas", supplierId: null });
  await mg({ requestKey: id(), type: "expense", date: new Date(Date.now() - 864e5 * 3).toISOString().slice(0, 10), category: "Envíos", amountCents: String($(120000)), concept: "Repartidores de la semana", supplierId: null });
  console.log("listo", businessId);
  await pool.end();
}
main().catch(async (e) => { console.error(e); await pool.end(); process.exit(1); });
