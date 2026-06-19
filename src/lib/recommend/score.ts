import type { EnrichedBook } from "../books/service";
import type { BookPlace } from "../geo/overpass";

export type ScoredRecommendation = {
  book: EnrichedBook;
  tasteScore: number;
  walkScore: number;
  finalScore: number;
  nearestPlace?: BookPlace;
};

export type TasteProfile = Map<string, number>;

export function buildTasteProfile(
  libraryBooks: { book: EnrichedBook; userRating?: number; dateRead?: string }[]
): TasteProfile {
  const profile = new Map<string, number>();

  for (const { book, userRating, dateRead } of libraryBooks) {
    const ratingWeight = userRating ? userRating / 5 : 0.6;
    let recencyWeight = 1;
    if (dateRead) {
      const yearsAgo =
        (Date.now() - new Date(dateRead).getTime()) / (365.25 * 24 * 3600 * 1000);
      recencyWeight = Math.max(0.3, 1 - yearsAgo * 0.1);
    }

    const weight = ratingWeight * recencyWeight;
    const allTags = [...book.tags, ...book.subjects.map((s) => s.toLowerCase())];

    for (const tag of allTags) {
      const key = tag.toLowerCase().trim();
      if (!key) continue;
      profile.set(key, (profile.get(key) ?? 0) + weight);
    }

    const authorKey = `author:${book.author.toLowerCase()}`;
    profile.set(authorKey, (profile.get(authorKey) ?? 0) + weight * 0.5);
  }

  return profile;
}

export function tasteOverlap(profile: TasteProfile, book: EnrichedBook): number {
  if (profile.size === 0) return 0.5;

  const bookTags = [
    ...book.tags.map((t) => t.toLowerCase()),
    ...book.subjects.map((s) => s.toLowerCase()),
    `author:${book.author.toLowerCase()}`,
  ];

  let dot = 0;
  let profileNorm = 0;
  let bookNorm = 0;

  for (const [, weight] of profile) {
    profileNorm += weight * weight;
  }

  const bookTagSet = new Map<string, number>();
  for (const tag of bookTags) {
    bookTagSet.set(tag, (bookTagSet.get(tag) ?? 0) + 1);
  }

  for (const [tag, weight] of bookTagSet) {
    bookNorm += weight * weight;
    const profileWeight = profile.get(tag) ?? 0;
    dot += profileWeight * weight;
  }

  if (profileNorm === 0 || bookNorm === 0) return 0;
  return dot / (Math.sqrt(profileNorm) * Math.sqrt(bookNorm));
}

export function walkScoreFromMinutes(minutes?: number): number {
  if (minutes == null) return 0.2;
  if (minutes <= 5) return 1;
  if (minutes <= 10) return 0.85;
  if (minutes <= 15) return 0.65;
  if (minutes <= 20) return 0.4;
  return 0.15;
}

export function scoreRecommendations(
  candidates: EnrichedBook[],
  profile: TasteProfile,
  places: BookPlace[],
  ownedBookIds: Set<string>,
  filters?: {
    maxWalkMinutes?: number;
    placeType?: BookPlace["type"];
  }
): ScoredRecommendation[] {
  const filteredPlaces = filters?.placeType
    ? places.filter((p) => p.type === filters.placeType)
    : places;

  const results: ScoredRecommendation[] = [];

  for (const book of candidates) {
    if (ownedBookIds.has(book.id)) continue;

    const taste = tasteOverlap(profile, book);
    const nearest = filteredPlaces.length
      ? [...filteredPlaces].sort(
          (a, b) => (a.walkMinutes ?? 999) - (b.walkMinutes ?? 999)
        )[0]
      : undefined;

    if (
      filters?.maxWalkMinutes &&
      nearest?.walkMinutes != null &&
      nearest.walkMinutes > filters.maxWalkMinutes
    ) {
      continue;
    }

    const walk = walkScoreFromMinutes(nearest?.walkMinutes);
    const finalScore = 0.7 * taste + 0.3 * walk;

    results.push({
      book,
      tasteScore: taste,
      walkScore: walk,
      finalScore,
      nearestPlace: nearest,
    });
  }

  return results.sort((a, b) => b.finalScore - a.finalScore);
}

export function findSimilarBooks(
  target: EnrichedBook,
  pool: EnrichedBook[],
  excludeIds: Set<string>,
  limit = 8
): EnrichedBook[] {
  const targetTags = new Set([
    ...target.tags.map((t) => t.toLowerCase()),
    ...target.subjects.map((s) => s.toLowerCase()),
  ]);

  const scored = pool
    .filter((b) => b.id !== target.id && !excludeIds.has(b.id))
    .map((book) => {
      const bookTags = [
        ...book.tags.map((t) => t.toLowerCase()),
        ...book.subjects.map((s) => s.toLowerCase()),
      ];
      let shared = 0;
      for (const tag of bookTags) {
        if (targetTags.has(tag)) shared++;
      }
      const authorBonus =
        book.author.toLowerCase() === target.author.toLowerCase() ? 2 : 0;
      return { book, score: shared + authorBonus };
    })
    .filter((s) => s.score > 0)
    .sort((a, b) => b.score - a.score);

  return scored.slice(0, limit).map((s) => s.book);
}
