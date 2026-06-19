import { v4 as uuidv4 } from "uuid";
import { eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { books, type BookTags } from "@/lib/db/schema";
import type { ParsedGoodreadsBook } from "@/lib/goodreads/csv";
import type { GoodreadsRssBook } from "@/lib/goodreads/rss";
import {
  extractAuthorFromHardcover,
  extractTagsFromHardcover,
  searchBookByTitleAuthor,
  type HardcoverBook,
} from "@/lib/hardcover/client";
import { lookupByIsbn, searchByTitleAuthor } from "@/lib/openlibrary/client";

export type EnrichedBook = {
  id: string;
  title: string;
  author: string;
  isbn13?: string;
  coverUrl?: string;
  description?: string;
  tags: string[];
  tagsByCategory: BookTags;
  subjects: string[];
  hardcoverSlug?: string;
  ratingAvg?: number;
};

function parseTagsJson(raw?: string | null): { tags: string[]; tagsByCategory: BookTags } {
  if (!raw) return { tags: [], tagsByCategory: {} };
  try {
    const parsed = JSON.parse(raw) as BookTags;
    const tags: string[] = [];
    for (const values of Object.values(parsed)) {
      if (Array.isArray(values)) tags.push(...values);
    }
    return { tags: [...new Set(tags)], tagsByCategory: parsed };
  } catch {
    return { tags: [], tagsByCategory: {} };
  }
}

export function bookToEnriched(record: typeof books.$inferSelect): EnrichedBook {
  const { tags, tagsByCategory } = parseTagsJson(record.tagsJson);
  const subjects = record.subjectsJson ? (JSON.parse(record.subjectsJson) as string[]) : [];
  return {
    id: record.id,
    title: record.title,
    author: record.author,
    isbn13: record.isbn13 ?? undefined,
    coverUrl: record.coverUrl ?? undefined,
    description: record.description ?? undefined,
    tags,
    tagsByCategory,
    subjects,
    hardcoverSlug: record.hardcoverSlug ?? undefined,
    ratingAvg: record.ratingAvg ?? undefined,
  };
}

async function enrichWithApis(
  title: string,
  author: string,
  isbn13?: string,
  hardcoverToken?: string
): Promise<Partial<EnrichedBook>> {
  let enrichment: Partial<EnrichedBook> = {};

  if (process.env.HARDCOVER_API_TOKEN || hardcoverToken) {
    try {
      const hc = await searchBookByTitleAuthor(title, author, hardcoverToken);
      if (hc) {
        enrichment = {
          ...enrichment,
          hardcoverSlug: hc.slug,
          description: hc.description,
          ratingAvg: hc.rating,
          coverUrl: hc.image?.url,
          tags: extractTagsFromHardcover(hc.cachedTags),
          tagsByCategory: (hc.cachedTags ?? {}) as BookTags,
        };
      }
    } catch {
      /* fallback to Open Library */
    }
  }

  if (!enrichment.coverUrl || !enrichment.tags?.length) {
    const ol = isbn13
      ? await lookupByIsbn(isbn13)
      : await searchByTitleAuthor(title, author);
    if (ol) {
      enrichment = {
        ...enrichment,
        coverUrl: enrichment.coverUrl ?? ol.coverUrl,
        description: enrichment.description ?? ol.description,
        isbn13: enrichment.isbn13 ?? ol.isbn13,
        subjects: ol.subjects ?? [],
        tags: enrichment.tags?.length
          ? enrichment.tags
          : (ol.subjects?.slice(0, 8) ?? []),
      };
    }
  }

  return enrichment;
}

export async function upsertBookFromImport(
  input: ParsedGoodreadsBook | GoodreadsRssBook | HardcoverBook,
  hardcoverToken?: string,
  existingId?: string
): Promise<string> {
  let title: string;
  let author: string;
  let isbn13: string | undefined;
  let coverUrl: string | undefined;

  if ("author" in input) {
    title = input.title;
    author = input.author;
    isbn13 = "isbn13" in input ? input.isbn13 : undefined;
    coverUrl = "coverUrl" in input ? input.coverUrl : undefined;
  } else {
    title = input.title;
    author = extractAuthorFromHardcover(input);
    coverUrl = input.image?.url;
  }

  const existing = existingId
    ? await db.query.books.findFirst({ where: eq(books.id, existingId) })
    : isbn13
      ? await db.query.books.findFirst({ where: eq(books.isbn13, isbn13) })
      : await db.query.books.findFirst({
          where: eq(books.title, title),
        });

  if (existing?.tagsJson && existing.coverUrl) {
    return existing.id;
  }

  const enrichment = await enrichWithApis(title, author, isbn13, hardcoverToken);
  const id = existing?.id ?? uuidv4();

  const tagsByCategory: BookTags = enrichment.tagsByCategory ?? {};
  if (!Object.keys(tagsByCategory).length && enrichment.tags?.length) {
    tagsByCategory.Tag = enrichment.tags;
  }

  await db
    .insert(books)
    .values({
      id,
      title,
      author,
      isbn13: enrichment.isbn13 ?? isbn13 ?? existing?.isbn13,
      coverUrl: enrichment.coverUrl ?? coverUrl ?? existing?.coverUrl,
      description: enrichment.description ?? existing?.description,
      tagsJson: JSON.stringify(tagsByCategory),
      subjectsJson: JSON.stringify(enrichment.subjects ?? []),
      hardcoverSlug: enrichment.hardcoverSlug ?? existing?.hardcoverSlug,
      ratingAvg: enrichment.ratingAvg ?? existing?.ratingAvg,
      createdAt: existing?.createdAt ?? new Date(),
    })
    .onConflictDoUpdate({
      target: books.id,
      set: {
        coverUrl: enrichment.coverUrl ?? coverUrl ?? existing?.coverUrl,
        description: enrichment.description ?? existing?.description,
        tagsJson: JSON.stringify(tagsByCategory),
        subjectsJson: JSON.stringify(enrichment.subjects ?? []),
        hardcoverSlug: enrichment.hardcoverSlug ?? existing?.hardcoverSlug,
        ratingAvg: enrichment.ratingAvg ?? existing?.ratingAvg,
        isbn13: enrichment.isbn13 ?? isbn13 ?? existing?.isbn13,
      },
    });

  return id;
}

export async function getBookById(id: string): Promise<EnrichedBook | null> {
  const record = await db.query.books.findFirst({ where: eq(books.id, id) });
  if (!record) return null;
  return bookToEnriched(record);
}
