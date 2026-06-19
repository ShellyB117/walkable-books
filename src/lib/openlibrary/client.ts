export type OpenLibraryBook = {
  title: string;
  authors?: string[];
  coverUrl?: string;
  description?: string;
  subjects?: string[];
  isbn13?: string;
  openLibraryKey?: string;
};

export async function lookupByIsbn(isbn: string): Promise<OpenLibraryBook | null> {
  const clean = isbn.replace(/[^0-9Xx]/g, "");
  const res = await fetch(
    `https://openlibrary.org/isbn/${clean}.json`,
    { next: { revalidate: 86400 } }
  );
  if (!res.ok) return null;

  const edition = (await res.json()) as {
    title?: string;
    authors?: { key: string }[];
    covers?: number[];
    works?: { key: string }[];
    isbn_13?: string[];
  };

  let description: string | undefined;
  let subjects: string[] | undefined;

  if (edition.works?.[0]?.key) {
    const workRes = await fetch(
      `https://openlibrary.org${edition.works[0].key}.json`,
      { next: { revalidate: 86400 } }
    );
    if (workRes.ok) {
      const work = (await workRes.json()) as {
        description?: string | { value?: string };
        subjects?: string[];
      };
      if (typeof work.description === "string") {
        description = work.description;
      } else if (work.description?.value) {
        description = work.description.value;
      }
      subjects = work.subjects?.slice(0, 15);
    }
  }

  const authorNames: string[] = [];
  for (const author of edition.authors ?? []) {
    const authorRes = await fetch(
      `https://openlibrary.org${author.key}.json`,
      { next: { revalidate: 86400 } }
    );
    if (authorRes.ok) {
      const authorData = (await authorRes.json()) as { name?: string };
      if (authorData.name) authorNames.push(authorData.name);
    }
  }

  const coverId = edition.covers?.[0];
  return {
    title: edition.title ?? "Unknown Title",
    authors: authorNames.length ? authorNames : undefined,
    coverUrl: coverId
      ? `https://covers.openlibrary.org/b/id/${coverId}-M.jpg`
      : undefined,
    description,
    subjects,
    isbn13: edition.isbn_13?.[0] ?? clean,
    openLibraryKey: edition.works?.[0]?.key,
  };
}

export async function searchByTitleAuthor(
  title: string,
  author: string
): Promise<OpenLibraryBook | null> {
  const q = encodeURIComponent(`${title} ${author}`);
  const res = await fetch(
    `https://openlibrary.org/search.json?q=${q}&limit=3`,
    { next: { revalidate: 86400 } }
  );
  if (!res.ok) return null;

  const data = (await res.json()) as {
    docs?: {
      title?: string;
      author_name?: string[];
      cover_i?: number;
      isbn?: string[];
      key?: string;
      subject?: string[];
    }[];
  };

  const doc = data.docs?.[0];
  if (!doc) return null;

  return {
    title: doc.title ?? title,
    authors: doc.author_name,
    coverUrl: doc.cover_i
      ? `https://covers.openlibrary.org/b/id/${doc.cover_i}-M.jpg`
      : undefined,
    subjects: doc.subject?.slice(0, 15),
    isbn13: doc.isbn?.find((i) => i.length === 13) ?? doc.isbn?.[0],
    openLibraryKey: doc.key,
  };
}

export function worldCatUrl(isbn?: string, title?: string): string {
  if (isbn) {
    return `https://search.worldcat.org/search?q=isbn:${encodeURIComponent(isbn)}`;
  }
  return `https://search.worldcat.org/search?q=${encodeURIComponent(title ?? "")}`;
}
