import Link from "next/link";

export function Brand() {
  return (
    <Link href="/" className="wordmark" aria-label="Pedipue, inicio">
      <span className="brand-mark" aria-hidden="true">
        p
      </span>
      <span>
        pedipue<span className="wordmark-dot">.</span>
      </span>
    </Link>
  );
}
