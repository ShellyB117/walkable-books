import Link from "next/link";
import { BookCard } from "./BookCard";

type CuratorShelfProps = {
  id: string;
  name: string;
  platform: string;
  profileUrl?: string | null;
  shelf?: string | null;
  bookCount: number;
  recentBooks: {
    id: string;
    title: string;
    author: string;
    coverUrl?: string | null;
  }[];
};

export function CuratorShelf({
  name,
  platform,
  profileUrl,
  shelf,
  bookCount,
  recentBooks,
}: CuratorShelfProps) {
  return (
    <div className="rounded-2xl border-2 border-teal-900/40 bg-teal-950/30 p-5">
      <div className="flex items-start justify-between gap-3 mb-4">
        <div>
          <h3 className="font-display text-lg text-white">{name}</h3>
          <p className="text-sm text-teal-200/60 mt-0.5">
            {platform} · {shelf ?? "read"} · {bookCount} books
          </p>
        </div>
        {profileUrl && (
          <a
            href={profileUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="text-xs text-amber-200/80 hover:text-amber-200 underline shrink-0"
          >
            View profile
          </a>
        )}
      </div>
      <div className="flex gap-3 overflow-x-auto pb-2">
        {recentBooks.length === 0 ? (
          <p className="text-teal-200/50 text-sm">No books synced yet.</p>
        ) : (
          recentBooks.map((book) => (
            <BookCard
              key={book.id}
              book={{
                id: book.id,
                title: book.title,
                author: book.author,
                coverUrl: book.coverUrl ?? undefined,
                tags: [],
                tagsByCategory: {},
                subjects: [],
              }}
              compact
            />
          ))
        )}
      </div>
    </div>
  );
}

export function CuratorShelfLink({ id, children }: { id: string; children: React.ReactNode }) {
  return (
    <Link href={`/curators#${id}`} className="block">
      {children}
    </Link>
  );
}
