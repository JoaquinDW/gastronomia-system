/// <reference types="google.maps" />
let loading: Promise<typeof google.maps> | undefined;
export const mapsEnabled = Boolean(process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY);

/** Loaded only when someone opens the location picker; shared by all pickers. */
export function loadMaps(): Promise<typeof google.maps> {
  if (loading) return loading;
  const key = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY;
  if (!key) return Promise.reject(new Error("La ubicación en el mapa no está disponible."));
  loading = new Promise((resolve, reject) => {
    const script = document.createElement("script");
    const target = window as typeof window & { pedipueMapsReady?: () => void };
    const fail = () => {
      window.clearTimeout(timer);
      delete target.pedipueMapsReady;
      script.remove();
      loading = undefined;
      reject(new Error("No pudimos cargar el mapa. Revisá tu conexión y volvé a intentar."));
    };
    const timer = window.setTimeout(fail, 20_000);
    target.pedipueMapsReady = () => {
      window.clearTimeout(timer);
      delete target.pedipueMapsReady;
      resolve(google.maps);
    };
    script.src = `https://maps.googleapis.com/maps/api/js?${new URLSearchParams({
      key, v: "quarterly", loading: "async", libraries: "marker,geocoding,places", language: "es", region: "AR", callback: "pedipueMapsReady",
    })}`;
    script.async = true;
    script.onerror = fail;
    document.head.append(script);
  });
  return loading;
}
