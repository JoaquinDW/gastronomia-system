// Graba el recorrido de demo de Brasa Club (archivo local, no se commitea).
// node scripts/demo-record.mjs <businessId> <carpeta-salida> [debug]
import { chromium } from "@playwright/test";
import { mkdirSync, writeFileSync } from "node:fs";

const [BIZ, OUT, MODE] = process.argv.slice(2);
const DEBUG = MODE === "debug";
const BASE = "http://localhost:3000";
const PANEL = `${BASE}/panel/negocios/${BIZ}`;
mkdirSync(`${OUT}/frames`, { recursive: true });

const browser = await chromium.launch({ executablePath: "/opt/pw-browsers/chromium", args: ["--lang=es-AR"], env: { ...process.env, LANG: "es_AR.UTF-8", LANGUAGE: "es_AR" } });
const ctx = await browser.newContext({ viewport: { width: 1440, height: 810 }, deviceScaleFactor: 4 / 3, locale: "es-AR", timezoneId: "America/Argentina/Cordoba" });
await ctx.addCookies([{ name: "__Secure-neon-auth.session_token", value: "demo", domain: "localhost", path: "/", secure: true, httpOnly: true, sameSite: "Lax" }]);

// Cursor visible, leyendas y placas de título dibujados dentro de la página.
await ctx.addInitScript(() => {
  const css = `
  #__cur{position:fixed;left:0;top:0;width:26px;height:26px;z-index:2147483647;pointer-events:none;transform:translate(-100px,-100px);transition:transform .02s linear}
  #__cur svg{filter:drop-shadow(1px 2px 2px rgba(0,0,0,.35))}
  .__ring{position:fixed;width:44px;height:44px;margin:-22px 0 0 -22px;border-radius:50%;border:3px solid #ffc72c;z-index:2147483646;pointer-events:none;animation:__r .55s ease-out forwards}
  @keyframes __r{from{transform:scale(.3);opacity:1}to{transform:scale(1.4);opacity:0}}
  #__cap{position:fixed;left:50%;bottom:28px;transform:translateX(-50%) translateY(20px);z-index:2147483645;pointer-events:none;opacity:0;transition:opacity .45s,transform .45s;
    background:#121212;color:#fff;border-radius:16px;padding:14px 22px 15px;box-shadow:4px 4px 0 #ffc72c;max-width:900px;display:flex;gap:16px;align-items:center;font-family:var(--sans,"Archivo"),sans-serif}
  #__cap.on{opacity:1;transform:translateX(-50%) translateY(0)}
  #__cap b{font:700 12px/1 var(--mono,"Space Mono"),monospace;letter-spacing:.12em;text-transform:uppercase;color:#121212;background:#ffc72c;padding:6px 8px;border-radius:6px;white-space:nowrap}
  #__cap span{font-size:18px;line-height:1.3}
  #__card{position:fixed;inset:0;z-index:2147483644;background:#121212;color:#f2f1ec;display:flex;flex-direction:column;justify-content:center;padding:0 120px;opacity:0;transition:opacity .6s;pointer-events:none}
  #__card.on{opacity:1}
  #__card .k{font:700 15px/1 var(--mono,"Space Mono"),monospace;letter-spacing:.16em;text-transform:uppercase;color:#ffc72c;margin-bottom:22px}
  #__card .t{font:800 84px/1 var(--display,"Arial Black"),sans-serif;letter-spacing:-.02em;margin:0 0 22px}
  #__card .s{font:500 24px/1.4 var(--sans,"Archivo"),sans-serif;color:#cfcdc4;max-width:900px}
  #__card .logo{display:flex;align-items:center;gap:14px;margin-bottom:56px;font:800 34px/1 var(--display),sans-serif}
  #__card .logo i{width:52px;height:52px;border-radius:13px;background:#ffc72c;color:#121212;display:grid;place-items:center;font-style:normal;box-shadow:3px 3px 0 #f2f1ec}`;
  const mount = () => {
    if (document.getElementById("__cur")) return;
    const st = document.createElement("style"); st.textContent = css; document.head.appendChild(st);
    const c = document.createElement("div"); c.id = "__cur";
    c.innerHTML = '<svg width="26" height="26" viewBox="0 0 24 24"><path d="M3 2l7.5 19 2.6-7.9L21 10.5z" fill="#121212" stroke="#fff" stroke-width="1.6" stroke-linejoin="round"/></svg>';
    document.body.appendChild(c);
    const cap = document.createElement("div"); cap.id = "__cap"; cap.innerHTML = "<b></b><span></span>"; document.body.appendChild(cap);
    const card = document.createElement("div"); card.id = "__card"; document.body.appendChild(card);
    const pos = sessionStorage.getItem("__pos"); if (pos) { const [x, y] = JSON.parse(pos); c.style.transform = `translate(${x}px,${y}px)`; }
    const saved = sessionStorage.getItem("__capv"); if (saved) { const [k, t] = JSON.parse(saved); window.__cap(k, t, true); }
  };
  window.__cap = (k, t, instant) => {
    const cap = document.getElementById("__cap"); if (!cap) return;
    if (!t) { cap.classList.remove("on"); sessionStorage.removeItem("__capv"); return; }
    sessionStorage.setItem("__capv", JSON.stringify([k, t]));
    cap.querySelector("b").textContent = k; cap.querySelector("b").style.display = k ? "" : "none";
    cap.querySelector("span").textContent = t;
    if (instant) { cap.style.transition = "none"; cap.classList.add("on"); requestAnimationFrame(() => (cap.style.transition = "")); }
    else { cap.classList.remove("on"); void cap.offsetWidth; cap.classList.add("on"); }
  };
  window.__card = (html) => { const el = document.getElementById("__card"); if (html) { el.innerHTML = html; el.classList.add("on"); } else el.classList.remove("on"); };
  addEventListener("mousemove", (e) => { const c = document.getElementById("__cur"); if (c) c.style.transform = `translate(${e.clientX - 3}px,${e.clientY - 2}px)`; sessionStorage.setItem("__pos", JSON.stringify([e.clientX - 3, e.clientY - 2])); }, true);
  addEventListener("mousedown", (e) => { const r = document.createElement("div"); r.className = "__ring"; r.style.left = e.clientX + "px"; r.style.top = e.clientY + "px"; document.body.appendChild(r); setTimeout(() => r.remove(), 600); }, true);
  if (document.readyState === "loading") addEventListener("DOMContentLoaded", mount); else mount();
});

