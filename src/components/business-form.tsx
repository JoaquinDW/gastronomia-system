"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { businessInput, businessKinds, slugify } from "@/lib/business-input";
import { storeUrl } from "@/lib/hosts";

export function BusinessForm({ email }: { email: string }) {
  const router = useRouter();
  const requestKey = useRef<string | null>(null);
  const [name, setName] = useState("");
  const [slug, setSlug] = useState("");
  const [editedSlug, setEditedSlug] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [fields, setFields] = useState<Record<string, string[] | undefined>>(
    {},
  );

  function hint(field: string) {
    return fields[field]?.[0] ? (
      <span className="field-error" id={`${field}-error`}>
        {fields[field]?.[0]}
      </span>
    ) : null;
  }

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busy) return;
    requestKey.current ??= crypto.randomUUID();
    const form = new FormData(event.currentTarget);
    const parsed = businessInput.safeParse({
      name,
      slug,
      kind: form.get("kind"),
      whatsapp: form.get("whatsapp"),
      city: form.get("city"),
      address: form.get("address"),
      requestKey: requestKey.current,
    });
    if (!parsed.success) {
      setFields(parsed.error.flatten().fieldErrors);
      setError("Revisá los campos marcados.");
      return;
    }
    setBusy(true);
    setError("");
    setFields({});
    try {
      const response = await fetch("/api/businesses", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(parsed.data),
      });
      const data = await response.json();
      if (!response.ok) {
        setError(
          typeof data.error === "string"
            ? data.error
            : "No pudimos crear el negocio. Volvé a intentar.",
        );
        setFields(data.fields ?? {});
        // A conflict/validation rejection is known not to have committed this payload.
        // Keep the key after network/503 errors, where the previous outcome is unknown.
        if (response.status === 409 || response.status === 422)
          requestKey.current = null;
        setBusy(false);
        return;
      }
      if (typeof data.id !== "string") throw new Error("Missing business ID");
      router.replace(`/panel/negocios/${encodeURIComponent(data.id)}`);
      router.refresh();
    } catch {
      setError(
        "No pudimos conectar. Tus datos siguen acá. Volvé a intentar; no vamos a duplicar tu negocio.",
      );
      setBusy(false);
    }
  }

  return (
    <>
      <p className="eyebrow">PASO 02 / 02</p>
      <h1 className="form-title">Dale lugar a tu negocio.</h1>
      <p className="form-description">
        Te vamos a registrar como propietario con la cuenta{" "}
        <strong>{email}</strong>.
      </p>
      <form onSubmit={submit} className="app-form" noValidate>
        <fieldset disabled={busy}>
          <label>
            Nombre del negocio
            <input
              name="name"
              value={name}
              onChange={(event) => {
                setName(event.target.value);
                if (!editedSlug) setSlug(slugify(event.target.value));
              }}
              placeholder="La Esquina Burgers"
              required
              maxLength={100}
              autoComplete="organization"
              aria-invalid={!!fields.name}
              aria-describedby={fields.name ? "name-error" : undefined}
            />
            {hint("name")}
          </label>
          <label>
            Dirección de tu tienda
            <input
              name="slug"
              value={slug}
              onChange={(event) => {
                setEditedSlug(true);
                setSlug(event.target.value.toLowerCase());
              }}
              placeholder="la-esquina-burgers"
              required
              maxLength={63}
              autoCapitalize="none"
              spellCheck={false}
              aria-invalid={!!fields.slug}
              aria-describedby={fields.slug ? "slug-error" : "slug-hint"}
            />
            {hint("slug")}
          </label>
          <p id="slug-hint" className="field-hint">
            Tu tienda va a estar en{" "}
            <strong>
              {storeUrl(slug || "tu-negocio").replace(/^https?:\/\//, "")}
            </strong>
            . Podés personalizarla.
          </p>
          <label>
            ¿Qué preparás?
            <select
              name="kind"
              defaultValue=""
              required
              aria-invalid={!!fields.kind}
              aria-describedby={fields.kind ? "kind-error" : undefined}
            >
              <option value="" disabled>
                Elegí el rubro
              </option>
              {businessKinds.map((kind) => (
                <option key={kind.value} value={kind.value}>
                  {kind.label}
                </option>
              ))}
            </select>
            {hint("kind")}
          </label>
          <label>
            WhatsApp del negocio
            <input
              name="whatsapp"
              type="tel"
              autoComplete="tel"
              placeholder="+54 9 351 123 4567"
              required
              maxLength={30}
              aria-invalid={!!fields.whatsapp}
              aria-describedby={
                fields.whatsapp ? "whatsapp-error" : "whatsapp-hint"
              }
            />
            {hint("whatsapp")}
          </label>
          <p id="whatsapp-hint" className="field-hint">
            Incluí el código de país y de área. Ahí recibirás los resúmenes de
            pedidos.
          </p>
          <label>
            Ciudad
            <input
              name="city"
              autoComplete="address-level2"
              placeholder="Córdoba"
              required
              maxLength={100}
              aria-invalid={!!fields.city}
              aria-describedby={fields.city ? "city-error" : undefined}
            />
            {hint("city")}
          </label>
          <label>
            Dirección del local <span className="optional-label">opcional</span>
            <input
              name="address"
              autoComplete="street-address"
              placeholder="Calle y número"
              maxLength={200}
              aria-invalid={!!fields.address}
              aria-describedby={fields.address ? "address-error" : undefined}
            />
            {hint("address")}
          </label>
        </fieldset>
        {error ? (
          <p className="form-error" role="alert">
            {error}
          </p>
        ) : null}
        <button className="primary-button" disabled={busy} type="submit">
          {busy ? "Creando tu negocio…" : "Crear mi negocio"}
          <span aria-hidden="true">→</span>
        </button>
        <p className="form-footnote">
          El alta crea tu espacio de gestión. Tu tienda todavía no se publica ni
          empieza a recibir pedidos.
        </p>
      </form>
    </>
  );
}
