import { eq, lt } from "drizzle-orm";
import { db } from "@/lib/db";
import { apiCache } from "@/lib/db/schema";

export async function getCached<T>(key: string): Promise<T | null> {
  const row = await db.query.apiCache.findFirst({
    where: eq(apiCache.key, key),
  });
  if (!row) return null;
  if (row.expiresAt < new Date()) {
    await db.delete(apiCache).where(eq(apiCache.key, key));
    return null;
  }
  return JSON.parse(row.value) as T;
}

export async function setCache(
  key: string,
  value: unknown,
  ttlSeconds: number
): Promise<void> {
  const expiresAt = new Date(Date.now() + ttlSeconds * 1000);
  await db
    .insert(apiCache)
    .values({ key, value: JSON.stringify(value), expiresAt })
    .onConflictDoUpdate({
      target: apiCache.key,
      set: { value: JSON.stringify(value), expiresAt },
    });
}

export async function cleanExpiredCache(): Promise<number> {
  const now = new Date();
  const expired = await db.query.apiCache.findMany({
    where: lt(apiCache.expiresAt, now),
  });
  for (const row of expired) {
    await db.delete(apiCache).where(eq(apiCache.key, row.key));
  }
  return expired.length;
}
