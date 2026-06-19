export const runtime = "nodejs";

import { NextRequest, NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { db, initDb } from "@/lib/db";
import { sessions } from "@/lib/db/schema";
import { getPlacesForSession } from "@/lib/geo/service";
import { geocodeAddress } from "@/lib/geo/routing";
import { getOrCreateSessionId } from "@/lib/session";

export async function GET(request: NextRequest) {
  try {
    initDb();
    const sessionId = await getOrCreateSessionId();
    const session = await db.query.sessions.findFirst({
      where: eq(sessions.id, sessionId),
    });

    if (!session?.lat || !session?.lng) {
      return NextResponse.json(
        { error: "Location not set" },
        { status: 400 }
      );
    }

    const { searchParams } = new URL(request.url);
    const typeFilter = searchParams.get("type");

    let places = await getPlacesForSession(sessionId, session.lat, session.lng);

    if (typeFilter) {
      places = places.filter((p) => p.type === typeFilter);
    }

    return NextResponse.json({
      origin: { lat: session.lat, lng: session.lng, address: session.address },
      places,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Geo lookup failed";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    initDb();
    const sessionId = await getOrCreateSessionId();
    const body = (await request.json()) as {
      lat?: number;
      lng?: number;
      address?: string;
      hardcoverToken?: string;
    };

    let lat = body.lat;
    let lng = body.lng;
    let address = body.address;

    if (address && (lat == null || lng == null)) {
      const geo = await geocodeAddress(address);
      lat = geo.lat;
      lng = geo.lng;
      address = geo.label;
    }

    if (lat == null || lng == null) {
      return NextResponse.json(
        { error: "Location or address required" },
        { status: 400 }
      );
    }

    const updates: Partial<typeof sessions.$inferInsert> = {
      lat,
      lng,
      address: address ?? null,
    };
    if (body.hardcoverToken) {
      updates.hardcoverToken = body.hardcoverToken;
    }

    await db.update(sessions).set(updates).where(eq(sessions.id, sessionId));

    const places = await getPlacesForSession(sessionId, lat, lng);

    return NextResponse.json({
      lat,
      lng,
      address,
      placesCount: places.length,
      places: places.slice(0, 10),
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed to save location";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
