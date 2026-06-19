import { relations } from "drizzle-orm";
import { sqliteTable, text, integer, real, primaryKey } from "drizzle-orm/sqlite-core";

export const sessions = sqliteTable("sessions", {
  id: text("id").primaryKey(),
  lat: real("lat"),
  lng: real("lng"),
  address: text("address"),
  hardcoverToken: text("hardcover_token"),
  createdAt: integer("created_at", { mode: "timestamp" }).notNull(),
});

export const books = sqliteTable("books", {
  id: text("id").primaryKey(),
  title: text("title").notNull(),
  author: text("author").notNull(),
  isbn13: text("isbn13"),
  coverUrl: text("cover_url"),
  description: text("description"),
  tagsJson: text("tags_json"),
  subjectsJson: text("subjects_json"),
  hardcoverSlug: text("hardcover_slug"),
  ratingAvg: real("rating_avg"),
  createdAt: integer("created_at", { mode: "timestamp" }).notNull(),
});

export const sessionBooks = sqliteTable(
  "session_books",
  {
    sessionId: text("session_id")
      .notNull()
      .references(() => sessions.id, { onDelete: "cascade" }),
    bookId: text("book_id")
      .notNull()
      .references(() => books.id, { onDelete: "cascade" }),
    shelf: text("shelf").notNull(),
    userRating: real("user_rating"),
    dateRead: text("date_read"),
    source: text("source").notNull().default("import"),
  },
  (t) => [primaryKey({ columns: [t.sessionId, t.bookId] })]
);

export const curators = sqliteTable("curators", {
  id: text("id").primaryKey(),
  sessionId: text("session_id")
    .notNull()
    .references(() => sessions.id, { onDelete: "cascade" }),
  name: text("name").notNull(),
  platform: text("platform").notNull(),
  profileUrl: text("profile_url"),
  rssUrl: text("rss_url"),
  shelf: text("shelf").default("read"),
  externalId: text("external_id"),
  lastSyncedAt: integer("last_synced_at", { mode: "timestamp" }),
  createdAt: integer("created_at", { mode: "timestamp" }).notNull(),
});

export const curatorBooks = sqliteTable(
  "curator_books",
  {
    curatorId: text("curator_id")
      .notNull()
      .references(() => curators.id, { onDelete: "cascade" }),
    bookId: text("book_id")
      .notNull()
      .references(() => books.id, { onDelete: "cascade" }),
    addedAt: integer("added_at", { mode: "timestamp" }),
  },
  (t) => [primaryKey({ columns: [t.curatorId, t.bookId] })]
);

export const geoPlacesCache = sqliteTable("geo_places_cache", {
  sessionId: text("session_id")
    .primaryKey()
    .references(() => sessions.id, { onDelete: "cascade" }),
  placesJson: text("places_json").notNull(),
  cachedAt: integer("cached_at", { mode: "timestamp" }).notNull(),
});

export const apiCache = sqliteTable("api_cache", {
  key: text("key").primaryKey(),
  value: text("value").notNull(),
  expiresAt: integer("expires_at", { mode: "timestamp" }).notNull(),
});

export type BookTags = {
  Genre?: string[];
  Mood?: string[];
  Tag?: string[];
  "Content Warning"?: string[];
  [key: string]: string[] | undefined;
};

export type BookRecord = typeof books.$inferSelect;
export type SessionRecord = typeof sessions.$inferSelect;
export type CuratorRecord = typeof curators.$inferSelect;

export const sessionsRelations = relations(sessions, ({ many }) => ({
  sessionBooks: many(sessionBooks),
  curators: many(curators),
}));

export const booksRelations = relations(books, ({ many }) => ({
  sessionBooks: many(sessionBooks),
  curatorBooks: many(curatorBooks),
}));

export const sessionBooksRelations = relations(sessionBooks, ({ one }) => ({
  session: one(sessions, {
    fields: [sessionBooks.sessionId],
    references: [sessions.id],
  }),
  book: one(books, {
    fields: [sessionBooks.bookId],
    references: [books.id],
  }),
}));

export const curatorsRelations = relations(curators, ({ one, many }) => ({
  session: one(sessions, {
    fields: [curators.sessionId],
    references: [sessions.id],
  }),
  curatorBooks: many(curatorBooks),
}));

export const curatorBooksRelations = relations(curatorBooks, ({ one }) => ({
  curator: one(curators, {
    fields: [curatorBooks.curatorId],
    references: [curators.id],
  }),
  book: one(books, {
    fields: [curatorBooks.bookId],
    references: [books.id],
  }),
}));
