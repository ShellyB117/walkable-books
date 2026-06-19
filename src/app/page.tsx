import Link from "next/link";

export default function LandingPage() {
  return (
    <main className="min-h-screen flex flex-col items-center justify-center px-6 text-center relative overflow-hidden">
      <div className="absolute inset-0 opacity-20 pointer-events-none">
        <div className="absolute top-20 left-10 w-32 h-32 rounded-full bg-teal-300 blur-3xl" />
        <div className="absolute bottom-32 right-16 w-48 h-48 rounded-full bg-amber-300 blur-3xl" />
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-64 h-64 rounded-full bg-teal-400 blur-3xl" />
      </div>

      <div className="relative z-10 max-w-lg">
        <div className="text-6xl mb-6 animate-pulse">📚</div>
        <h1 className="font-display text-5xl sm:text-6xl font-bold text-white tracking-tight leading-none mb-2">
          WALKABLE
          <br />
          BOOKS
        </h1>
        <p className="text-teal-100/80 text-lg mt-4 mb-10 leading-relaxed">
          Curated picks from Goodreads &amp; Hardcover — matched to your taste and
          the libraries &amp; bookstores you can walk to.
        </p>
        <Link href="/onboarding" className="btn-primary text-lg">
          Begin
        </Link>
      </div>

      <p className="absolute bottom-6 text-teal-200/40 text-xs">
        Inspired by the cozy vibe of Messenger · abeto.co
      </p>
    </main>
  );
}
