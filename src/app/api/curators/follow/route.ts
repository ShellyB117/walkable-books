export const runtime = "nodejs";

import { NextRequest, NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { db, initDb } from "@/lib/db";
import { curators, sessions } from "@/lib/db/schema";
import {
  followGoodreadsCurator,
  followHardcoverCurator,
} from "@/lib/curators/sync";
import { getOrCreateSessionId } from "@/lib/session";

export async function POST(request: NextRequest) {
  try {
    initDb();
    const sessionId = await getOrCreateSessionId();
    const body = (await request.json()) as {
      platform: "goodreads" | "hardcover";
      url: string;
      hardcoverToken?: string;
    };

    if (!body.url?.trim()) {
      return NextResponse.json({ error: "URL is required" }, { status: 400 });
    }

    const session = await db.query.sessions.findFirst({
      where: eq(sessions.id, sessionId),
    });
    const token = body.hardcoverToken || session?.hardcoverToken || undefined;

    const result =
      body.platform === "hardcover"
        ? await followHardcoverCurator(sessionId, body.url, token ?? undefined)
        : await followGoodreadsCurator(sessionId, body.url, token ?? undefined);

    return NextResponse.json(result);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed to follow curator";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function GET() {
  initDb();
  const sessionId = await getOrCreateSessionId();

  const curatorsList = await db.query.curators.findMany({
    where: eq(curators.sessionId, sessionId),
    with: {
      curatorBooks: {
        with: { book: true },
      },
    },
  });

  return NextResponse.json({
    curators: curatorsList.map((c) => ({
      id: c.id,
      name: c.name,
      platform: c.platform,
      profileUrl: c.profileUrl,
      shelf: c.shelf,
      bookCount: c.curatorBooks.length,
      lastSyncedAt: c.lastSyncedAt,
      recentBooks: c.curatorBooks.slice(0, 5).map((cb) => ({
        id: cb.book.id,
        title: cb.book.title,
        author: cb.book.author,
        coverUrl: cb.book.coverUrl,
      })),
    })),
  });
}
