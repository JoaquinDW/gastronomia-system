// La demo pública del panel (/demo) corre en el navegador: las pantallas son
// las de siempre y sus pedidos a /api/businesses/demo/... los contesta este
// módulo con datos en memoria. Nada se guarda en la base y al recargar la
// página vuelve a empezar. Gestión es de solo lectura y la sirve el servidor.

import {
  cashTotals,
  cashCommand,
  type CashMovement,
  type CashSession,
  type CashState,
  type UnpaidOrder,
} from "@/lib/cash";
import {
  defaultCustomerName,
  manualOrderInput,
  nextStage,
  orderStages,
  type Order,
  type OrderItem,
} from "@/lib/checkout";
import {
  formatMoney,
  productInput,
  resolveChoices,
  settingsInput,
  type Product,
  type StoreSettings,
} from "@/lib/menu";
import type { KitchenConfig } from "@/lib/kitchen";
import type { ProductCategory, TicketConfig } from "@/lib/ticket";
import { kitchenConfigInput } from "@/lib/kitchen";
import { ticketConfigInput } from "@/lib/ticket";
import { z } from "zod";

export const DEMO_ID = "demo";
export const DEMO_API = `/api/businesses/${DEMO_ID}`;

export type DemoBusiness = {
  name: string;
  slug: string;
  kind: string;
  whatsapp: string;
  city: string;
  address: string | null;
};

export type DemoMovement = CashMovement & { sessionId: string };

/** Lo que el navegador necesita para atender las pantallas de operación. */
export type DemoState = {
  business: DemoBusiness;
  timezone: string;
  settings: StoreSettings;
  products: Product[];
  categories: ProductCategory[];
  ticket: TicketConfig;
  kitchen: KitchenConfig;
  orders: Order[];
  cashSessions: CashSession[];
  cashMovements: DemoMovement[];
};

export const demoNotice =
  "Esto es una demo: acá no se suben archivos. Creá tu cuenta gratis para cargar los tuyos.";

type Reply = { status: number; body: unknown };
const ok = (body: unknown, status = 200): Reply => ({ status, body });
const fail = (status: number, error: string): Reply => ({
  status,
  body: { error },
});
class DemoError extends Error {
  constructor(
    public readonly status: number,
    message: string,
  ) {
    super(message);
  }
}

const names = [
  "Martina Gómez",
  "Lucas Fernández",
  "Sofía Benítez",
  "Tomás Romero",
  "Camila Sosa",
  "Nicolás Duarte",
  "Julieta Vallejos",
  "Franco Escobar",
];
const streets = [
  "Av. 3 de Abril 1240",
  "Junín 856",
  "San Juan 1532",
  "Mendoza 760",
  "Belgrano 1988",
  "Pellegrini 1450",
];
const notes = [
  "",
  "",
  "Sin cebolla, por favor",
  "Tocar timbre 2",
  "Mayo aparte",
  "",
];
const pick = <T>(list: T[]) => list[Math.floor(Math.random() * list.length)];
const token = () => crypto.randomUUID().replaceAll("-", "");

/** Pedidos nuevos de la tienda que entran solos mientras se recorre la demo. */
const ARRIVAL_EVERY_MS = 75_000;
const MAX_ARRIVALS = 6;

