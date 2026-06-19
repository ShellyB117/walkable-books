import type { BookPlace } from "./overpass";
import { estimateWalkMinutes, haversineMeters } from "./overpass";

type MatrixResponse = {
  durations?: number[][];
  distances?: number[][];
};

export async function geocodeAddress(address: string): Promise<{ lat: number; lng: number; label: string }> {
  const apiKey = process.env.OPENROUTESERVICE_API_KEY;
  if (!apiKey) {
    throw new Error("OpenRouteService API key not configured");
  }

  const res = await fetch(
    `https://api.openrouteservice.org/geocode/search?api_key=${apiKey}&text=${encodeURIComponent(address)}&size=1`,
    { next: { revalidate: 86400 } }
  );

  if (!res.ok) {
    throw new Error(`Geocoding failed: ${res.status}`);
  }

  const data = (await res.json()) as {
    features?: { geometry: { coordinates: [number, number] }; properties: { label: string } }[];
  };

  const feature = data.features?.[0];
  if (!feature) throw new Error("Address not found");

  const [lng, lat] = feature.geometry.coordinates;
  return { lat, lng, label: feature.properties.label };
}

export async function addWalkingTimes(
  originLat: number,
  originLng: number,
  places: BookPlace[]
): Promise<BookPlace[]> {
  if (places.length === 0) return [];

  const apiKey = process.env.OPENROUTESERVICE_API_KEY;
  if (!apiKey) {
    return places.map((p) => {
      const dist = haversineMeters(originLat, originLng, p.lat, p.lng);
      return {
        ...p,
        distanceMeters: dist,
        walkMinutes: estimateWalkMinutes(dist),
      };
    });
  }

  const locations = [[originLng, originLat], ...places.map((p) => [p.lng, p.lat])];

  try {
    const res = await fetch(
      "https://api.openrouteservice.org/v2/matrix/foot-walking",
      {
        method: "POST",
        headers: {
          Authorization: apiKey,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          locations,
          sources: [0],
          destinations: places.map((_, i) => i + 1),
          metrics: ["duration", "distance"],
        }),
      }
    );

    if (!res.ok) {
      throw new Error(`Matrix API failed: ${res.status}`);
    }

    const data = (await res.json()) as MatrixResponse;
    const durations = data.durations?.[0] ?? [];
    const distances = data.distances?.[0] ?? [];

    return places.map((p, i) => ({
      ...p,
      walkMinutes: durations[i] != null ? Math.ceil(durations[i] / 60) : estimateWalkMinutes(haversineMeters(originLat, originLng, p.lat, p.lng)),
      distanceMeters: distances[i] ?? haversineMeters(originLat, originLng, p.lat, p.lng),
    }));
  } catch {
    return places.map((p) => {
      const dist = haversineMeters(originLat, originLng, p.lat, p.lng);
      return { ...p, distanceMeters: dist, walkMinutes: estimateWalkMinutes(dist) };
    });
  }
}

export function directionsUrl(
  originLat: number,
  originLng: number,
  destLat: number,
  destLng: number
): string {
  return `https://www.google.com/maps/dir/?api=1&origin=${originLat},${originLng}&destination=${destLat},${destLng}&travelmode=walking`;
}
