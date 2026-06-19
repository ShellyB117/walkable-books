export const runtime = "nodejs";

import { NextRequest, NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { db, initDb } from "@/lib/db";
import { curators, sessionBooks, sessions } from "@/lib/db/schema";
import { bookToEnriched } from "@/lib/books/service";
import { getPlacesForSession } from "@/lib/geo/service";
import {
  buildTasteProfile,
  scoreRecommendations,
  type ScoredRecommendation,
} from "@/lib/recommend/score";
import { getBookById, upsertBookFromImport } from "@/lib/books/service";
import { getBooksByTag, slugifyTag } from "@/lib/hardcover/client";
import { getOrCreateSessionId } from "@/lib/session";

export async function GET(request: NextRequest) {
  try {
    initDb();
    const sessionId = await getOrCreateSessionId();
    const { searchParams } = new URL(request.url);

    const maxWalk = searchParams.get("maxWalk")
      ? parseInt(searchParams.get("maxWalk")!, 10)
      : undefined;
    const placeType = searchParams.get("placeType") as
      | "library"
      | "bookstore"
      | "little_free_library"
      | null;
    const limit = parseInt(searchParams.get("limit") ?? "20", 10);

    const session = await db.query.sessions.findFirst({
      where: eq(sessions.id, sessionId),
    });

    if (!session?.lat || !session?.lng) {
      return NextResponse.json(
        { error: "Location not set. Complete onboarding first." },
        { status: 400 }
      );
    }

    const libraryRows = await db.query.sessionBooks.findMany({
      where: eq(sessionBooks.sessionId, sessionId),
      with: { book: true },
    });

    const libraryBooks = libraryRows.map((r) => ({
      book: bookToEnriched(r.book),
      userRating: r.userRating ?? undefined,
      dateRead: r.dateRead ?? undefined,
    }));

    const profile = buildTasteProfile(libraryBooks);
    const ownedIds = new Set(libraryRows.map((r) => r.bookId));

    const sessionCurators = await db.query.curators.findMany({
      where: eq(curators.sessionId, sessionId),
      with: {
        curatorBooks: { with: { book: true } },
      },
    });

    const candidateMap = new Map<string, ReturnType<typeof bookToEnriched>>();
    for (const c of sessionCurators) {
      for (const cb of c.curatorBooks) {
        if (!ownedIds.has(cb.bookId)) {
          candidateMap.set(cb.bookId, bookToEnriched(cb.book));
        }
      }
    }

    const topTags = [...profile.entries()]
      .filter(([k]) => !k.startsWith("author:"))
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(([tag]) => slugifyTag(tag));

    const token = session.hardcoverToken ?? process.env.HARDCOVER_API_TOKEN;
    if (token) {
      for (const tagSlug of topTags) {
        try {
          const tagBooks = await getBooksByTag(tagSlug, 10, token);
          for (const hb of tagBooks) {
            const bookId = await upsertBookFromImport(hb, token);
            if (!ownedIds.has(bookId)) {
              const enriched = await getBookById(bookId);
              if (enriched) candidateMap.set(bookId, enriched);
            }
          }
        } catch {
          /* skip tag on error */
        }
      }
    }

    const places = await getPlacesForSession(sessionId, session.lat, session.lng);

    const scored = scoreRecommendations(
      [...candidateMap.values()],
      profile,
      places,
      ownedIds,
      {
        maxWalkMinutes: maxWalk,
        placeType: placeType ?? undefined,
      }
    ).slice(0, limit);

    const response: ScoredRecommendation[] = scored;

    return NextResponse.json({
      recommendations: response.map((r) => ({
        book: r.book,
        tasteScore: Math.round(r.tasteScore * 100) / 100,
        walkScore: Math.round(r.walkScore * 100) / 100,
        finalScore: Math.round(r.finalScore * 100) / 100,
        nearestPlace: r.nearestPlace,
      })),
      libraryCount: libraryRows.length,
      candidateCount: candidateMap.size,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Recommendation failed";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
