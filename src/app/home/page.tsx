"use client";

import { useEffect, useState } from "react";
import { NavBar } from "@/components/NavBar";
import { BookCard } from "@/components/BookCard";
import { WalkMap } from "@/components/WalkMap";
import type { EnrichedBook } from "@/lib/books/service";
import type { BookPlace } from "@/lib/geo/overpass";

type Recommendation = {
  book: EnrichedBook;
  finalScore: number;
  nearestPlace?: BookPlace;
};

export default function HomePage() {
  const [recommendations, setRecommendations] = useState<Recommendation[]>([]);
  const [places, setPlaces] = useState<BookPlace[]>([]);
  const [origin, setOrigin] = useState<{ lat: number; lng: number; address?: string } | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [maxWalk, setMaxWalk] = useState<number | undefined>();
  const [placeType, setPlaceType] = useState<string | undefined>();
  const [showMap, setShowMap] = useState(false);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      setLoading(true);
      setError(null);
      try {
        const params = new URLSearchParams();
        if (maxWalk) params.set("maxWalk", String(maxWalk));
        if (placeType) params.set("placeType", placeType);

        const [recRes, geoRes, sessionRes] = await Promise.all([
          fetch(`/api/recommend?${params}`),
          fetch(`/api/geo/nearby${placeType ? `?type=${placeType}` : ""}`),
          fetch("/api/session"),
        ]);

        const recData = await recRes.json();
        const geoData = await geoRes.json();
        const sessionData = await sessionRes.json();

        if (cancelled) return;
        if (!recRes.ok) throw new Error(recData.error);
        if (!geoRes.ok) throw new Error(geoData.error);

        setRecommendations(recData.recommendations ?? []);
        setPlaces(geoData.places ?? []);
        setOrigin(geoData.origin ?? null);

        if (!sessionData.hasLocation) {
          setError("Set your location in Setup to get recommendations.");
        }
      } catch (e) {
        if (!cancelled) {
          setError(e instanceof Error ? e.message : "Failed to load");
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    void load();
    return () => {
      cancelled = true;
    };
  }, [maxWalk, placeType]);

  return (
    <div className="min-h-screen">
      <NavBar />
      <main className="max-w-6xl mx-auto px-4 py-6">
        <div className="flex flex-wrap items-center justify-between gap-4 mb-6">
          <div>
            <h1 className="font-display text-2xl sm:text-3xl text-white">
              Books you can walk to
            </h1>
            {origin?.address && (
              <p className="text-teal-200/60 text-sm mt-1">📍 {origin.address}</p>
            )}
          </div>
          {origin && (
            <button
              type="button"
              onClick={() => setShowMap((v) => !v)}
              className="btn-secondary text-sm"
            >
              {showMap ? "Hide map" : "Show map"}
            </button>
          )}
        </div>

        <div className="flex flex-wrap gap-2 mb-6">
          <button
            type="button"
            onClick={() => setMaxWalk(maxWalk === 10 ? undefined : 10)}
            className={`chip ${maxWalk === 10 ? "chip-active" : "chip-inactive"}`}
          >
            ≤10 min walk
          </button>
          {(["library", "bookstore", "little_free_library"] as const).map((t) => (
            <button
              key={t}
              type="button"
              onClick={() => setPlaceType(placeType === t ? undefined : t)}
              className={`chip ${placeType === t ? "chip-active" : "chip-inactive"}`}
            >
              {t === "little_free_library" ? "Little Free Library" : t + "s"}
            </button>
          ))}
        </div>

        {showMap && origin && (
          <div className="mb-8">
            <WalkMap originLat={origin.lat} originLng={origin.lng} places={places} />
          </div>
        )}

        {loading && (
          <p className="text-teal-200/60 text-center py-12 animate-pulse">Finding walkable reads…</p>
        )}

        {error && !loading && (
          <div className="card p-6 text-center">
            <p className="text-amber-200 mb-4">{error}</p>
            <a href="/onboarding" className="btn-primary">
              Complete setup
            </a>
          </div>
        )}

        {!loading && !error && recommendations.length === 0 && (
          <div className="card p-8 text-center">
            <p className="text-teal-200/70 mb-4">
              No recommendations yet. Import your library and follow some curators.
            </p>
            <a href="/onboarding" className="btn-primary">
              Get started
            </a>
          </div>
        )}

        {!loading && recommendations.length > 0 && (
          <div className="flex gap-4 overflow-x-auto pb-4 snap-x snap-mandatory">
            {recommendations.map((rec) => (
              <div key={rec.book.id} className="snap-start">
                <BookCard
                  book={rec.book}
                  nearestPlace={rec.nearestPlace}
                  score={rec.finalScore}
                />
              </div>
            ))}
          </div>
        )}

        {places.length > 0 && (
          <section className="mt-10">
            <h2 className="font-display text-xl text-white mb-4">Nearby book places</h2>
            <ul className="grid gap-2 sm:grid-cols-2">
              {places.slice(0, 8).map((p) => (
                <li key={p.id} className="card px-4 py-3 flex justify-between items-center">
                  <div>
                    <p className="text-white font-medium text-sm">{p.name}</p>
                    <p className="text-teal-200/50 text-xs capitalize">{p.type.replace(/_/g, " ")}</p>
                  </div>
                  <span className="text-amber-200 text-sm font-semibold">
                    {p.walkMinutes ?? "?"} min
                  </span>
                </li>
              ))}
            </ul>
          </section>
        )}
      </main>
    </div>
  );
}