const page = await ctx.newPage();
// El checkout abre WhatsApp: en la demo lo dejamos sin salir de la tienda.
await page.route(/wa\.me|api\.whatsapp\.com/, (r) => r.fulfill({ status: 204, body: "" }));
page.on("popup", (p) => p.close().catch(() => {}));

// Captura con screencast de CDP: cada cuadro guarda su tiempo para respetar el ritmo real.
const frames = [];
let cdp, recording = false;
async function startRec() {
  if (DEBUG) return;
  cdp = await ctx.newCDPSession(page);
  cdp.on("Page.screencastFrame", async ({ data, metadata, sessionId }) => {
    const n = frames.length;
    frames.push({ t: metadata.timestamp, file: `f${String(n).padStart(6, "0")}.jpg` });
    writeFileSync(`${OUT}/frames/${frames[n].file}`, Buffer.from(data, "base64"));
    cdp.send("Page.screencastFrameAck", { sessionId }).catch(() => {});
  });
  await cdp.send("Page.startScreencast", { format: "jpeg", quality: 92, maxWidth: 1920, maxHeight: 1080, everyNthFrame: 1 });
  recording = true;
}
// Fuerza cuadros durante las pausas para que el screencast no se quede sin datos.
let ticker;
function tick() { ticker = setInterval(() => page.evaluate(() => { const c = document.getElementById("__cur"); if (c) c.style.opacity = c.style.opacity === "0.999" ? "1" : "0.999"; }).catch(() => {}), 250); }

