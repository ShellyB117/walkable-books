import { eq } from "drizzle-orm";
import { db } from "../db";
import { geoPlacesCache } from "../db/schema";
import { getCached, setCache } from "../cache";
import { fetchNearbyBookPlaces, type BookPlace } from "./overpass";
import { addWalkingTimes } from "./routing";

const CACHE_TTL = 3600;

export async function getPlacesForSession(
  sessionId: string,
  lat: number,
  lng: number
): Promise<BookPlace[]> {
  const cacheKey = `places:${sessionId}:${lat.toFixed(3)}:${lng.toFixed(3)}`;
  const cached = await getCached<BookPlace[]>(cacheKey);
  if (cached) return cached;

  const row = await db.query.geoPlacesCache.findFirst({
    where: eq(geoPlacesCache.sessionId, sessionId),
  });

  if (row && Date.now() - row.cachedAt.getTime() < CACHE_TTL * 1000) {
    const places = JSON.parse(row.placesJson) as BookPlace[];
    await setCache(cacheKey, places, CACHE_TTL);
    return places;
  }

  const raw = await fetchNearbyBookPlaces(lat, lng);
  const withWalk = await addWalkingTimes(lat, lng, raw);
  const sorted = withWalk.sort(
    (a, b) => (a.walkMinutes ?? 999) - (b.walkMinutes ?? 999)
  );

  await db
    .insert(geoPlacesCache)
    .values({
      sessionId,
      placesJson: JSON.stringify(sorted),
      cachedAt: new Date(),
    })
    .onConflictDoUpdate({
      target: geoPlacesCache.sessionId,
      set: { placesJson: JSON.stringify(sorted), cachedAt: new Date() },
    });

  await setCache(cacheKey, sorted, CACHE_TTL);
  return sorted;
}
