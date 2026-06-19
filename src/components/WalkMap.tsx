"use client";

import dynamic from "next/dynamic";
import type { BookPlace } from "@/lib/geo/overpass";

const WalkMapInner = dynamic(() => import("./WalkMapInner"), {
  ssr: false,
  loading: () => (
    <div className="w-full h-full min-h-[280px] bg-teal-900/30 rounded-xl flex items-center justify-center text-teal-200/60">
      Loading map…
    </div>
  ),
});

type WalkMapProps = {
  originLat: number;
  originLng: number;
  places: BookPlace[];
  className?: string;
};

export function WalkMap(props: WalkMapProps) {
  return <WalkMapInner {...props} />;
}
