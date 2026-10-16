import Link from "next/link";

export default function NotFound() {
  return (
    <main className="site-shell error-page">
      <p className="eyebrow">PÁGINA NO DISPONIBLE</p>
      <h1 className="form-title">No encontramos este espacio.</h1>
      <p>Revisá el enlace o entrá a los negocios asociados a tu cuenta.</p>
      <Link href="/panel" className="primary-button compact-button">
        Ir a mis negocios <span aria-hidden="true">→</span>
      </Link>
    </main>
  );
}
