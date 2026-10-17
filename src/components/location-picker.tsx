/// <reference types="google.maps" />
"use client";
import { useEffect, useRef, useState } from "react";
import type { Coordinates } from "@/lib/delivery";
import { loadMaps, mapsEnabled } from "@/lib/maps-client";

type Props = {
  value: Coordinates | null;
  address: string;
  origin?: Coordinates;
  radii?: number[];
  onChange: (location: Coordinates) => void;
};
const noRadii: number[] = [];

export function LocationPicker({ value, address, origin, radii = noRadii, onChange }: Props) {
  const [expanded, setExpanded] = useState(false);
  const [attempt, setAttempt] = useState(0);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [candidates, setCandidates] = useState<google.maps.GeocoderResult[]>([]);
  const container = useRef<HTMLDivElement>(null);
  const map = useRef<google.maps.Map | null>(null);
  const marker = useRef<google.maps.marker.AdvancedMarkerElement | null>(null);
  const onSelect = useRef(onChange);
  onSelect.current = onChange;
  const latestValue = useRef(value);
  latestValue.current = value;
  const latestOrigin = useRef(origin);
  latestOrigin.current = origin;

  useEffect(() => {
    if (!expanded || !container.current) return;
    let cancelled = false;
    const listeners: google.maps.MapsEventListener[] = [];
    setError("");
    loadMaps().then(api => {
      if (cancelled || !container.current) return;
      const center = latestValue.current ?? latestOrigin.current ?? { lat: -31.4201, lng: -64.1888 };
      const current = new api.Map(container.current, {
        center, zoom: 14, mapId: process.env.NEXT_PUBLIC_GOOGLE_MAPS_MAP_ID || "DEMO_MAP_ID",
        streetViewControl: false, mapTypeControl: false, fullscreenControl: false,
        gestureHandling: "cooperative",
      });
      const pin = new api.marker.AdvancedMarkerElement({
        map: current, position: latestValue.current, title: "Ubicación elegida", gmpDraggable: true,
      });
      map.current = current;
      marker.current = pin;
      listeners.push(current.addListener("click", (event: google.maps.MapMouseEvent) => {
        if (event.latLng) onSelect.current(event.latLng.toJSON());
      }));
      listeners.push(pin.addListener("dragend", () => {
        const point = pin.position;
        if (point) onSelect.current({ lat: typeof point.lat === "function" ? point.lat() : point.lat, lng: typeof point.lng === "function" ? point.lng() : point.lng });
      }));
    }).catch(e => { if (!cancelled) setError(e.message); });
    return () => {
      cancelled = true;
      listeners.forEach(listener => listener.remove());
      if (marker.current) marker.current.map = null;
      marker.current = null;
      map.current = null;
    };
  }, [expanded, attempt]);

  useEffect(() => {
    if (marker.current) marker.current.position = value;
    if (value) map.current?.panTo(value);
  }, [value]);

  useEffect(() => {
    if (!expanded) return;
    let cancelled = false;
    const circles: google.maps.Circle[] = [];
    loadMaps().then(api => {
      if (cancelled || !map.current || !origin) return;
      const style = getComputedStyle(container.current!);
      for (const radius of radii) circles.push(new api.Circle({
        map: map.current, center: origin, radius, clickable: false,
        strokeColor: style.getPropertyValue("--ink").trim(), strokeWeight: 1, fillColor: style.getPropertyValue("--accent").trim(), fillOpacity: 0.06,
      }));
    }).catch(() => {});
    return () => { cancelled = true; circles.forEach(circle => circle.setMap(null)); };
  }, [expanded, attempt, origin, radii]);

  // Changing the typed address invalidates previous search results.
  useEffect(() => { setCandidates([]); }, [address]);

  async function search() {
    setBusy(true);
    setError("");
    setCandidates([]);
    const searched = address;
    try {
      const api = await loadMaps();
      const { results } = await new api.Geocoder().geocode({ address: searched, region: "AR" });
      // The field may have changed while the request was in flight.
      if (addressRef.current !== searched) return;
      if (!results.length) throw new Error("No encontramos esa dirección. Agregá la ciudad o marcá el punto en el mapa.");
      setCandidates(results.slice(0, 5));
    } catch {
      setError("No pudimos encontrar la dirección. Agregá la ciudad o marcá el punto en el mapa.");
    } finally { setBusy(false); }
  }
  const addressRef = useRef(address);
  addressRef.current = address;

  function locate() {
    setBusy(true);
    setError("");
    if (!navigator.geolocation) {
      setBusy(false);
      setError("Tu navegador no permite usar tu ubicación. Buscá la dirección en el mapa.");
      return;
    }
    navigator.geolocation.getCurrentPosition(({ coords }) => {
      onSelect.current({ lat: coords.latitude, lng: coords.longitude });
      setBusy(false);
    }, () => {
      setError("No pudimos obtener tu ubicación. Podés buscar la dirección o marcarla en el mapa.");
      setBusy(false);
    }, { enableHighAccuracy: true, timeout: 10_000, maximumAge: 0 });
  }

  if (!mapsEnabled) return <p className="field-hint standalone-hint" role="status">El mapa todavía no está disponible. Consultá al local para coordinar el envío.</p>;

  return <div className="location-picker">
    {!expanded ? <button type="button" className="secondary-button" onClick={() => setExpanded(true)}>
      {value ? "Revisar ubicación en el mapa" : "Ubicar dirección en el mapa"}
    </button> : <>
      <div className="location-actions">
        <button type="button" className="secondary-button" disabled={busy || address.trim().length < 5} onClick={search}>{busy ? "Buscando…" : "Buscar dirección"}</button>
        <button type="button" className="text-button" disabled={busy} onClick={locate}>Usar mi ubicación</button>
      </div>
      {candidates.length ? <ul className="location-results" aria-label="Direcciones encontradas">{candidates.map((candidate, index) => <li key={candidate.place_id || index}>
        <button type="button" className="text-button" onClick={() => {
          onSelect.current(candidate.geometry.location.toJSON());
          setCandidates([]);
        }}>{candidate.formatted_address}</button>
      </li>)}</ul> : null}
      <p className="field-hint standalone-hint">Elegí un resultado o tocá el mapa donde se hace la entrega. Podés mover el pin para ajustar el punto.</p>
      <div ref={container} className="delivery-map" aria-label="Mapa para elegir la ubicación" />
      <button type="button" className="text-button" onClick={() => {
        const center = map.current?.getCenter();
        if (center) onSelect.current(center.toJSON());
      }}>Usar el centro del mapa</button>
      {error ? <p className="form-error" role="alert">{error} <button type="button" className="text-button" onClick={() => setAttempt(n => n + 1)}>Reintentar mapa</button></p> : null}
    </>}
    {value ? <p className="field-hint standalone-hint" role="status">Ubicación marcada. Verificá que el pin coincida con la dirección escrita.</p> : null}
  </div>;
}
