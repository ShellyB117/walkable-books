const HARDCOVER_API = "https://api.hardcover.app/v1/graphql";

type GraphQLResponse<T> = {
  data?: T;
  errors?: { message: string }[];
};

async function hardcoverQuery<T>(
  query: string,
  variables?: Record<string, unknown>,
  token?: string
): Promise<T> {
  const apiToken = token || process.env.HARDCOVER_API_TOKEN;
  if (!apiToken) {
    throw new Error("Hardcover API token not configured");
  }

  const res = await fetch(HARDCOVER_API, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiToken}`,
    },
    body: JSON.stringify({ query, variables }),
    next: { revalidate: 3600 },
  });

  if (!res.ok) {
    throw new Error(`Hardcover API error: ${res.status}`);
  }

  const json = (await res.json()) as GraphQLResponse<T>;
  if (json.errors?.length) {
    throw new Error(json.errors[0].message);
  }
  if (!json.data) {
    throw new Error("No data from Hardcover");
  }
  return json.data;
}

export type HardcoverBook = {
  id: number;
  slug: string;
  title: string;
  description?: string;
  rating?: number;
  cachedTags?: Record<string, string[]>;
  cachedContributors?: { author?: { name: string } }[];
  image?: { url?: string };
  isbns?: string[];
};

export async function searchBookByTitleAuthor(
  title: string,
  author: string,
  token?: string
): Promise<HardcoverBook | null> {
  const data = await hardcoverQuery<{
    search: { results: string };
  }>(
    `query ($q: String!) {
      search(query: $q, query_type: "Book", per_page: 5, page: 1) {
        results
      }
    }`,
    { q: `${title} ${author}` },
    token
  );

  const results = JSON.parse(data.search.results) as HardcoverBook[];
  const normalizedTitle = title.toLowerCase();
  const normalizedAuthor = author.toLowerCase();

  const match =
    results.find(
      (b) =>
        b.title?.toLowerCase().includes(normalizedTitle.slice(0, 20)) &&
        b.cachedContributors?.some((c) =>
          c.author?.name?.toLowerCase().includes(normalizedAuthor.split(" ")[0])
        )
    ) ?? results[0];

  return match ?? null;
}

export async function getBookBySlug(
  slug: string,
  token?: string
): Promise<HardcoverBook | null> {
  const data = await hardcoverQuery<{
    books: HardcoverBook[];
  }>(
    `query ($slug: String!) {
      books(where: { slug: { _eq: $slug } }, limit: 1) {
        id
        slug
        title
        description
        rating
        cached_tags
        cached_contributors
        image { url }
      }
    }`,
    { slug },
    token
  );
  return data.books[0] ?? null;
}

export async function getBooksByTag(
  tagSlug: string,
  limit = 20,
  token?: string
): Promise<HardcoverBook[]> {
  const data = await hardcoverQuery<{
    tags: { taggings: { book: HardcoverBook }[] }[];
  }>(
    `query ($slug: String!, $limit: Int!) {
      tags(where: { slug: { _eq: $slug } }, limit: 1) {
        taggings(limit: $limit, order_by: { book: { users_read_count: desc } }) {
          book {
            id
            slug
            title
            description
            rating
            cached_tags
            cached_contributors
            image { url }
          }
        }
      }
    }`,
    { slug: tagSlug, limit },
    token
  );

  return data.tags[0]?.taggings.map((t) => t.book).filter(Boolean) ?? [];
}

export function slugifyTag(tag: string): string {
  return tag
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

export type HardcoverListInfo = {
  username: string;
  listSlug?: string;
};

export function parseHardcoverListUrl(input: string): HardcoverListInfo | null {
  const trimmed = input.trim();
  const listMatch = trimmed.match(/hardcover\.app\/@([\w-]+)\/lists\/([\w-]+)/i);
  if (listMatch) {
    return { username: listMatch[1], listSlug: listMatch[2] };
  }
  const userMatch = trimmed.match(/hardcover\.app\/@([\w-]+)/i);
  if (userMatch) {
    return { username: userMatch[1] };
  }
  if (trimmed.startsWith("@")) {
    return { username: trimmed.slice(1) };
  }
  return null;
}

export async function getPublicListBooks(
  listSlug: string,
  limit = 50,
  token?: string
): Promise<HardcoverBook[]> {
  const data = await hardcoverQuery<{
    lists: {
      list_books: { book: HardcoverBook }[];
    }[];
  }>(
    `query ($slug: String!, $limit: Int!) {
      lists(where: { slug: { _eq: $slug } }, limit: 1) {
        list_books(limit: $limit, order_by: { position: asc }) {
          book {
            id
            slug
            title
            description
            rating
            cached_tags
            cached_contributors
            image { url }
          }
        }
      }
    }`,
    { slug: listSlug, limit },
    token
  );

  return data.lists[0]?.list_books.map((lb) => lb.book).filter(Boolean) ?? [];
}

export function extractTagsFromHardcover(
  cachedTags?: Record<string, string[]>
): string[] {
  if (!cachedTags) return [];
  const all: string[] = [];
  for (const values of Object.values(cachedTags)) {
    if (Array.isArray(values)) all.push(...values);
  }
  return [...new Set(all)];
}

export function extractAuthorFromHardcover(book: HardcoverBook): string {
  return book.cachedContributors?.[0]?.author?.name ?? "Unknown Author";
}
