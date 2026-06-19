export const runtime = "nodejs";

import { NextRequest, NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { db, initDb } from "@/lib/db";
import { sessions } from "@/lib/db/schema";
import { syncAllCuratorsForSession } from "@/lib/curators/sync";
import { cleanExpiredCache } from "@/lib/cache";
import { getOrCreateSessionId } from "@/lib/session";

/** Vercel cron — sync all sessions (requires CRON_SECRET when set) */
export async function GET(request: NextRequest) {
  const cronSecret = process.env.CRON_SECRET;
  if (cronSecret) {
    const authHeader = request.headers.get("authorization");
    if (authHeader !== `Bearer ${cronSecret}`) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
  }

  try {
    initDb();
    const allSessions = await db.query.sessions.findMany();
    let totalSynced = 0;
    let totalCurators = 0;

    for (const session of allSessions) {
      const token = session.hardcoverToken ?? process.env.HARDCOVER_API_TOKEN ?? undefined;
      const result = await syncAllCuratorsForSession(session.id, token);
      totalSynced += result.synced;
      totalCurators += result.curators;
    }

    const cleaned = await cleanExpiredCache();

    return NextResponse.json({
      synced: totalSynced,
      curators: totalCurators,
      sessions: allSessions.length,
      cacheEntriesCleaned: cleaned,
      syncedAt: new Date().toISOString(),
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Sync failed";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

/** Manual sync for current session (curators page button) */
export async function POST() {
  try {
    initDb();
    const sessionId = await getOrCreateSessionId();
    const session = await db.query.sessions.findFirst({
      where: eq(sessions.id, sessionId),
    });

    const token = session?.hardcoverToken ?? process.env.HARDCOVER_API_TOKEN ?? undefined;
    const result = await syncAllCuratorsForSession(sessionId, token);
    const cleaned = await cleanExpiredCache();

    return NextResponse.json({
      ...result,
      cacheEntriesCleaned: cleaned,
      syncedAt: new Date().toISOString(),
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Sync failed";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