const wait = (ms) => page.waitForTimeout(DEBUG ? Math.min(ms, 300) : ms);
let shot = 0;
const snap = async (name) => { if (DEBUG) await page.screenshot({ path: `${OUT}/${String(++shot).padStart(2, "0")}-${name}.png` }); };
let mouse = { x: 720, y: 400 };
async function moveTo(x, y, ms = 700) {
  const steps = Math.max(8, Math.round(ms / 16));
  const sx = mouse.x, sy = mouse.y;
  for (let i = 1; i <= steps; i++) {
    const t = i / steps, e = t < 0.5 ? 2 * t * t : 1 - (-2 * t + 2) ** 2 / 2;
    await page.mouse.move(sx + (x - sx) * e, sy + (y - sy) * e);
    if (!DEBUG) await page.waitForTimeout(ms / steps);
  }
  mouse = { x, y };
}
async function hover(loc, ms = 700) {
  await loc.scrollIntoViewIfNeeded();
  const b = await loc.boundingBox();
  await moveTo(b.x + b.width / 2, b.y + b.height / 2, ms);
}
async function click(loc, { ms = 700, pause = 350 } = {}) {
  await hover(loc, ms);
  await wait(pause);
  await page.mouse.down(); await page.mouse.up();
  await wait(250);
}
async function type(loc, text, delay = 55) {
  await click(loc);
  await loc.pressSequentially(text, { delay: DEBUG ? 0 : delay });
}
async function scrollBy(dy, ms = 1400) {
  const steps = Math.round(ms / 16);
  for (let i = 0; i < steps; i++) { await page.mouse.wheel(0, dy / steps); if (!DEBUG) await page.waitForTimeout(16); }
  await wait(200);
}
async function smoothScrollTo(loc, offset = 120, ms = 1400) {
  const y = await loc.evaluate((el) => el.getBoundingClientRect().top);
  await scrollBy(y - offset, ms);
}
const cap = (k, t) => page.evaluate(([k, t]) => window.__cap(k, t), [k, t]);
const card = (html) => page.evaluate((h) => window.__card(h), html);
async function go(url) {
  await page.goto(url, { waitUntil: "networkidle" });
  await page.mouse.move(mouse.x, mouse.y);
}

// ---------------------------------------------------------------- guion
await go(`${BASE}/t/brasa-club`);
await page.evaluate(() => window.scrollTo(0, 0));
await card(`<div class="logo"><i>p</i>pedipue.</div><div class="k">Recorrido por dentro</div><h1 class="t">Brasa Club,<br>de punta a punta.</h1><p class="s">Así se ve Pedipue con un local funcionando: la tienda que usa tu cliente y el panel donde manejás pedidos, cocina, caja y números.</p>`);
await startRec(); tick();
await wait(4500); await snap("intro");
await card(null); await wait(900);

