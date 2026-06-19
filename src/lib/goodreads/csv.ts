import Papa from "papaparse";

export type GoodreadsCsvRow = {
  title: string;
  author: string;
  isbn13?: string;
  isbn?: string;
  isbn10?: string;
  myRating?: string;
  averageRating?: string;
  bookshelves?: string;
  exclusiveShelf?: string;
  dateRead?: string;
  bookId?: string;
};

export type ParsedGoodreadsBook = {
  title: string;
  author: string;
  isbn13?: string;
  shelf: string;
  userRating?: number;
  dateRead?: string;
  goodreadsId?: string;
};

function normalizeIsbn(raw?: string): string | undefined {
  if (!raw) return undefined;
  const digits = raw.replace(/[^0-9Xx]/g, "");
  if (digits.length === 13) return digits;
  if (digits.length === 10) return digits;
  return digits.length > 0 ? digits : undefined;
}

function pickShelf(row: Pick<GoodreadsCsvRow, "bookshelves" | "exclusiveShelf">): string {
  if (row.exclusiveShelf?.trim()) return row.exclusiveShelf.trim();
  const shelves = row.bookshelves?.split(",").map((s) => s.trim()).filter(Boolean);
  if (shelves?.length) return shelves[0];
  return "read";
}

export function parseGoodreadsCsv(csvText: string): ParsedGoodreadsBook[] {
  const result = Papa.parse<Record<string, string>>(csvText, {
    header: true,
    skipEmptyLines: true,
  });

  if (result.errors.length > 0) {
    throw new Error(`CSV parse error: ${result.errors[0].message}`);
  }

  return result.data
    .map((row): ParsedGoodreadsBook | null => {
      const title = row["Title"]?.trim();
      const author =
        row["Author"]?.trim() ||
        row["Author l-f"]?.trim() ||
        row["Additional Authors"]?.trim();
      if (!title || !author) return null;

      const isbn13 =
        normalizeIsbn(row["ISBN13"]) ||
        normalizeIsbn(row["ISBN"]) ||
        normalizeIsbn(row["ISBN10"]);

      const rating = parseFloat(row["My Rating"] || "0");

      return {
        title,
        author,
        isbn13,
        shelf: pickShelf({
          bookshelves: row["Bookshelves"],
          exclusiveShelf: row["Exclusive Shelf"],
        }),
        userRating: rating > 0 ? rating : undefined,
        dateRead: row["Date Read"]?.trim() || undefined,
        goodreadsId: row["Book Id"]?.trim(),
      };
    })
    .filter((b): b is ParsedGoodreadsBook => b !== null);
}
