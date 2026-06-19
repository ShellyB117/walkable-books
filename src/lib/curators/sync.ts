import { eq } from "drizzle-orm";
import { v4 as uuidv4 } from "uuid";
import { db } from "../db";
import { curatorBooks, curators } from "../db/schema";
import { upsertBookFromImport } from "../books/service";
import {
  fetchCuratorDisplayName,
  fetchGoodreadsShelf,
  parseGoodreadsProfileUrl,
} from "../goodreads/rss";
import {
  getPublicListBooks,
  parseHardcoverListUrl,
} from "../hardcover/client";

export async function syncCurator(
  curatorId: string,
  hardcoverToken?: string
): Promise<number> {
  const curator = await db.query.curators.findFirst({
    where: eq(curators.id, curatorId),
  });
  if (!curator) throw new Error("Curator not found");

  let count = 0;

  if (curator.platform === "goodreads" && curator.rssUrl) {
    const shelfBooks = await fetchGoodreadsShelf(curator.rssUrl);
    for (const item of shelfBooks) {
      const bookId = await upsertBookFromImport(item, hardcoverToken);
      await db
        .insert(curatorBooks)
        .values({
          curatorId,
          bookId,
          addedAt: item.publishedAt ?? new Date(),
        })
        .onConflictDoNothing();
      count++;
    }
  } else if (curator.platform === "hardcover" && curator.externalId) {
    const listBooks = await getPublicListBooks(curator.externalId, 50, hardcoverToken);
    for (const item of listBooks) {
      const bookId = await upsertBookFromImport(item, hardcoverToken);
      await db
        .insert(curatorBooks)
        .values({
          curatorId,
          bookId,
          addedAt: new Date(),
        })
        .onConflictDoNothing();
      count++;
    }
  }

  await db
    .update(curators)
    .set({ lastSyncedAt: new Date() })
    .where(eq(curators.id, curatorId));

  return count;
}

export async function syncAllCuratorsForSession(
  sessionId: string,
  hardcoverToken?: string
): Promise<{ synced: number; curators: number }> {
  const sessionCurators = await db.query.curators.findMany({
    where: eq(curators.sessionId, sessionId),
  });

  let synced = 0;
  for (const c of sessionCurators) {
    synced += await syncCurator(c.id, hardcoverToken);
  }

  return { synced, curators: sessionCurators.length };
}

export async function followGoodreadsCurator(
  sessionId: string,
  input: string,
  hardcoverToken?: string
): Promise<{ curatorId: string; bookCount: number }> {
  const profile = parseGoodreadsProfileUrl(input);
  if (!profile) throw new Error("Invalid Goodreads profile or RSS URL");

  const name = await fetchCuratorDisplayName(profile.profileUrl, profile.userId);
  const curatorId = uuidv4();

  await db.insert(curators).values({
    id: curatorId,
    sessionId,
    name,
    platform: "goodreads",
    profileUrl: profile.profileUrl,
    rssUrl: profile.rssUrl,
    shelf: profile.shelf,
    externalId: profile.userId,
    createdAt: new Date(),
  });

  const bookCount = await syncCurator(curatorId, hardcoverToken);
  return { curatorId, bookCount };
}

export async function followHardcoverCurator(
  sessionId: string,
  input: string,
  hardcoverToken?: string
): Promise<{ curatorId: string; bookCount: number }> {
  const info = parseHardcoverListUrl(input);
  if (!info?.listSlug) {
    throw new Error("Please provide a Hardcover list URL (e.g. hardcover.app/@user/lists/my-list)");
  }

  const curatorId = uuidv4();

  await db.insert(curators).values({
    id: curatorId,
    sessionId,
    name: `@${info.username} / ${info.listSlug}`,
    platform: "hardcover",
    profileUrl: `https://hardcover.app/@${info.username}/lists/${info.listSlug}`,
    externalId: info.listSlug,
    shelf: info.listSlug,
    createdAt: new Date(),
  });

  const bookCount = await syncCurator(curatorId, hardcoverToken);
  return { curatorId, bookCount };
}
