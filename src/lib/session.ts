import { cookies } from "next/headers";
import { eq } from "drizzle-orm";
import { v4 as uuidv4 } from "uuid";
import { db, initDb } from "./db";
import { sessions } from "./db/schema";

const SESSION_COOKIE = "wb_session";

export async function getOrCreateSessionId(): Promise<string> {
  initDb();
  const cookieStore = await cookies();
  let sessionId = cookieStore.get(SESSION_COOKIE)?.value;

  if (sessionId) {
    const existing = await db.query.sessions.findFirst({
      where: eq(sessions.id, sessionId),
    });
    if (existing) return sessionId;
  }

  sessionId = uuidv4();
  await db.insert(sessions).values({
    id: sessionId,
    createdAt: new Date(),
  });

  cookieStore.set(SESSION_COOKIE, sessionId, {
    httpOnly: true,
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 60 * 24 * 365,
  });

  return sessionId;
}

export async function getSessionId(): Promise<string | null> {
  initDb();
  const cookieStore = await cookies();
  return cookieStore.get(SESSION_COOKIE)?.value ?? null;
}