// 1. Tienda pública
await cap("Tu tienda", "Tu cliente entra a tu link: portada, horario y la carta con fotos y precios.");
await wait(3200); await snap("store-top");
await scrollBy(560, 2200); await wait(1600);
await cap("Tu tienda", "Elige presentación, adicionales y opciones. Si algo es obligatorio, no puede saltearlo.");
const cheddar = page.locator("article", { has: page.getByRole("button", { name: "Agregar Cheddar & bacon" }) });
await smoothScrollTo(cheddar, 110, 1200);
await click(cheddar.locator("select"));
await page.keyboard.press("Escape");
await cheddar.locator("select").selectOption({ index: 1 }); await wait(700);
await click(cheddar.getByText("Personalizar con adicionales"));
await click(cheddar.getByRole("checkbox").first(), { ms: 500 }); await wait(500);
await click(cheddar.getByText("Elegí tus opciones"));
await click(cheddar.getByText("Jugosa"), { ms: 500 }); await wait(600); await snap("cheddar-options");
await click(cheddar.getByRole("button", { name: "Agregar Cheddar & bacon" })); await wait(1200);
const combo = page.locator("article", { has: page.getByRole("button", { name: "Agregar Combo Clásica" }) });
await smoothScrollTo(combo, 110, 2200); await wait(600);
await click(combo.getByRole("button", { name: "Agregar Combo Clásica" })); await wait(800);
await click(combo.getByText("Coca-Cola", { exact: true }), { ms: 500 }); await wait(500);
await click(combo.getByRole("button", { name: "Agregar Combo Clásica" })); await wait(1300); await snap("combo");
await cap("Checkout", "Pone sus datos, retiro o delivery por zona, y cómo paga. El total aparece al final, sin sorpresas.");
await click(page.getByRole("button", { name: /Continuar con mi pedido/ })); await wait(1200);
const form = page.locator("form.checkout-form");
await smoothScrollTo(form, 60, 1000);
await type(form.locator('input[name="customerName"]'), "Camila Rivero");
await type(form.locator('input[name="customerPhone"]'), "379 461 2280");
await click(form.locator("select").first()); await page.keyboard.press("Escape");
await form.locator("select").first().selectOption("delivery"); await wait(900);
await type(form.locator('input[name="address"]'), "San Lorenzo 1180, 2° B");
await click(form.locator('select[name="paymentMethod"]')); await page.keyboard.press("Escape");
await form.locator('select[name="paymentMethod"]').selectOption("transfer"); await wait(700);
await type(form.locator('textarea[name="note"]'), "Sin pepinos, por favor 🙌", 45);
await smoothScrollTo(form.getByRole("button", { name: "Confirmar pedido" }), 520, 900);
await wait(1500); await snap("checkout");
await click(form.getByRole("button", { name: "Confirmar pedido" }));
await page.waitForURL(/\/pedido\//, { timeout: 15000 });
const trackingUrl = page.url().split("?")[0];
await page.waitForLoadState("networkidle"); await page.mouse.move(mouse.x, mouse.y);
await cap("Seguimiento", "El pedido queda guardado y le llega el resumen por WhatsApp. Desde este link lo sigue en vivo.");
await wait(3500); await snap("tracking-confirm");
const closeDlg = page.locator("dialog[open]").getByText("Ver mi pedido primero");
if (await closeDlg.isVisible().catch(() => false)) { await click(closeDlg); await wait(1200); }
await scrollBy(350, 1500); await wait(1500); await snap("tracking");

// 2. Pedidos en vivo
await card(`<div class="k">Del lado del local</div><h1 class="t">El panel.</h1><p class="s">Todo lo que entra por la tienda, el mostrador, el teléfono o WhatsApp, en un solo lugar.</p>`);
await wait(600);
await go(`${PANEL}/pedidos`);
await page.evaluate(() => window.__card(`<div class="k">Del lado del local</div><h1 class="t">El panel.</h1><p class="s">Todo lo que entra por la tienda, el mostrador, el teléfono o WhatsApp, en un solo lugar.</p>`));
await wait(3000); await card(null); await wait(700);
await cap("Pedidos en vivo", "El pedido de Camila entró solo, con aviso sonoro y todo el detalle. Elegís el tiempo y lo aceptás.");
const camila = page.locator("article", { hasText: "Camila Rivero" });
await scrollBy(330, 1200);
await hover(camila.locator("h2, h3, strong").first(), 1000); await wait(2200); await snap("inbox-new");
await click(camila.locator("select"));
await page.keyboard.press("Escape");
await camila.locator("select").selectOption("30"); await wait(800);
await click(camila.getByRole("button", { name: "Aceptar pedido" })); await wait(2200); await snap("accepted");
await cap("Pedidos en vivo", "Cada pedido avanza por sus estados. El semáforo marca a tiempo, por vencer o atrasado.");
await scrollBy(420, 1800); await wait(2500);
const late = page.locator("article", { hasText: /min tarde/ }).first();
await hover(late, 900); await wait(1800); await snap("late");
await scrollBy(-750, 1600); await wait(800);

// 3. Modo cocina
await cap("Modo cocina", "Para la tablet de la cocina: letras grandes, lo atrasado primero y un toque para marcar listo.");
await click(page.getByRole("button", { name: "Modo cocina" })); await wait(4500); await snap("kitchen");
const firstReady = page.locator(".kitchen-mode").getByRole("button", { name: /^Listo #/ }).first();
await click(firstReady); await wait(2500);
await click(page.locator(".kitchen-mode").getByRole("button", { name: "Salir" })); await wait(1200);

// 4. Pedido de mostrador
await cap("Mostrador", "Lo que entra por mostrador, teléfono o WhatsApp se carga en segundos y sigue el mismo camino.");
await click(page.getByRole("button", { name: "Nuevo pedido" })); await wait(1400);
const manual = page.locator("section, div").filter({ has: page.getByRole("heading", { name: "Nuevo pedido" }) }).last();
await smoothScrollTo(page.getByRole("heading", { name: "Nuevo pedido" }), 90, 1000); await wait(1200); await snap("manual");
await scrollBy(320, 1400); await wait(1800);
await click(page.getByText("Cerrar", { exact: true }).first()); await wait(800);

// 5. Caja
await go(`${PANEL}/caja`);
await cap("Caja", "Abrís el turno con el cambio y cobrás cada pedido: efectivo, transferencia, QR o tarjeta.");
await wait(3000); await snap("caja");
const toCharge = page.locator("li", { has: page.getByRole("button", { name: "Cobrar" }) }).filter({ hasText: "efectivo" }).first();
await click(toCharge.getByRole("button", { name: "Cobrar" })); await wait(1300);
const dlg = page.locator("dialog[open]");
await cap("Caja", "Si paga en efectivo, tocás el billete y te dice el vuelto.");
await click(dlg.locator(".charge-bills button").nth(1)); await wait(1800); await snap("vuelto");
await click(dlg.getByRole("button", { name: /^Cobrar \$/ })); await wait(2200);
await cap("Caja", "Al cerrar contás el efectivo sin ver cuánto debería haber. La diferencia aparece recién después.");
await scrollBy(700, 2400); await wait(3000); await snap("turnos");

// 6. Carta
await go(`${PANEL}/carta`);
await cap("Carta", "Tu carta con fotos, presentaciones, adicionales y opciones. También la podés importar desde una foto del menú.");
await wait(2500); await scrollBy(500, 2600); await wait(1200);
const edit = page.getByRole("button", { name: "Editar Cheddar & bacon" });
await smoothScrollTo(edit, 300, 1000);
await click(edit); await wait(2000); await snap("editor");
await hover(page.locator("dialog[open] h2, dialog[open] h1").first(), 600);
await moveTo(mouse.x + 200, mouse.y + 250, 500);
await scrollBy(700, 2400); await wait(2200);
await scrollBy(800, 2400); await wait(2200); await snap("editor2");
await scrollBy(800, 2000); await wait(1800);

// 7. Tienda
await go(`${PANEL}/tienda`);
await cap("Tienda", "Portada, descripción, horarios por turno, retiro y delivery por zonas, y medios de pago.");
await wait(3000); await snap("tienda");
await scrollBy(900, 3000); await wait(1500);
await scrollBy(1300, 3200); await wait(2000); await snap("tienda2");
await scrollBy(700, 2000); await wait(1800);

// 8. Números
await go(`${PANEL}/gestion`);
await cap("Resultados", "Cada pedido aceptado registra la venta y descuenta insumos. Ves cuánto vendiste, cuánto costó y qué te quedó.");
await wait(4000); await snap("resultados");
await scrollBy(560, 2400); await wait(3500);
await go(`${PANEL}/gestion/recetas`);
await cap("Recetas", "Cada producto con su receta: así el costo y el stock se calculan solos.");
await wait(3200); await snap("recetas");
await go(`${PANEL}/gestion/inventario`);
await cap("Inventario", "Stock al día y aviso cuando algo baja del mínimo.");
await wait(3200); await scrollBy(400, 1800); await wait(1500); await snap("inv");

// 9. Vuelta al cliente
await go(trackingUrl);
await cap("Seguimiento", "Mientras tanto, Camila ve que su pedido ya está en preparación.");
await wait(4000); await snap("tracking-prep");
await cap("", "");
await card(`<div class="logo"><i>p</i>pedipue.</div><h1 class="t">Tu tienda online.<br>Los pedidos, directo.</h1><p class="s">pedipue.com</p>`);
await wait(4500); await snap("outro");

writeFileSync(`${OUT}/frames.json`, JSON.stringify(frames));
if (DEBUG) { console.log("debug listo"); await browser.close(); process.exit(0); }
clearInterval(ticker);
await cdp.send("Page.stopScreencast");
frames.push({ t: frames.at(-1).t + 0.5, file: frames.at(-1).file });
writeFileSync(`${OUT}/frames.json`, JSON.stringify(frames));
await browser.close();
console.log("frames", frames.length);
