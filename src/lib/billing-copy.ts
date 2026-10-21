import {
  launchMonths,
  launchPriceCents,
  regularPriceCents,
  trialDays,
} from "./billing";
import { formatMoney } from "./menu";

// Un solo texto de precio para la landing, el registro y los avisos del panel.
export const launchPrice = formatMoney(launchPriceCents);
export const regularPrice = formatMoney(regularPriceCents);
export const priceSentence = `${trialDays} días gratis. Después, ${launchPrice} por mes los primeros ${launchMonths} meses y ${regularPrice} por mes desde el cuarto.`;

// WhatsApp de Pedipue para pagos y postulaciones. BILLING_WHATSAPP lo
// reemplaza; sin la variable, el número de Balthasar.
const defaultWhatsapp = "5493794721825";

export function pedipueWhatsapp(text: string): string | null {
  const phone = (process.env.BILLING_WHATSAPP || defaultWhatsapp).replace(
    /\D/g,
    "",
  );
  if (!phone) return null;
  return `https://wa.me/${phone}?text=${encodeURIComponent(text)}`;
}
