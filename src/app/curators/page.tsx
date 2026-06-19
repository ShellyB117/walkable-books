"use client";

import { useEffect, useState } from "react";
import { NavBar } from "@/components/NavBar";
import { CuratorShelf } from "@/components/CuratorShelf";

type CuratorData = {
  id: string;
  name: string;
  platform: string;
  profileUrl?: string | null;
  shelf?: string | null;
  bookCount: number;
  lastSyncedAt?: string | null;
  recentBooks: {
    id: string;
    title: string;
    author: string;
    coverUrl?: string | null;
  }[];
};

export default function CuratorsPage() {
  const [curators, setCurators] = useState<CuratorData[]>([]);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [newUrl, setNewUrl] = useState("");
  const [platform, setPlatform] = useState<"goodreads" | "hardcover">("goodreads");
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      setLoading(true);
      try {
        const res = await fetch("/api/curators/follow");
        const data = await res.json();
        if (!cancelled) setCurators(data.curators ?? []);
      } catch {
        if (!cancelled) setError("Failed to load curators");
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    void load();
    return () => {
      cancelled = true;
    };
  }, []);

  async function reloadCurators() {
    const res = await fetch("/api/curators/follow");
    const data = await res.json();
    setCurators(data.curators ?? []);
  }

  async function followNew() {
    if (!newUrl.trim()) return;
    setError(null);
    try {
      const res = await fetch("/api/curators/follow", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ platform, url: newUrl.trim() }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setNewUrl("");
      await reloadCurators();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to follow");
    }
  }

  async function syncAll() {
    setSyncing(true);
    try {
      await fetch("/api/cron/sync", { method: "POST" });
      await reloadCurators();
    } catch {
      setError("Sync failed");
    } finally {
      setSyncing(false);
    }
  }

  return (
    <div className="min-h-screen">
      <NavBar />
      <main className="max-w-3xl mx-auto px-4 py-6">
        <div className="flex flex-wrap items-center justify-between gap-4 mb-6">
          <h1 className="font-display text-2xl sm:text-3xl text-white">Curators</h1>
          <button
            type="button"
            onClick={syncAll}
            disabled={syncing}
            className="btn-secondary text-sm"
          >
            {syncing ? "Syncing…" : "Sync shelves"}
          </button>
        </div>

        <div className="card p-5 mb-8">
          <h2 className="font-display text-lg text-white mb-3">Follow a curator</h2>
          <div className="flex gap-2 mb-3">
            {(["goodreads", "hardcover"] as const).map((p) => (
              <button
                key={p}
                type="button"
                onClick={() => setPlatform(p)}
                className={`chip flex-1 ${platform === p ? "chip-active" : "chip-inactive"}`}
              >
                {p}
              </button>
            ))}
          </div>
          <input
            className="input mb-3"
            placeholder="Profile or list URL"
            value={newUrl}
            onChange={(e) => setNewUrl(e.target.value)}
          />
          <button type="button" onClick={followNew} className="btn-primary w-full">
            Follow
          </button>
          {error && <p className="text-red-300 text-sm mt-2">{error}</p>}
        </div>

        {loading && (
          <p className="text-teal-200/60 text-center py-8 animate-pulse">Loading…</p>
        )}

        {!loading && curators.length === 0 && (
          <div className="card p-8 text-center text-teal-200/60">
            No curators yet. Follow a Goodreads user or Hardcover list above.
          </div>
        )}

        <div className="space-y-6">
          {curators.map((c) => (
            <div key={c.id} id={c.id}>
              <CuratorShelf
                id={c.id}
                name={c.name}
                platform={c.platform}
                profileUrl={c.profileUrl}
                shelf={c.shelf}
                bookCount={c.bookCount}
                recentBooks={c.recentBooks}
              />
            </div>
          ))}
        </div>
      </main>
    </div>
  );
}
