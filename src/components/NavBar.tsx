import Link from "next/link";

export function NavBar() {
  return (
    <nav className="flex items-center justify-between px-4 py-3 border-b border-teal-800/20 bg-teal-950/30 backdrop-blur-sm">
      <Link href="/home" className="font-display text-lg tracking-wide text-white">
        Walkable Books
      </Link>
      <div className="flex gap-4 text-sm">
        <Link href="/home" className="text-teal-100/80 hover:text-white transition">
          Discover
        </Link>
        <Link href="/curators" className="text-teal-100/80 hover:text-white transition">
          Curators
        </Link>
        <Link href="/onboarding" className="text-teal-100/80 hover:text-white transition">
          Setup
        </Link>
      </div>
    </nav>
  );
}
