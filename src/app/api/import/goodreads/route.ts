export const runtime = "nodejs";

import { NextRequest, NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { db, initDb } from "@/lib/db";
import { sessionBooks } from "@/lib/db/schema";
import { parseGoodreadsCsv } from "@/lib/goodreads/csv";
import { upsertBookFromImport } from "@/lib/books/service";
import { getOrCreateSessionId } from "@/lib/session";

export async function POST(request: NextRequest) {
  try {
    initDb();
    const sessionId = await getOrCreateSessionId();
    const formData = await request.formData();
    const file = formData.get("file") as File | null;

    if (!file) {
      return NextResponse.json({ error: "No file uploaded" }, { status: 400 });
    }

    const csvText = await file.text();
    const parsed = parseGoodreadsCsv(csvText);

    if (parsed.length === 0) {
      return NextResponse.json({ error: "No books found in CSV" }, { status: 400 });
    }

    let imported = 0;
    for (const row of parsed) {
      const bookId = await upsertBookFromImport(row);
      await db
        .insert(sessionBooks)
        .values({
          sessionId,
          bookId,
          shelf: row.shelf,
          userRating: row.userRating,
          dateRead: row.dateRead,
          source: "import",
        })
        .onConflictDoUpdate({
          target: [sessionBooks.sessionId, sessionBooks.bookId],
          set: {
            shelf: row.shelf,
            userRating: row.userRating,
            dateRead: row.dateRead,
          },
        });
      imported++;
    }

    return NextResponse.json({ imported, total: parsed.length });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Import failed";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function GET() {
  initDb();
  const sessionId = await getOrCreateSessionId();
  const rows = await db.query.sessionBooks.findMany({
    where: eq(sessionBooks.sessionId, sessionId),
    with: { book: true },
  });

  return NextResponse.json({
    count: rows.length,
    shelves: [...new Set(rows.map((r) => r.shelf))],
  });
}
