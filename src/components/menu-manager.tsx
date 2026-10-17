"use client";
import Link from "next/link";
import { useState } from "react";
import {
  formatMoney,
  productImage,
  type Product,
  type ProductInput,
} from "@/lib/menu";
import { ProductEditor } from "./product-editor";
import { MenuImporter } from "./menu-importer";
import { usePanelBase } from "./panel-base";
export function MenuManager({
  businessId,
  initialProducts,
  aiAvailable,
}: {
  businessId: string;
  initialProducts: Product[];
  aiAvailable: boolean;
}) {
  const panel = usePanelBase();
  const [products, setProducts] = useState(initialProducts);
  const [editor, setEditor] = useState<Product | null | false>(false);
  const [importing, setImporting] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [busyId, setBusyId] = useState("");
  const [archiveId, setArchiveId] = useState("");
  const [query, setQuery] = useState("");
  const base = `/api/businesses/${businessId}/menu`;
  async function reload() {
    const r = await fetch(base, { cache: "no-store" });
    const d = await r.json();
    if (!r.ok) throw new Error(d.error);
    setProducts(d.products);
  }
  async function save(input: ProductInput) {
    const r = await fetch(editor ? `${base}/${editor.id}` : base, {
      method: editor ? "PUT" : "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(
        editor ? { product: input, version: editor.version } : input,
      ),
    });
    const d = await r.json();
    if (!r.ok) throw new Error(d.error);
    await reload();
    setEditor(false);
    setNotice("Producto guardado en tu carta.");
  }
  async function toggle(p: Product) {
    setBusyId(p.id);
    setError("");
    try {
      const { id, version, ...product } = p;
      const r = await fetch(`${base}/${id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          product: { ...product, isAvailable: !p.isAvailable },
          version,
        }),
      });
      const d = await r.json();
      if (!r.ok) throw new Error(d.error);
      await reload();
    } catch (e) {
      setError(e instanceof Error ? e.message : "No pudimos actualizarlo.");
    } finally {
      setBusyId("");
    }
  }
  async function archive(p: Product) {
    setBusyId(p.id);
    try {
      const r = await fetch(`${base}/${p.id}`, {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ version: p.version }),
      });
      const d = await r.json();
      if (!r.ok) throw new Error(d.error);
      await reload();
      setArchiveId("");
      setNotice("Producto archivado. Ya no se muestra en tu tienda.");
    } catch (e) {
      setError(e instanceof Error ? e.message : "No pudimos archivarlo.");
    } finally {
      setBusyId("");
    }
  }
  const filtered = products.filter((p) =>
    `${p.name} ${p.category}`.toLowerCase().includes(query.toLowerCase()),
  );
  const categories = [...new Set(filtered.map((p) => p.category))];
  return (
    <>
      <div className="workspace-toolbar">
        <div className="catalog-count">
          <strong>{products.length}</strong>{" "}
          {products.length === 1 ? "producto" : "productos"}{" "}
          <span>
            · {products.filter((p) => p.isAvailable).length} disponibles
          </span>
        </div>
        <div className="toolbar-actions">
          <button
            className="secondary-button"
            onClick={() => {
              setImporting(!importing);
              setNotice("");
            }}
          >
            ✦ {importing ? "Cerrar importador" : "Importar con IA"}
          </button>
          <button
            className="primary-button compact-button"
            onClick={() => {
              setEditor(null);
              setNotice("");
            }}
          >
            Agregar producto <span aria-hidden="true">+</span>
          </button>
        </div>
      </div>
      {importing ? (
        <MenuImporter
          businessId={businessId}
          aiAvailable={aiAvailable}
          onSaved={async (message) => {
            await reload();
            setImporting(false);
            setNotice(message);
          }}
        />
      ) : null}
      {error ? (
        <p className="form-error" role="alert">
          {error}
        </p>
      ) : null}
      {notice ? (
        <p className="success-notice" role="status">
          {notice}
        </p>
      ) : null}
      {products.length ? (
        <>
          <label className="catalog-search">
            <span>Buscar en tu carta</span>
            <input
              type="search"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Producto o categoría…"
            />
          </label>
          {filtered.length ? (
            categories.map((category) => (
              <section className="catalog-category" key={category}>
                <h2>
                  {category}
                  <span>
                    {filtered.filter((p) => p.category === category).length}
                  </span>
                </h2>
                {filtered
                  .filter((p) => p.category === category)
                  .map((p) => (
                    <article
                      className={`catalog-product ${p.isAvailable ? "" : "is-paused"}`}
                      key={p.id}
                    >
                      {p.imageUrl ? (
                        <img
                          className="catalog-product-photo"
                          src={productImage(p.imageUrl).src}
                          alt=""
                          loading="lazy"
                          referrerPolicy="no-referrer"
                          style={{
                            objectPosition: `${p.imageFocusX}% ${p.imageFocusY}%`,
                          }}
                        />
                      ) : (
                        <button
                          type="button"
                          className="catalog-product-photo is-empty"
                          onClick={() => setEditor(p)}
                        >
                          + Foto<span className="sr-only"> para {p.name}</span>
                        </button>
                      )}
                      <div className="catalog-product-copy">
                        <div className="product-heading">
                          <h3>{p.name}</h3>
                          {p.kind === "combo" ? (
                            <span className="small-badge">Combo</span>
                          ) : null}
                          {!p.isAvailable ? (
                            <span className="small-badge">Pausado</span>
                          ) : null}
                        </div>
                        {p.description ? <p>{p.description}</p> : null}
                        <div className="variant-prices">
                          {p.variants.map((v) => (
                            <span key={v.id}>
                              {p.variants.length > 1 ? `${v.name} · ` : ""}
                              <strong>{formatMoney(v.priceCents)}</strong>
                            </span>
                          ))}
                        </div>
                        {p.addOns.length ? (
                          <small>
                            {p.addOns.length} adicionales opcionales
                          </small>
                        ) : null}
                        {p.optionGroups?.length ? (
                          <small>
                            Para elegir:{" "}
                            {p.optionGroups.map((g) => g.name).join(", ")}
                          </small>
                        ) : null}
                      </div>
                      <div className="product-actions">
                        <button
                          className="quiet-button"
                          onClick={() => setEditor(p)}
                        >
                          Editar<span className="sr-only"> {p.name}</span>
                        </button>
                        <button
                          className="quiet-button"
                          disabled={busyId === p.id}
                          onClick={() => toggle(p)}
                        >
                          {p.isAvailable ? "Pausar" : "Habilitar"}
                          <span className="sr-only"> {p.name}</span>
                        </button>
                        <button
                          className="quiet-button muted-action"
                          disabled={busyId === p.id}
                          onClick={() =>
                            setArchiveId(archiveId === p.id ? "" : p.id)
                          }
                        >
                          Archivar<span className="sr-only"> {p.name}</span>
                        </button>
                      </div>
                      {archiveId === p.id ? (
                        <div className="archive-confirm">
                          <p>
                            ¿Archivar “{p.name}”? Se ocultará de tu carta y de
                            la tienda.
                          </p>
                          <button
                            className="secondary-button"
                            onClick={() => setArchiveId("")}
                          >
                            Cancelar
                          </button>
                          <button
                            className="primary-button compact-button"
                            disabled={busyId === p.id}
                            onClick={() => archive(p)}
                          >
                            Sí, archivar
                          </button>
                        </div>
                      ) : null}
                    </article>
                  ))}
              </section>
            ))
          ) : (
            <p className="empty-search">
              No encontramos productos con esa búsqueda.
            </p>
          )}
        </>
      ) : (
        <section className="empty-catalog">
          <span aria-hidden="true">01 / CARTA</span>
          <h2>
            Lo que preparás
            <br />
            merece su lugar.
          </h2>
          <p>
            Agregá tu primer producto o subí una foto de tu carta. Podés mezclar
            carga manual e importación con IA.
          </p>
          <button className="text-button" onClick={() => setEditor(null)}>
            Cargar mi primer producto →
          </button>
        </section>
      )}
      <div className="next-step-strip">
        <div>
          <strong>Después de tu carta, tu tienda.</strong>
          <p>
            Configurá horarios, retiro y zonas de delivery para empezar a
            recibir pedidos.
          </p>
        </div>
        <Link className="text-link" href={`${panel}/tienda`}>
          Configurar tienda →
        </Link>
      </div>
      {editor !== false ? (
        <ProductEditor
          businessId={businessId}
          product={editor ?? undefined}
          categories={[...new Set(products.map((p) => p.category))]}
          onSave={save}
          onClose={() => setEditor(false)}
        />
      ) : null}
    </>
  );
}
