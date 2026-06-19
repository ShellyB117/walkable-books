import { XMLParser } from "fast-xml-parser";

export type GoodreadsRssBook = {
  title: string;
  author: string;
  link?: string;
  goodreadsId?: string;
  coverUrl?: string;
  userRating?: number;
  publishedAt?: Date;
};

export type GoodreadsProfileInfo = {
  userId: string;
  shelf: string;
  rssUrl: string;
  profileUrl: string;
};

export function parseGoodreadsProfileUrl(input: string): GoodreadsProfileInfo | null {
  const trimmed = input.trim();

  const rssMatch = trimmed.match(
    /goodreads\.com\/review\/list_rss\/(\d+)(?:[^?]*)?(?:\?.*shelf=([\w-]+))?/i
  );
  if (rssMatch) {
    const userId = rssMatch[1];
    const shelf = rssMatch[2] || "read";
    return {
      userId,
      shelf,
      rssUrl: `https://www.goodreads.com/review/list_rss/${userId}?shelf=${shelf}`,
      profileUrl: `https://www.goodreads.com/user/show/${userId}`,
    };
  }

  const listMatch = trimmed.match(
    /goodreads\.com\/review\/list\/(\d+)(?:-[\w-]+)?(?:\?.*shelf=([\w-]+))?/i
  );
  if (listMatch) {
    const userId = listMatch[1];
    const shelf = listMatch[2] || "read";
    return {
      userId,
      shelf,
      rssUrl: `https://www.goodreads.com/review/list_rss/${userId}?shelf=${shelf}`,
      profileUrl: `https://www.goodreads.com/user/show/${userId}`,
    };
  }

  const userMatch = trimmed.match(/goodreads\.com\/user\/show\/(\d+)/i);
  if (userMatch) {
    const userId = userMatch[1];
    const shelf = "read";
    return {
      userId,
      shelf,
      rssUrl: `https://www.goodreads.com/review/list_rss/${userId}?shelf=${shelf}`,
      profileUrl: `https://www.goodreads.com/user/show/${userId}`,
    };
  }

  if (/^\d+$/.test(trimmed)) {
    return {
      userId: trimmed,
      shelf: "read",
      rssUrl: `https://www.goodreads.com/review/list_rss/${trimmed}?shelf=read`,
      profileUrl: `https://www.goodreads.com/user/show/${trimmed}`,
    };
  }

  return null;
}

function extractAuthor(description?: string): string {
  if (!description) return "Unknown Author";
  const byMatch = description.match(/by\s+([^<]+)/i);
  if (byMatch) return byMatch[1].trim();
  return "Unknown Author";
}

function extractGoodreadsId(link?: string): string | undefined {
  if (!link) return undefined;
  const match = link.match(/\/book\/show\/(\d+)/);
  return match?.[1];
}

export async function fetchGoodreadsShelf(rssUrl: string): Promise<GoodreadsRssBook[]> {
  const res = await fetch(rssUrl, {
    headers: { "User-Agent": "WalkableBooks/1.0" },
    next: { revalidate: 3600 },
  });

  if (!res.ok) {
    throw new Error(`Failed to fetch Goodreads shelf (${res.status})`);
  }

  const xml = await res.text();
  const parser = new XMLParser({ ignoreAttributes: false });
  const parsed = parser.parse(xml);

  const items = parsed?.rss?.channel?.item;
  if (!items) return [];

  const itemList = Array.isArray(items) ? items : [items];

  return itemList.map((item: Record<string, unknown>) => {
    const title = String(item.title ?? "Unknown Title");
    const description = item.description ? String(item.description) : undefined;
    const link = item.link ? String(item.link) : undefined;
    const author = extractAuthor(description);
    const coverMatch = description?.match(/src="([^"]+)"/);
    const ratingMatch = description?.match(/rating:\s*(\d)/i);

    return {
      title,
      author,
      link,
      goodreadsId: extractGoodreadsId(link),
      coverUrl: coverMatch?.[1],
      userRating: ratingMatch ? parseInt(ratingMatch[1], 10) : undefined,
      publishedAt: item.pubDate ? new Date(String(item.pubDate)) : undefined,
    };
  });
}

export async function fetchCuratorDisplayName(
  profileUrl: string,
  userId: string
): Promise<string> {
  try {
    const res = await fetch(profileUrl, {
      headers: { "User-Agent": "WalkableBooks/1.0" },
      next: { revalidate: 86400 },
    });
    if (!res.ok) return `Goodreads User ${userId}`;
    const html = await res.text();
    const match = html.match(/<title>([^<]+)'s profile/i) || html.match(/<title>([^<]+)<\/title>/i);
    if (match) return match[1].trim();
  } catch {
    /* fallback */
  }
  return `Goodreads User ${userId}`;
}
