export type BookPlaceType = "library" | "bookstore" | "little_free_library";

export type BookPlace = {
  id: string;
  name: string;
  type: BookPlaceType;
  lat: number;
  lng: number;
  address?: string;
  walkMinutes?: number;
  distanceMeters?: number;
};

function bboxAround(lat: number, lng: number, radiusMeters: number) {
  const latDelta = radiusMeters / 111320;
  const lngDelta = radiusMeters / (111320 * Math.cos((lat * Math.PI) / 180));
  return {
    south: lat - latDelta,
    north: lat + latDelta,
    west: lng - lngDelta,
    east: lng + lngDelta,
  };
}

export async function fetchNearbyBookPlaces(
  lat: number,
  lng: number,
  radiusMeters = 3000
): Promise<BookPlace[]> {
  const { south, north, west, east } = bboxAround(lat, lng, radiusMeters);

  const query = `
    [out:json][timeout:25];
    (
      node["amenity"="library"](${south},${west},${north},${east});
      way["amenity"="library"](${south},${west},${north},${east});
      node["shop"="books"](${south},${west},${north},${east});
      way["shop"="books"](${south},${west},${north},${east});
      node["amenity"="public_bookcase"](${south},${west},${north},${east});
      node["amenity"="give_box"]["give_box:books"="yes"](${south},${west},${north},${east});
    );
    out center 50;
  `;

  const res = await fetch("https://overpass-api.de/api/interpreter", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: `data=${encodeURIComponent(query)}`,
    next: { revalidate: 3600 },
  });

  if (!res.ok) {
    throw new Error(`Overpass API error: ${res.status}`);
  }

  const data = (await res.json()) as {
    elements: {
      id: number;
      type: string;
      lat?: number;
      lon?: number;
      center?: { lat: number; lon: number };
      tags?: Record<string, string>;
    }[];
  };

  const places: BookPlace[] = [];

  for (const el of data.elements) {
    const placeLat = el.lat ?? el.center?.lat;
    const placeLng = el.lon ?? el.center?.lon;
    if (placeLat == null || placeLng == null) continue;

    const tags = el.tags ?? {};
    let type: BookPlaceType = "bookstore";
    if (tags.amenity === "library") type = "library";
    else if (
      tags.amenity === "public_bookcase" ||
      tags["give_box:books"] === "yes"
    ) {
      type = "little_free_library";
    }

    const name =
      tags.name ||
      (type === "library"
        ? "Library"
        : type === "little_free_library"
          ? "Little Free Library"
          : "Bookstore");

    places.push({
      id: `${el.type}-${el.id}`,
      name,
      type,
      lat: placeLat,
      lng: placeLng,
      address: [tags["addr:street"], tags["addr:city"]].filter(Boolean).join(", ") || undefined,
    });
  }

  return dedupePlaces(places);
}

function dedupePlaces(places: BookPlace[]): BookPlace[] {
  const seen = new Map<string, BookPlace>();
  for (const p of places) {
    const key = `${p.name.toLowerCase()}-${p.lat.toFixed(4)}-${p.lng.toFixed(4)}`;
    if (!seen.has(key)) seen.set(key, p);
  }
  return [...seen.values()];
}

export function haversineMeters(
  lat1: number,
  lng1: number,
  lat2: number,
  lng2: number
): number {
  const R = 6371000;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLng = ((lng2 - lng1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

export function estimateWalkMinutes(distanceMeters: number): number {
  const walkSpeedMps = 1.4;
  return Math.ceil(distanceMeters / walkSpeedMps / 60);
}
