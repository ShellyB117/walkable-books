import Database from "better-sqlite3";
import { drizzle } from "drizzle-orm/better-sqlite3";
import fs from "fs";
import path from "path";
import * as schema from "./schema";

const dataDir = path.join(process.cwd(), "data");
const dbPath = path.join(dataDir, "walkable-books.db");

if (!fs.existsSync(dataDir)) {
  fs.mkdirSync(dataDir, { recursive: true });
}

const sqlite = new Database(dbPath);
sqlite.pragma("journal_mode = WAL");
sqlite.pragma("foreign_keys = ON");

export const db = drizzle(sqlite, { schema });

export function initDb() {
  sqlite.exec(`
    CREATE TABLE IF NOT EXISTS sessions (
      id TEXT PRIMARY KEY,
      lat REAL,
      lng REAL,
      address TEXT,
      hardcover_token TEXT,
      created_at INTEGER NOT NULL
    );
    CREATE TABLE IF NOT EXISTS books (
      id TEXT PRIMARY KEY,
      title TEXT NOT NULL,
      author TEXT NOT NULL,
      isbn13 TEXT,
      cover_url TEXT,
      description TEXT,
      tags_json TEXT,
      subjects_json TEXT,
      hardcover_slug TEXT,
      rating_avg REAL,
      created_at INTEGER NOT NULL
    );
    CREATE TABLE IF NOT EXISTS session_books (
      session_id TEXT NOT NULL REFERENCES sessions(id) ON DELETE CASCADE,
      book_id TEXT NOT NULL REFERENCES books(id) ON DELETE CASCADE,
      shelf TEXT NOT NULL,
      user_rating REAL,
      date_read TEXT,
      source TEXT NOT NULL DEFAULT 'import',
      PRIMARY KEY (session_id, book_id)
    );
    CREATE TABLE IF NOT EXISTS curators (
      id TEXT PRIMARY KEY,
      session_id TEXT NOT NULL REFERENCES sessions(id) ON DELETE CASCADE,
      name TEXT NOT NULL,
      platform TEXT NOT NULL,
      profile_url TEXT,
      rss_url TEXT,
      shelf TEXT DEFAULT 'read',
      external_id TEXT,
      last_synced_at INTEGER,
      created_at INTEGER NOT NULL
    );
    CREATE TABLE IF NOT EXISTS curator_books (
      curator_id TEXT NOT NULL REFERENCES curators(id) ON DELETE CASCADE,
      book_id TEXT NOT NULL REFERENCES books(id) ON DELETE CASCADE,
      added_at INTEGER,
      PRIMARY KEY (curator_id, book_id)
    );
    CREATE TABLE IF NOT EXISTS geo_places_cache (
      session_id TEXT PRIMARY KEY REFERENCES sessions(id) ON DELETE CASCADE,
      places_json TEXT NOT NULL,
      cached_at INTEGER NOT NULL
    );
    CREATE TABLE IF NOT EXISTS api_cache (
      key TEXT PRIMARY KEY,
      value TEXT NOT NULL,
      expires_at INTEGER NOT NULL
    );
  `);
}
