import Link from "next/link";
import type { EnrichedBook } from "@/lib/books/service";
import type { BookPlace } from "@/lib/geo/overpass";
import { TagPills } from "./TagPills";

type BookCardProps = {
  book: EnrichedBook;
  nearestPlace?: BookPlace;
  score?: number;
  compact?: boolean;
};

export function BookCard({ book, nearestPlace, score, compact }: BookCardProps) {
  return (
    <Link
      href={`/book/${book.id}`}
      className="group block shrink-0 w-44 sm:w-52 rounded-xl border-2 border-teal-900/40 bg-teal-950/40 overflow-hidden hover:border-amber-300/60 hover:-translate-y-1 transition-all duration-200 shadow-lg"
    >
      <div className="aspect-[2/3] bg-teal-900/50 relative overflow-hidden">
        {book.coverUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={book.coverUrl}
            alt={book.title}
            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center text-4xl opacity-40">
            📖
          </div>
        )}
        {score != null && (
          <span className="absolute top-2 right-2 text-xs bg-amber-300 text-teal-950 font-bold px-2 py-0.5 rounded-md">
            {Math.round(score * 100)}%
          </span>
        )}
      </div>
      <div className="p-3">
        <h3 className="font-semibold text-sm text-white line-clamp-2 leading-snug">
          {book.title}
        </h3>
        <p className="text-teal-200/70 text-xs mt-1 line-clamp-1">{book.author}</p>
        {!compact && book.tags.length > 0 && (
          <div className="mt-2">
            <TagPills tags={book.tags.slice(0, 2)} size="sm" />
          </div>
        )}
        {nearestPlace && (
          <p className="mt-2 text-xs text-amber-200/90 flex items-center gap-1">
            <span>🚶</span>
            {nearestPlace.walkMinutes ?? "?"} min · {nearestPlace.name}
          </p>
        )}
      </div>
    </Link>
  );
}
