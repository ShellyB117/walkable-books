export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { db, initDb } from "@/lib/db";
import { sessions } from "@/lib/db/schema";
import { getOrCreateSessionId } from "@/lib/session";

export async function GET() {
  initDb();
  const sessionId = await getOrCreateSessionId();
  const session = await db.query.sessions.findFirst({
    where: eq(sessions.id, sessionId),
  });

  return NextResponse.json({
    sessionId,
    hasLocation: !!(session?.lat && session?.lng),
    address: session?.address,
    lat: session?.lat,
    lng: session?.lng,
  });
}
