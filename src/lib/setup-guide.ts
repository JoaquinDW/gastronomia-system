import type { Product, StoreSettings } from "@/lib/menu";

// Primeros pasos de un local nuevo. Cada paso se marca solo a partir de los
// datos reales, así la guía nunca le pide al dueño algo que ya hizo.

// Cookie por local con la guía oculta; la lee el servidor para no parpadear.
export const guideCookie = (businessId: string) => `pedipue_guia_${businessId}`;

export type SetupStep = {
  key: string;
  title: string;
  why: string;
  done: boolean;
  // Lo que ya hizo, en una línea, para los pasos completos o a medias.
  detail?: string;
  action: string;
  href: string;
};

export function setupSteps({
  base,
  products,
  settings,
  hasOrders,
  aiAvailable,
}: {
  base: string;
  products: Pick<Product, "imageUrl" | "isAvailable">[];
  settings: StoreSettings;
  hasOrders: boolean;
  aiAvailable: boolean;
}): SetupStep[] {
  const count = products.length;
  const withPhoto = products.filter((p) => p.imageUrl).length;
  const saved = settings.version > 0;
  const delivers =
    settings.pickupEnabled ||
    (settings.deliveryEnabled && settings.deliveryZones.length > 0);
  const shifts = settings.hours.length;
  return [
    {
      key: "menu",
      title: "Cargá tu carta",
      why: aiAvailable
        ? "Es lo que tus clientes ven y piden. Subí una foto o un PDF de tu carta y la armamos por vos."
        : "Es lo que tus clientes ven y piden: productos, presentaciones y precios.",
      done: count > 0,
      detail: count
        ? `${count} ${count === 1 ? "producto cargado" : "productos cargados"}.`
        : undefined,
      action: "Cargar la carta",
      href: `${base}/carta`,
    },
    {
      key: "photos",
      title: "Sumale fotos a tus productos",
      why: "La foto es lo que vende. Con la mitad de la carta con foto, la tienda ya se ve otra.",
      // Con al menos la mitad alcanza; no frenamos la guía por un producto sin foto.
      done: count > 0 && withPhoto * 2 >= count,
      detail: count ? `${withPhoto} de ${count} con foto.` : undefined,
      action: "Agregar fotos",
      href: `${base}/carta`,
    },
    {
      key: "cover",
      title: "Poné una portada",
      why: "Es lo primero que ve el cliente al abrir tu link. Sumá también una descripción corta del local.",
      done: Boolean(settings.coverImageUrl),
      action: "Elegir portada",
      href: `${base}/tienda#presentacion`,
    },
    {
      key: "hours",
      title: "Cargá tus horarios",
      why: "La tienda solo toma pedidos cuando está abierta. Fuera de horario muestra a qué hora abrís.",
      done: shifts > 0,
      detail: shifts
        ? `${shifts} ${shifts === 1 ? "turno cargado" : "turnos cargados"}.`
        : undefined,
      action: "Cargar horarios",
      href: `${base}/tienda#horarios`,
    },
    {
      key: "delivery",
      title: "Elegí cómo entregás y cobrás",
      why: "Retiro en el local, delivery con zonas y costo de envío, efectivo o transferencia.",
      // Hasta que se guarda, retiro y efectivo son solo valores por defecto.
      done: saved && delivers,
      detail:
        saved && delivers
          ? settings.pickupEnabled && settings.deliveryEnabled
            ? "Retiro y delivery."
            : settings.pickupEnabled
              ? "Retiro en el local."
              : "Delivery."
          : undefined,
      action: "Configurar entregas",
      href: `${base}/tienda#entregas`,
    },
    {
      key: "publish",
      title: "Publicá tu tienda",
      why: "Hasta que la actives, solo vos ves la vista previa. Necesita al menos un producto, horarios y una forma de entrega.",
      done: settings.isPublished,
      action: "Revisar y publicar",
      href: `${base}/tienda#publicar`,
    },
    {
      key: "share",
      title: "Compartí tu link",
      why: "Pasalo por WhatsApp, ponelo en tu Instagram o imprimilo en un QR para el mostrador. Los pedidos te llegan a Pedidos.",
      done: hasOrders,
      detail: hasOrders ? "Ya recibiste tu primer pedido." : undefined,
      action: "Ir a Pedidos",
      href: `${base}/pedidos`,
    },
  ];
}
