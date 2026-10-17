import Link from "next/link";
import { storePreviewUrl, storeUrl } from "@/lib/hosts";

// Acceso destacado a la tienda pública desde el panel del negocio.
export function StoreLinkBar({
  slug,
  base,
  isPublished,
}: {
  slug: string;
  base: string;
  isPublished: boolean;
}) {
  const url = storeUrl(slug);
  return (
    <section
      className={`store-link-bar ${isPublished ? "active" : ""}`}
      aria-label="Tu tienda pública"
    >
      <div>
        <p className="eyebrow">
          {isPublished
            ? "TU TIENDA ESTÁ ONLINE"
            : "TU TIENDA TODAVÍA NO ESTÁ PUBLICADA"}
        </p>
        {isPublished ? (
          <p className="store-link-url">{url.replace(/^https?:\/\//, "")}</p>
        ) : (
          <p>
            Mirá cómo la van a ver tus clientes y{" "}
            <Link href={`${base}/tienda`}>activala desde Tienda</Link>.
          </p>
        )}
      </div>
      {isPublished ? (
        <Link className="primary-button" href={url} target="_blank">
          Ver mi tienda pública <span aria-hidden="true">↗</span>
        </Link>
      ) : (
        <Link
          className="secondary-button"
          href={storePreviewUrl(slug)}
          target="_blank"
        >
          Vista previa de la tienda <span aria-hidden="true">↗</span>
        </Link>
      )}
    </section>
  );
}
