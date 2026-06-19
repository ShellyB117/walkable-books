"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { NavBar } from "@/components/NavBar";
import { BookCard } from "@/components/BookCard";
import { TagPills } from "@/components/TagPills";
import { WalkMap } from "@/components/WalkMap";
import type { EnrichedBook } from "@/lib/books/service";
import type { BookPlace } from "@/lib/geo/overpass";
import { directionsUrl } from "@/lib/geo/routing";
import { worldCatUrl } from "@/lib/openlibrary/client";

export default function BookDetailPage() {
  const params = useParams();
  const id = params.id as string;
  const [book, setBook] = useState<EnrichedBook | null>(null);
  const [similar, setSimilar] = useState<EnrichedBook[]>([]);
  const [places, setPlaces] = useState<BookPlace[]>([]);
  const [origin, setOrigin] = useState<{ lat: number; lng: number } | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function load() {
      setLoading(true);
      try {
        const [similarRes, geoRes] = await Promise.all([
          fetch(`/api/books/${id}/similar`),
          fetch("/api/geo/nearby"),
        ]);
        const similarData = await similarRes.json();
        const geoData = await geoRes.json();

        if (!similarRes.ok) throw new Error(similarData.error);
        setBook(similarData.book);
        setSimilar(similarData.similar ?? []);

        if (geoRes.ok) {
          setPlaces(geoData.places ?? []);
          setOrigin(geoData.origin ?? null);
        }
      } catch (e) {
        setError(e instanceof Error ? e.message : "Failed to load book");
      } finally {
        setLoading(false);
      }
    }
    load();
  }, [id]);

  if (loading) {
    return (
      <div className="min-h-screen">
        <NavBar />
        <p className="text-center py-20 text-teal-200/60 animate-pulse">Loading…</p>
      </div>
    );
  }

  if (error || !book) {
    return (
      <div className="min-h-screen">
        <NavBar />
        <div className="card max-w-md mx-auto mt-20 p-6 text-center">
          <p className="text-red-300">{error ?? "Book not found"}</p>
          <Link href="/home" className="btn-secondary mt-4 inline-block">
            Back
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen">
      <NavBar />
      <main className="max-w-6xl mx-auto px-4 py-6">
        <Link href="/home" className="text-teal-300/60 text-sm hover:text-teal-200 mb-4 inline-block">
          ← Back to discover
        </Link>

        <div className="grid lg:grid-cols-2 gap-8">
          <div>
            <div className="flex gap-6">
              <div className="shrink-0 w-36 sm:w-44">
                {book.coverUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={book.coverUrl}
                    alt={book.title}
                    className="w-full rounded-xl shadow-lg border border-teal-800/40"
                  />
                ) : (
                  <div className="w-full aspect-[2/3] rounded-xl bg-teal-900/50 flex items-center justify-center text-5xl">
                    📖
                  </div>
                )}
              </div>
              <div>
                <h1 className="font-display text-2xl sm:text-3xl text-white leading-tight">
                  {book.title}
                </h1>
                <p className="text-teal-200/80 mt-2">{book.author}</p>
                {book.ratingAvg != null && (
                  <p className="text-amber-200 mt-2 text-sm">★ {book.ratingAvg.toFixed(1)}</p>
                )}
                {book.isbn13 && (
                  <a
                    href={worldCatUrl(book.isbn13, book.title)}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-block mt-3 text-xs text-amber-200/80 underline"
                  >
                    Check availability on WorldCat
                  </a>
                )}
              </div>
            </div>

            {book.description && (
              <p className="mt-6 text-teal-100/80 text-sm leading-relaxed line-clamp-6">
                {book.description.replace(/<[^>]+>/g, "")}
              </p>
            )}

            <div className="mt-6 space-y-4">
              {Object.entries(book.tagsByCategory).map(([category, tags]) =>
                tags && tags.length > 0 ? (
                  <TagPills key={category} category={category} tags={tags} />
                ) : null
              )}
              {book.tags.length > 0 && Object.keys(book.tagsByCategory).length === 0 && (
                <TagPills tags={book.tags} />
              )}
              {book.subjects.length > 0 && (
                <TagPills category="Subjects" tags={book.subjects.slice(0, 8)} />
              )}
            </div>

            {similar.length > 0 && (
              <section className="mt-10">
                <h2 className="font-display text-xl text-white mb-4">Similar books</h2>
                <div className="flex gap-3 overflow-x-auto pb-2">
                  {similar.map((b) => (
                    <BookCard key={b.id} book={b} compact />
                  ))}
                </div>
              </section>
            )}
          </div>

          <div>
            <h2 className="font-display text-xl text-white mb-4">Walk to it</h2>
            {origin && (
              <WalkMap
                originLat={origin.lat}
                originLng={origin.lng}
                places={places.slice(0, 10)}
                className="mb-4"
              />
            )}
            <ul className="space-y-2">
              {places.slice(0, 10).map((p, i) => (
                <li key={p.id} className="card px-4 py-3 flex items-center justify-between gap-3">
                  <div className="flex items-center gap-3 min-w-0">
                    <span className="shrink-0 w-6 h-6 rounded-full bg-amber-300 text-teal-950 text-xs font-bold flex items-center justify-center">
                      {i + 1}
                    </span>
                    <div className="min-w-0">
                      <p className="text-white text-sm font-medium truncate">{p.name}</p>
                      <p className="text-teal-200/50 text-xs capitalize">
                        {p.type.replace(/_/g, " ")} · {p.walkMinutes ?? "?"} min walk
                      </p>
                    </div>
                  </div>
                  {origin && (
                    <a
                      href={directionsUrl(origin.lat, origin.lng, p.lat, p.lng)}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="btn-secondary text-xs shrink-0 py-1.5 px-3"
                    >
                      Directions
                    </a>
                  )}
                </li>
              ))}
              {places.length === 0 && (
                <p className="text-teal-200/50 text-sm">
                  No nearby libraries or bookstores found. Try updating your location in Setup.
                </p>
              )}
            </ul>
          </div>
        </div>
      </main>
    </div>
  );
}
