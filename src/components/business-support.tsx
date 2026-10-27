import { supportWhatsapp } from "@/lib/support";

export function BusinessSupport({
  business,
}: {
  business: { name: string; slug: string };
}) {
  const href = supportWhatsapp(business);
  if (!href) return null;
  return (
    <section
      className="business-data business-support"
      aria-labelledby="support-title"
    >
      <h2 id="support-title">¿Necesitás una mano?</h2>
      <p>
        Soy Balthasar, el creador de Pedipue. Si tenés una duda, algo no funciona
        o querés sugerir una mejora, escribime directamente.
      </p>
      <a
        className="ghost-button"
        href={href}
        target="_blank"
        rel="noopener noreferrer"
      >
        Hablar con Balthasar <span aria-hidden="true">↗</span>
      </a>
      <p className="field-hint">Se abre WhatsApp con los datos de tu negocio.</p>
    </section>
  );
}