export function createSandbox(initial: DemoState) {
  const state: DemoState = structuredClone(initial);
  let arrivals = 0,
    lastArrival = Date.now();

  const now = () => new Date().toISOString();
  const paid = (orderId: string) =>
    state.cashMovements
      .filter(
        (m) => m.orderId === orderId && m.kind === "payment" && !m.voidedAt,
      )
      .reduce((n, m) => n + m.amountCents, 0);
  const openSession = () => state.cashSessions.find((s) => !s.closedAt) ?? null;
  const findOrder = (id: string) => {
    const order = state.orders.find((o) => o.id === id);
    if (!order) throw new DemoError(404, "No encontramos el pedido.");
    return order;
  };
  const withPaid = (o: Order): Order => ({ ...o, paidCents: paid(o.id) });

  function listOrders() {
    return [...state.orders]
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
      .slice(0, 100)
      .map(withPaid);
  }

  function priceItems(
    lines: z.infer<typeof manualOrderInput>["items"],
  ): OrderItem[] {
    return lines.map((line) => {
      const product = state.products.find((p) => p.id === line.productId);
      const variant = product?.variants.find((v) => v.id === line.variantId);
      if (!product?.isAvailable || !variant)
        throw new DemoError(
          409,
          "Un producto ya no está disponible. Actualizá la carta.",
        );
      const addOns = line.addOnIds.map((id) =>
        product.addOns.find((a) => a.id === id),
      );
      if (addOns.some((a) => !a))
        throw new DemoError(409, "Un adicional cambió. Actualizá la carta.");
      const choices = resolveChoices(product, line.choiceIds);
      if (!choices.ok)
        throw new DemoError(choices.stale ? 409 : 422, choices.message);
      const unitCents =
        variant.priceCents +
        addOns.reduce((n, a) => n + a!.priceCents, 0) +
        choices.value.cents;
      if (unitCents !== line.quotedUnitCents)
        throw new DemoError(
          409,
          "Cambió un precio. Actualizá la carta y revisá el total antes de confirmar.",
        );
      return {
        productId: product.id,
        variantId: variant.id,
        addOnIds: line.addOnIds,
        choiceIds: line.choiceIds,
        name: product.name,
        imageUrl: product.imageUrl || null,
        variant: variant.name,
        addOns: addOns.map((a) => a!.name),
        choices: choices.value.labels,
        quantity: line.quantity,
        unitCents,
        lineCents: unitCents * line.quantity,
      };
    });
  }

  function nextNumber() {
    return state.orders.reduce((n, o) => Math.max(n, o.number), 0) + 1;
  }

  /** Un pedido de la tienda con uno a tres productos y las opciones mínimas. */
  function arrive() {
    const available = state.products.filter(
      (p) => p.isAvailable && p.variants.length,
    );
    if (!available.length) return;
    const items: OrderItem[] = [];
    for (let i = 0; i < 1 + Math.floor(Math.random() * 3); i++) {
      const product = pick(available);
      const variant = pick(product.variants);
      const choiceIds = (product.optionGroups ?? []).flatMap((g) =>
        [...g.options]
          .sort(() => Math.random() - 0.5)
          .slice(0, g.min)
          .map((o) => o.id),
      );
      const choices = resolveChoices(product, choiceIds);
      if (!choices.ok) continue;
      const quantity = 1 + Math.floor(Math.random() * 2);
      const unitCents = variant.priceCents + choices.value.cents;
      items.push({
        productId: product.id,
        variantId: variant.id,
        addOnIds: [],
        choiceIds,
        name: product.name,
        imageUrl: product.imageUrl || null,
        variant: variant.name,
        addOns: [],
        choices: choices.value.labels,
        quantity,
        unitCents,
        lineCents: unitCents * quantity,
      });
    }
    if (!items.length) return;
    const zones = state.settings.deliveryEnabled
      ? state.settings.deliveryZones
      : [];
    const zone = zones.length && Math.random() < 0.6 ? pick(zones) : null;
    const subtotal = items.reduce((n, i) => n + i.lineCents, 0);
    const fee = zone?.feeCents ?? 0;
    state.orders.push({
      id: crypto.randomUUID(),
      number: nextNumber(),
      status: "pending_confirmation",
      customerName: pick(names),
      customerPhone: `+54937946${10000 + Math.floor(Math.random() * 90000)}`,
      fulfillment: zone ? "delivery" : "pickup",
      address: zone ? pick(streets) : null,
      zoneName: zone?.name ?? null,
      deliveryLocation: null,
      paymentMethod: Math.random() < 0.55 ? "transfer" : "cash",
      note: pick(notes),
      items,
      subtotalCents: subtotal,
      deliveryCents: fee,
      totalCents: subtotal + fee,
      version: 1,
      createdAt: now(),
      acceptedAt: null,
      stage: null,
      stageChangedAt: null,
      trackingToken: token(),
      estimatedReadyAt: null,
      rating: null,
      channel: "store",
      saleId: null,
    });
  }

  function maybeArrive() {
    const pending = state.orders.filter(
      (o) => o.status === "pending_confirmation",
    ).length;
    if (arrivals >= MAX_ARRIVALS || pending >= 3) return;
    if (Date.now() - lastArrival < ARRIVAL_EVERY_MS) return;
    arrivals++;
    lastArrival = Date.now();
    arrive();
  }

  function cashState(): CashState {
    const session = openSession();
    const dayAgo = Date.now() - 24 * 3600_000;
    const unpaid: UnpaidOrder[] = state.orders
      .filter(
        (o) =>
          o.status === "accepted" &&
          Date.parse(o.acceptedAt ?? o.createdAt) >= dayAgo &&
          o.totalCents > paid(o.id),
      )
      .sort((a, b) => (a.acceptedAt ?? "").localeCompare(b.acceptedAt ?? ""))
      .map((o) => ({
        id: o.id,
        number: o.number,
        customerName: o.customerName,
        paymentMethod: o.paymentMethod,
        totalCents: o.totalCents,
        paidCents: paid(o.id),
        createdAt: o.createdAt,
      }));
    const movementsOf = (id: string) =>
      state.cashMovements
        .filter((m) => m.sessionId === id)
        .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
        .map(({ sessionId: _, ...m }) => m);
    return {
      session: session
        ? { ...session, movements: movementsOf(session.id) }
        : null,
      unpaid,
      history: state.cashSessions
        .filter((s) => s.closedAt)
        .sort((a, b) => b.closedAt!.localeCompare(a.closedAt!))
        .map((s) => ({
          ...(s as Required<CashSession> & {
            closedAt: string;
            declaredCents: number;
            expectedCents: number;
          }),
          totals: cashTotals(s.openingCents, movementsOf(s.id)),
        })),
    };
  }

  function runCash(body: unknown) {
    const command = cashCommand.parse(body);
    if (command.type === "open") {
      if (openSession())
        throw new DemoError(
          409,
          "Ya hay un turno abierto. Actualizá la pantalla.",
        );
      const session: CashSession = {
        id: crypto.randomUUID(),
        number:
          state.cashSessions.reduce((n, s) => Math.max(n, s.number), 0) + 1,
        openedAt: now(),
        openingCents: command.openingCents,
        closedAt: null,
        declaredCents: null,
        expectedCents: null,
        note: "",
      };
      state.cashSessions.push(session);
      return { session };
    }
    if (command.type === "close") {
      const session = state.cashSessions.find(
        (s) => s.id === command.sessionId,
      );
      if (!session) throw new DemoError(404, "No encontramos el turno.");
      if (session.closedAt)
        throw new DemoError(409, "Este turno ya se cerró en otra pantalla.");
      const movements = state.cashMovements.filter(
        (m) => m.sessionId === session.id,
      );
      const totals = cashTotals(session.openingCents, movements);
      Object.assign(session, {
        closedAt: now(),
        declaredCents: command.declaredCents,
        expectedCents: totals.expectedCents,
        note: command.note,
      });
      const left = state.orders.filter(
        (o) =>
          o.status === "accepted" &&
          (o.acceptedAt ?? "") >= session.openedAt &&
          o.totalCents > paid(o.id),
      );
      return {
        closed: {
          ...session,
          totals,
          unpaid: {
            count: left.length,
            cents: left.reduce((n, o) => n + o.totalCents - paid(o.id), 0),
          },
        },
      };
    }
    if (command.type === "void") {
      const movement = state.cashMovements.find(
        (m) => m.id === command.movementId,
      );
      if (!movement) throw new DemoError(404, "No encontramos ese movimiento.");
      if (state.cashSessions.find((s) => s.id === movement.sessionId)?.closedAt)
        throw new DemoError(
          409,
          "Ese turno ya se cerró. Si devolviste plata, registrá un retiro en el turno actual.",
        );
      if (!movement.voidedAt)
        Object.assign(movement, {
          voidedAt: now(),
          voidReason: command.reason,
        });
      return { voided: movement.id };
    }
    const session = openSession();
    if (!session)
      throw new DemoError(
        409,
        "La caja está cerrada. Abrí un turno en Caja para cobrar.",
      );
    const base = {
      id: crypto.randomUUID(),
      sessionId: session.id,
      createdAt: now(),
      voidedAt: null,
      voidReason: null,
    };
    if (command.type === "movement") {
      state.cashMovements.push({
        ...base,
        kind: command.kind,
        method: "cash",
        amountCents: command.amountCents,
        tenderedCents: null,
        orderId: null,
        orderNumber: null,
        orderStatus: null,
        note: command.note,
      });
      return { movementId: base.id };
    }
    const order = findOrder(command.orderId);
    if (order.status === "pending_confirmation")
      throw new DemoError(409, "Aceptá el pedido antes de cobrarlo.");
    if (order.status !== "accepted")
      throw new DemoError(
        409,
        "Ese pedido está rechazado o anulado; no se puede cobrar.",
      );
    const left = order.totalCents - paid(order.id);
    if (left <= 0)
      throw new DemoError(409, `El pedido #${order.number} ya está cobrado.`);
    if (command.amountCents > left)
      throw new DemoError(
        409,
        `Al pedido #${order.number} le falta cobrar ${formatMoney(left)}; no se puede cobrar más que eso.`,
      );
    state.cashMovements.push({
      ...base,
      kind: "payment",
      method: command.method,
      amountCents: command.amountCents,
      tenderedCents: command.tenderedCents,
      orderId: order.id,
      orderNumber: order.number,
      orderStatus: order.status,
      note: "",
    });
    return { movementId: base.id, leftCents: left - command.amountCents };
  }

  function updateOrder(body: unknown) {
    const target = { orderId: z.uuid(), version: z.number().int().positive() };
    const input = z
      .union([
        z
          .object({
            ...target,
            status: z.enum(["accepted", "rejected"]),
            preparationMinutes: z.number().int().min(5).max(180).optional(),
          })
          .strict(),
        z.object({ ...target, stage: z.enum(orderStages) }).strict(),
      ])
      .parse(body);
    const order = findOrder(input.orderId);
    if (order.version !== input.version)
      throw new DemoError(
        409,
        "El pedido cambió en otra pantalla. Actualizá la lista.",
      );
    const at = now();
    if ("stage" in input) {
      if (
        order.status !== "accepted" ||
        nextStage(order.fulfillment, order.stage) !== input.stage
      )
        throw new DemoError(422, "Ese pedido no puede pasar a ese estado.");
      Object.assign(order, {
        stage: input.stage,
        stageChangedAt: at,
        version: order.version + 1,
      });
      return { order: withPaid(order) };
    }
    if (order.status !== "pending_confirmation")
      throw new DemoError(
        409,
        "El pedido ya fue atendido en otra pantalla. Actualizá la lista.",
      );
    const accepted = input.status === "accepted";
    Object.assign(order, {
      status: input.status,
      version: order.version + 1,
      acceptedAt: accepted ? at : order.acceptedAt,
      stage: accepted ? "preparing" : null,
      stageChangedAt: accepted ? at : null,
      estimatedReadyAt:
        accepted && input.preparationMinutes
          ? new Date(
              Date.now() + input.preparationMinutes * 60_000,
            ).toISOString()
          : order.estimatedReadyAt,
      // Gestión es una foto fija: la venta nueva no aparece ahí, así que sin link.
      saleId: null,
    });
    return { order: { ...withPaid(order), management: null } };
  }

  function manualOrder(body: unknown) {
    const input = manualOrderInput.parse(body);
    const items = priceItems(input.items);
    const subtotal = items.reduce((n, i) => n + i.lineCents, 0);
    let fee = 0,
      zoneName: string | null = null;
    if (input.fulfillment === "delivery") {
      if (input.address.length < 5)
        throw new DemoError(422, "Completá la dirección de entrega.");
      const zone = input.zoneId
        ? state.settings.deliveryZones.find((z) => z.id === input.zoneId)
        : null;
      if (input.zoneId && !zone)
        throw new DemoError(
          409,
          "Esa zona de delivery cambió. Elegila de nuevo.",
        );
      fee = zone ? zone.feeCents : input.deliveryCents;
      zoneName = zone ? zone.name : "Envío";
    }
    const at = now();
    const order: Order = {
      id: crypto.randomUUID(),
      number: nextNumber(),
      status: "accepted",
      customerName: input.customerName || defaultCustomerName(input.channel),
      customerPhone: input.customerPhone,
      fulfillment: input.fulfillment,
      address: input.fulfillment === "delivery" ? input.address : null,
      zoneName,
      deliveryLocation: null,
      paymentMethod: input.paymentMethod,
      note: input.note,
      items,
      subtotalCents: subtotal,
      deliveryCents: fee,
      totalCents: subtotal + fee,
      version: 1,
      createdAt: at,
      acceptedAt: at,
      stage: "preparing",
      stageChangedAt: at,
      trackingToken: token(),
      estimatedReadyAt: input.preparationMinutes
        ? new Date(Date.now() + input.preparationMinutes * 60_000).toISOString()
        : null,
      rating: null,
      channel: input.channel,
      saleId: null,
    };
    state.orders.push(order);
    return { order: { ...withPaid(order), management: null } };
  }

  function saveProduct(body: unknown, id?: string) {
    const parsed = id
      ? z
          .object({
            product: productInput,
            version: z.number().int().positive(),
          })
          .strict()
          .parse(body)
      : { product: productInput.parse(body), version: 0 };
    const p = parsed.product;
    const clash = state.products.some(
      (other) =>
        other.id !== id &&
        other.name.trim().toLowerCase() === p.name.trim().toLowerCase(),
    );
    if (clash)
      throw new DemoError(
        409,
        "Ya hay un producto con ese nombre. Editá el existente o usá otro nombre.",
      );
    const fields = { ...p, imageUrl: p.imageUrl || "" };
    if (!id) {
      const product = {
        ...fields,
        id: crypto.randomUUID(),
        version: 1,
      } as Product;
      state.products.push(product);
      return { product };
    }
    const at = state.products.findIndex((other) => other.id === id);
    if (at < 0 || state.products[at].version !== parsed.version)
      throw new DemoError(
        409,
        "El producto cambió en otra pantalla. Recargá la carta antes de editarlo.",
      );
    state.products[at] = {
      ...state.products[at],
      ...fields,
      version: parsed.version + 1,
    } as Product;
    return { product: state.products[at] };
  }

  function saveSettings(body: unknown) {
    const { settings, version } = z
      .object({ settings: settingsInput, version: z.number().int().min(0) })
      .strict()
      .parse(body);
    if (version !== state.settings.version)
      throw new DemoError(
        409,
        "La configuración cambió en otra pantalla. Recargá antes de guardar.",
      );
    state.settings = {
      ...state.settings,
      ...settings,
      version: version + 1,
    } as StoreSettings;
    return { settings: state.settings };
  }

  function route(method: string, path: string, body: unknown): Reply {
    const [section, rest] = path.split("/").filter(Boolean);
    if (section === "orders" && rest === "manual" && method === "POST")
      return ok(manualOrder(body), 201);
    if (section === "orders" && !rest) {
      if (method === "GET") {
        maybeArrive();
        return ok({
          orders: listOrders(),
          categories: state.categories,
          kitchen: state.kitchen,
          cashOpen: Boolean(openSession()),
        });
      }
      if (method === "POST") return ok(updateOrder(body));
    }
    if (section === "cash" && !rest) {
      if (method === "GET") return ok(cashState());
      if (method === "POST") return ok(runCash(body));
    }
    if (section === "menu") {
      if (rest === "images" || rest === "import") {
        if (method === "GET") return ok({ imports: [] });
        return fail(403, demoNotice);
      }
      if (!rest && method === "GET")
        return ok({
          products: state.products,
          settings: state.settings,
          aiAvailable: false,
        });
      if (!rest && method === "POST") return ok(saveProduct(body), 201);
      if (rest && method === "PUT") return ok(saveProduct(body, rest));
      if (rest && method === "DELETE") {
        const { version } = z
          .object({ version: z.number().int().positive() })
          .strict()
          .parse(body);
        const product = state.products.find((p) => p.id === rest);
        if (!product || product.version !== version)
          throw new DemoError(409, "El producto cambió. Recargá la carta.");
        state.products = state.products.filter((p) => p.id !== rest);
        return ok({ ok: true });
      }
    }
    if (section === "store" && !rest) {
      if (method === "GET") return ok({ settings: state.settings });
      if (method === "PUT") return ok(saveSettings(body));
      if (method === "POST") {
        const { publish } = z
          .object({ publish: z.boolean() })
          .strict()
          .parse(body);
        state.settings = {
          ...state.settings,
          isPublished: publish,
          version: state.settings.version + 1,
        };
        return ok({ settings: state.settings });
      }
    }
    if (section === "ticket" && method === "PUT") {
      state.ticket = z
        .object({ ticket: ticketConfigInput })
        .strict()
        .parse(body).ticket;
      return ok({ ticket: state.ticket });
    }
    if (section === "kitchen" && method === "PUT") {
      state.kitchen = z
        .object({ kitchen: kitchenConfigInput })
        .strict()
        .parse(body).kitchen;
      return ok({ kitchen: state.kitchen });
    }
    return fail(404, "Esta parte no está disponible en la demo.");
  }

  return {
    state,
    cashState,
    listOrders,
    handle(method: string, path: string, body: unknown): Reply {
      try {
        return route(method.toUpperCase(), path, body);
      } catch (e) {
        if (e instanceof DemoError) return fail(e.status, e.message);
        if (e instanceof z.ZodError)
          return fail(
            422,
            e.issues
              .map((i) => `${i.path.join(".")}: ${i.message}`)
              .slice(0, 8)
              .join(" · "),
          );
        return fail(
          500,
          "Algo falló en la demo. Recargá la página para empezar de nuevo.",
        );
      }
    },
  };
}

export type Sandbox = ReturnType<typeof createSandbox>;
