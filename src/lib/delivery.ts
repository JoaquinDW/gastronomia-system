import { z } from "zod";

export const coordinatesSchema = z.object({
  lat: z.number().finite().min(-90).max(90),
  lng: z.number().finite().min(-180).max(180),
}).strict();
export type Coordinates = z.infer<typeof coordinatesSchema>;

export const deliveryConfigSchema = z.discriminatedUnion("mode", [
  z.object({ mode: z.literal("manual") }).strict(),
  z.object({
    mode: z.literal("radius"),
    origin: coordinatesSchema,
    address: z.string().trim().min(5).max(250),
  }).strict(),
]);
export type DeliveryConfig = z.infer<typeof deliveryConfigSchema>;

/** Great-circle distance. Coverage radii are deliberately not road distances. */
export function distanceMeters(a: Coordinates, b: Coordinates): number {
  const radians = (n: number) => n * Math.PI / 180;
  const deltaLat = radians(b.lat - a.lat);
  const deltaLng = radians(b.lng - a.lng);
  const h = Math.sin(deltaLat / 2) ** 2 +
    Math.cos(radians(a.lat)) * Math.cos(radians(b.lat)) * Math.sin(deltaLng / 2) ** 2;
  return 6_371_008.8 * 2 * Math.asin(Math.sqrt(Math.min(1, h)));
}

export type RadiusZone = {
  id: string;
  name: string;
  feeCents: number;
  minimumCents: number;
  radiusMeters?: number;
};

/** The smallest matching radius wins, independently of editor order or price. */
export function deliveryQuote(
  config: DeliveryConfig,
  zones: RadiusZone[],
  destination: Coordinates | null,
) {
  if (config.mode !== "radius" || !destination) return null;
  const distance = distanceMeters(config.origin, destination);
  const zone = zones.filter(z => z.radiusMeters !== undefined && distance <= z.radiusMeters)
    .sort((a, b) => a.radiusMeters! - b.radiusMeters!)[0];
  return zone ? { zone, distanceMeters: Math.round(distance), feeCents: zone.feeCents } : null;
}
