import Link from "next/link";

export function Brand() {
  return (
    <Link href="/" className="wordmark" aria-label="Gastronomía, inicio">
      <span className="brand-mark" aria-hidden="true">
        g.
      </span>{" "}
      gastronomía
    </Link>
  );
}
