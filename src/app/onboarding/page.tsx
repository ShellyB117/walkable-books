"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { NavBar } from "@/components/NavBar";

type Step = "location" | "import" | "curators" | "done";

export default function OnboardingPage() {
  const router = useRouter();
  const [step, setStep] = useState<Step>("location");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [address, setAddress] = useState("");
  const [hardcoverToken, setHardcoverToken] = useState("");
  const [curatorUrl, setCuratorUrl] = useState("");
  const [curatorPlatform, setCuratorPlatform] = useState<"goodreads" | "hardcover">("goodreads");
  const [importCount, setImportCount] = useState(0);
  const [curatorCount, setCuratorCount] = useState(0);

  async function saveLocation(lat: number, lng: number, addr?: string) {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/geo/nearby", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          lat,
          lng,
          address: addr,
          hardcoverToken: hardcoverToken || undefined,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setStep("import");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to save location");
    } finally {
      setLoading(false);
    }
  }

  function useGeolocation() {
    setLoading(true);
    setError(null);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        saveLocation(pos.coords.latitude, pos.coords.longitude);
      },
      () => {
        setError("Could not get your location. Try entering an address.");
        setLoading(false);
      }
    );
  }

  async function saveAddress() {
    if (!address.trim()) {
      setError("Enter an address");
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/geo/nearby", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          address: address.trim(),
          hardcoverToken: hardcoverToken || undefined,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setStep("import");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Geocoding failed");
    } finally {
      setLoading(false);
    }
  }

  async function importCsv(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setLoading(true);
    setError(null);
    try {
      const form = new FormData();
      form.append("file", file);
      const res = await fetch("/api/import/goodreads", { method: "POST", body: form });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setImportCount(data.imported);
      setStep("curators");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Import failed");
    } finally {
      setLoading(false);
    }
  }

  async function followCurator() {
    if (!curatorUrl.trim()) {
      setStep("done");
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/curators/follow", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          platform: curatorPlatform,
          url: curatorUrl.trim(),
          hardcoverToken: hardcoverToken || undefined,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setCuratorCount((c) => c + 1);
      setCuratorUrl("");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to follow curator");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen">
      <NavBar />
      <main className="max-w-xl mx-auto px-4 py-10">
        <div className="mb-8">
          <div className="flex gap-2 mb-6">
            {(["location", "import", "curators", "done"] as Step[]).map((s, i) => (
              <div
                key={s}
                className={`h-1.5 flex-1 rounded-full ${
                  (["location", "import", "curators", "done"].indexOf(step) >= i
                    ? "bg-amber-300"
                    : "bg-teal-800/50")
                }`}
              />
            ))}
          </div>
        </div>

        {step === "location" && (
          <section className="card p-6">
            <h2 className="font-display text-2xl text-white mb-2">Where are you?</h2>
            <p className="text-teal-200/70 text-sm mb-6">
              We&apos;ll find libraries and bookstores within walking distance.
            </p>
            <button
              type="button"
              onClick={useGeolocation}
              disabled={loading}
              className="btn-primary w-full mb-4"
            >
              Use my location
            </button>
            <div className="relative my-4 text-center text-teal-300/50 text-sm">or</div>
            <input
              className="input mb-3"
              placeholder="Enter your address"
              value={address}
              onChange={(e) => setAddress(e.target.value)}
            />
            <input
              className="input mb-4"
              placeholder="Hardcover API token (optional)"
              value={hardcoverToken}
              onChange={(e) => setHardcoverToken(e.target.value)}
            />
            <button
              type="button"
              onClick={saveAddress}
              disabled={loading}
              className="btn-secondary w-full"
            >
              Save address
            </button>
          </section>
        )}

        {step === "import" && (
          <section className="card p-6">
            <h2 className="font-display text-2xl text-white mb-2">Import your library</h2>
            <p className="text-teal-200/70 text-sm mb-6">
              Export your Goodreads library as CSV from{" "}
              <a
                href="https://www.goodreads.com/review/import"
                target="_blank"
                rel="noopener noreferrer"
                className="text-amber-200 underline"
              >
                goodreads.com/review/import
              </a>
            </p>
            <label className="btn-primary w-full cursor-pointer block text-center">
              Upload Goodreads CSV
              <input type="file" accept=".csv" className="hidden" onChange={importCsv} />
            </label>
            <button
              type="button"
              onClick={() => setStep("curators")}
              className="btn-secondary w-full mt-3"
            >
              Skip for now
            </button>
          </section>
        )}

        {step === "curators" && (
          <section className="card p-6">
            <h2 className="font-display text-2xl text-white mb-2">Follow curators</h2>
            <p className="text-teal-200/70 text-sm mb-6">
              Paste a Goodreads profile URL or Hardcover list URL to follow their shelves.
            </p>
            <div className="flex gap-2 mb-3">
              {(["goodreads", "hardcover"] as const).map((p) => (
                <button
                  key={p}
                  type="button"
                  onClick={() => setCuratorPlatform(p)}
                  className={`chip flex-1 ${curatorPlatform === p ? "chip-active" : "chip-inactive"}`}
                >
                  {p}
                </button>
              ))}
            </div>
            <input
              className="input mb-3"
              placeholder={
                curatorPlatform === "goodreads"
                  ? "https://www.goodreads.com/user/show/12345"
                  : "https://hardcover.app/@user/lists/my-list"
              }
              value={curatorUrl}
              onChange={(e) => setCuratorUrl(e.target.value)}
            />
            <button
              type="button"
              onClick={followCurator}
              disabled={loading}
              className="btn-secondary w-full mb-3"
            >
              Follow curator {curatorCount > 0 && `(${curatorCount} added)`}
            </button>
            <button
              type="button"
              onClick={() => setStep("done")}
              className="btn-primary w-full"
            >
              Continue
            </button>
          </section>
        )}

        {step === "done" && (
          <section className="card p-6 text-center">
            <div className="text-5xl mb-4">✨</div>
            <h2 className="font-display text-2xl text-white mb-2">You&apos;re all set!</h2>
            <p className="text-teal-200/70 text-sm mb-6">
              {importCount > 0 && `${importCount} books imported. `}
              {curatorCount > 0 && `${curatorCount} curator(s) followed. `}
              Ready to discover walkable reads.
            </p>
            <button
              type="button"
              onClick={() => router.push("/home")}
              className="btn-primary"
            >
              See recommendations
            </button>
          </section>
        )}

        {error && (
          <p className="mt-4 text-red-300 text-sm text-center bg-red-950/30 rounded-lg py-2 px-3">
            {error}
          </p>
        )}

        {loading && (
          <p className="mt-4 text-teal-200/60 text-sm text-center animate-pulse">Working…</p>
        )}

        <p className="mt-8 text-center">
          <Link href="/" className="text-teal-300/50 text-sm hover:text-teal-200">
            ← Back to home
          </Link>
        </p>
      </main>
    </div>
  );
}
