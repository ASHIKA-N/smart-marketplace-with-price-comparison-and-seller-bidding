"use client";
import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import * as maplibregl from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";
import type { Shop } from "../../../../packages/shared/src";
export default function ShopMap({
  shops,
  selected,
  onSelect,
  location,
}: {
  shops: Shop[];
  selected: string;
  onSelect: (id: string) => void;
  location: { lat: number; lng: number };
}) {
  const element = useRef<HTMLDivElement>(null);
  const map = useRef<maplibregl.Map | null>(null);
  const markers = useRef<maplibregl.Marker[]>([]);
  const [failed, setFailed] = useState(false);
  useEffect(() => {
    if (!element.current) return;
    setFailed(false);
    let instance: maplibregl.Map;
    try {
      instance = new maplibregl.Map({
        container: element.current,
        style: process.env.NEXT_PUBLIC_MAP_STYLE || {
          version: 8,
          sources: {
            osm: {
              type: "raster",
              tiles: ["https://tile.openstreetmap.org/{z}/{x}/{y}.png"],
              tileSize: 256,
              attribution: "© OpenStreetMap contributors",
            },
          },
          layers: [{ id: "osm", type: "raster", source: "osm" }],
        },
        center: [location.lng, location.lat],
        zoom: 12,
      });
    } catch {
      setFailed(true);
      return;
    }
    instance.addControl(new maplibregl.NavigationControl(), "top-right");
    new maplibregl.Marker({ color: "#267c66" })
      .setLngLat([location.lng, location.lat])
      .addTo(instance);
    instance.on("error", () => setFailed(true));
    map.current = instance;
    return () => {
      instance.remove();
      map.current = null;
    };
  }, [location.lat, location.lng]);
  useEffect(() => {
    if (!map.current) return;
    markers.current.forEach((m) => m.remove());
    markers.current = shops.map((shop, i) => {
      const button = document.createElement("button");
      button.className = `map-marker ${selected === shop.id ? "selected" : ""}`;
      button.textContent = String(i + 1);
      button.setAttribute("aria-label", `Show ${shop.name}`);
      button.onclick = () => onSelect(shop.id);
      return new maplibregl.Marker({ element: button })
        .setLngLat([shop.lng, shop.lat])
        .addTo(map.current!);
    });
    const shop = shops.find((s) => s.id === selected);
    if (shop) map.current?.flyTo({ center: [shop.lng, shop.lat], zoom: 14 });
    return () => markers.current.forEach((m) => m.remove());
  }, [shops, selected, onSelect, location]);
  const shop = shops.find((s) => s.id === selected);
  return (
    <div className="map-container">
      <div className="map-canvas" ref={element} />
      {failed && (
        <iframe
          className="map-embed-fallback"
          title="Chennai shops on OpenStreetMap"
          src={`https://www.openstreetmap.org/export/embed.html?bbox=${location.lng - 0.06}%2C${location.lat - 0.05}%2C${location.lng + 0.06}%2C${location.lat + 0.05}&layer=mapnik&marker=${shop?.lat ?? location.lat}%2C${shop?.lng ?? location.lng}`}
        />
      )}
      <a
        className="map-external"
        href={`https://www.openstreetmap.org/?mlat=${shop?.lat ?? location.lat}&mlon=${shop?.lng ?? location.lng}#map=14/${shop?.lat ?? location.lat}/${shop?.lng ?? location.lng}`}
        target="_blank"
        rel="noreferrer"
      >
        Open in OpenStreetMap
      </a>
      {shop ? (
        <div className="map-note">
          <strong>{shop.name}</strong>
          {shop.distance?.toFixed(1)} km away · {shop.rating} stars · Trust{" "}
          {shop.trust}/100 · {shop.isOpen ? "Open" : "Closed"}
          <Link href={`/shops/${shop.id}`}>Visit storefront →</Link>
        </div>
      ) : (
        <div className="map-note">
          {failed
            ? "Map tiles could not be loaded. You can still explore every shop using the list."
            : "Select a shop on the map to see what’s around the corner."}
        </div>
      )}
    </div>
  );
}
