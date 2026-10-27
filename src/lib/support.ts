import { pedipueWhatsapp } from "./billing-copy";
import { storeUrl } from "./hosts";

export function supportWhatsapp(business: { name: string; slug: string }) {
  return pedipueWhatsapp(
    `Hola Balthasar, necesito ayuda con mi negocio ${business.name} en Pedipue.\nTienda: ${storeUrl(business.slug)}\n\nMi consulta: `,
  );
}
