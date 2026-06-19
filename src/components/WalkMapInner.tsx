"use client";

import { useEffect, useRef } from "react";
import maplibregl from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";
import type { BookPlace } from "@/lib/geo/overpass";

type WalkMapInnerProps = {
  originLat: number;
  originLng: number;
  places: BookPlace[];
  className?: string;
};

const PLACE_COLORS: Record<BookPlace["type"], string> = {
  library: "#fbbf24",
  bookstore: "#34d399",
  little_free_library: "#f472b6",
};

export default function WalkMapInner({
  originLat,
  originLng,
  places,
  className = "",
}: WalkMapInnerProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<maplibregl.Map | null>(null);

  useEffect(() => {
    if (!containerRef.current) return;

    const style =
      process.env.NEXT_PUBLIC_MAP_STYLE ||
      "https://basemaps.cartocdn.com/gl/dark-matter-gl-style/style.json";

    const map = new maplibregl.Map({
      container: containerRef.current,
      style,
      center: [originLng, originLat],
      zoom: 13,
    });

    map.addControl(new maplibregl.NavigationControl(), "top-right");
    mapRef.current = map;

    map.on("load", () => {
      new maplibregl.Marker({ color: "#38bdf8" })
        .setLngLat([originLng, originLat])
        .setPopup(new maplibregl.Popup().setText("You"))
        .addTo(map);

      places.slice(0, 15).forEach((place, i) => {
        new maplibregl.Marker({ color: PLACE_COLORS[place.type] })
          .setLngLat([place.lng, place.lat])
          .setPopup(
            new maplibregl.Popup().setHTML(
              `<strong>${i + 1}. ${place.name}</strong><br/>${place.walkMinutes ?? "?"} min walk`
            )
          )
          .addTo(map);
      });
    });

    return () => {
      map.remove();
      mapRef.current = null;
    };
  }, [originLat, originLng, places]);

  return (
    <div
      ref={containerRef}
      className={`w-full min-h-[280px] rounded-xl overflow-hidden border border-teal-800/40 ${className}`}
    />
  );
}
