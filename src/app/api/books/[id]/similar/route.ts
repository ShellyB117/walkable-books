export const runtime = "nodejs";

import { NextRequest, NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { db, initDb } from "@/lib/db";
import { curators, sessionBooks } from "@/lib/db/schema";
import { getBookById, bookToEnriched } from "@/lib/books/service";
import { findSimilarBooks } from "@/lib/recommend/score";
import { getOrCreateSessionId } from "@/lib/session";

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    initDb();
    const { id } = await params;
    const sessionId = await getOrCreateSessionId();

    const book = await getBookById(id);
    if (!book) {
      return NextResponse.json({ error: "Book not found" }, { status: 404 });
    }

    const ownedRows = await db.query.sessionBooks.findMany({
      where: eq(sessionBooks.sessionId, sessionId),
    });
    const excludeIds = new Set(ownedRows.map((r) => r.bookId));

    const sessionCurators = await db.query.curators.findMany({
      where: eq(curators.sessionId, sessionId),
      with: {
        curatorBooks: { with: { book: true } },
      },
    });

    const pool: ReturnType<typeof bookToEnriched>[] = [];
    for (const c of sessionCurators) {
      for (const cb of c.curatorBooks) {
        pool.push(bookToEnriched(cb.book));
      }
    }

    const allBooks = await db.query.books.findMany({ limit: 200 });
    for (const b of allBooks) {
      if (b.id !== id) pool.push(bookToEnriched(b));
    }

    const uniquePool = [...new Map(pool.map((b) => [b.id, b])).values()];
    const similar = findSimilarBooks(book, uniquePool, excludeIds, 8);

    return NextResponse.json({ book, similar });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed to find similar books";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
