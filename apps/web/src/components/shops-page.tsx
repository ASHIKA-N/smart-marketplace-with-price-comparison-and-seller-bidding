"use client";
import Image from "next/image";
import Link from "next/link";
import dynamic from "next/dynamic";
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  MapPin,
  Star,
  Grid2X2,
  Map,
  Clock,
  Phone,
  ShieldCheck,
  ArrowUpRight,
  BadgeCheck,
} from "lucide-react";
import { api } from "@/lib/api";
import { useLocation } from "./providers";
import { PageIntro, Loading, ErrorState, EmptyState } from "./shell";
import { ShopCard, ProductCard } from "./catalog";
import { Button } from "./ui/button";
import type {
  Shop,
  Product,
  ListingResult,
  Review,
} from "../../../../packages/shared/src";
const ShopMap = dynamic(() => import("./shop-map"), {
  ssr: false,
  loading: () => (
    <div className="map-container">
      <p className="empty-small">Loading neighbourhood map…</p>
    </div>
  ),
});
export function ShopsPage({ nearby = false }: { nearby?: boolean }) {
  const { location } = useLocation();
  const [radius, setRadius] = useState("10");
  const [selected, setSelected] = useState("");
  const [open, setOpen] = useState(false);
  const query = `lat=${location.lat}&lng=${location.lng}&radius=${radius}&open=${open}`;
  const {
    data = [],
    isPending,
    error,
    refetch,
  } = useQuery({
    queryKey: ["shops", query],
    queryFn: () => api<Shop[]>(`/shops?${query}`),
  });
  return (
    <div className="container page-body">
      <PageIntro
        eyebrow="MEET YOUR NEIGHBOURS"
        title="Good shops. Close to home."
        description={`Discover independent stores around ${location.name}.`}
      >
        <div className="row">
          <Button asChild variant={nearby ? "outline" : "default"}>
            <Link href="/shops">
              <Grid2X2 size={16} />
              List
            </Link>
          </Button>
          <Button asChild variant={nearby ? "default" : "outline"}>
            <Link href="/shops/nearby">
              <Map size={16} />
              Map
            </Link>
          </Button>
        </div>
      </PageIntro>
      <div className="results-toolbar mb">
        <p>{data.length} local shops in your neighbourhood</p>
        <div className="row">
          <label className="checkbox">
            <input
              type="checkbox"
              checked={open}
              onChange={(e) => setOpen(e.target.checked)}
            />
            Open now
          </label>
          <select
            className="control"
            aria-label="Shop search radius"
            value={radius}
            onChange={(e) => setRadius(e.target.value)}
          >
            {[2, 5, 10, 25, 50].map((n) => (
              <option key={n} value={n}>
                Within {n} km
              </option>
            ))}
          </select>
        </div>
      </div>
      {isPending ? (
        <Loading />
      ) : error ? (
        <ErrorState error={error} retry={() => refetch()} />
      ) : !data.length ? (
        <EmptyState
          title="No shops in this area yet"
          description="Try a wider radius or choose a different neighbourhood."
          href="/shops"
          label="Explore shops"
        />
      ) : nearby ? (
        <div className="map-layout">
          <div className="map-list">
            {data.map((s) => (
              <button
                className={`map-list-item ${selected === s.id ? "selected" : ""}`}
                key={s.id}
                onClick={() => setSelected(s.id)}
              >
                <Image src={s.image} alt="" width={68} height={68} />
                <div>
                  <strong>{s.name}</strong>
                  <span className="rating">
                    <Star size={12} fill="currentColor" />
                    {s.rating} · {s.distance?.toFixed(1)} km
                  </span>
                  <p>
                    {s.isOpen ? "Open now" : "Closed now"} · Trust {s.trust}/100
                  </p>
                </div>
              </button>
            ))}
          </div>
          <ShopMap
            shops={data}
            selected={selected}
            onSelect={setSelected}
            location={location}
          />
        </div>
      ) : (
        <div className="shop-grid">
          {data.map((s) => (
            <ShopCard key={s.id} shop={s} />
          ))}
        </div>
      )}
    </div>
  );
}
type ShopDetail = Omit<Shop, "reviews"> & {
  listings: (ListingResult & { product: Product })[];
  reviews: Review[];
};
export function ShopPage({ id }: { id: string }) {
  const {
    data: s,
    isPending,
    error,
    refetch,
  } = useQuery({
    queryKey: ["shop", id],
    queryFn: () => api<ShopDetail>(`/shops/${id}`),
  });
  if (isPending)
    return (
      <div className="container section">
        <Loading />
      </div>
    );
  if (error) return <ErrorState error={error} retry={() => refetch()} />;
  if (!s) return null;
  return (
    <div className="container page-body">
      <div className="shop-hero">
        <Image src={s.image} alt={s.name} fill priority sizes="100vw" />
        <div>
          <span className="badge">
            <BadgeCheck size={13} />
            {s.verified ? "Verified local shop" : "Independent local shop"}
          </span>
          <h1>{s.name}</h1>
          <p>{s.address}</p>
        </div>
      </div>
      <div className="shop-details-layout">
        <div>
          <div className="section-heading">
            <div>
              <h2>A few things you’ll love</h2>
              <p>Explore what’s in store at {s.name}.</p>
            </div>
          </div>
          <div className="product-grid">
            {s.listings.map((l) => (
              <ProductCard
                key={l.id}
                product={{
                  ...l.product,
                  price: l.finalPrice,
                  maxPrice: l.price,
                  sellerCount: 1,
                  distance: 0,
                  discount: Math.round((1 - l.finalPrice / l.price) * 100),
                }}
              />
            ))}
          </div>
          {s.reviews.length > 0 && (
            <div className="mt">
              <h2 className="section-title">Verified shop reviews</h2>
              {s.reviews.map((r) => (
                <div className="review-card" key={r.id}>
                  <span className="rating">
                    <Star size={13} fill="currentColor" />
                    {r.rating}
                  </span>
                  <p>{r.text}</p>
                </div>
              ))}
            </div>
          )}
        </div>
        <aside className="panel shop-contact">
          <h2>Hello, neighbour.</h2>
          <p>{s.description}</p>
          <div className="row">
            <Star />
            {s.rating} shop rating · {s.reviews.length} verified reviews
          </div>
          <div className="row">
            <ShieldCheck />
            Trust score {s.trust}/100 · {s.completed} completed purchases
          </div>
          <div className="row">
            <Clock />
            <span>
              {s.isOpen ? "Open now" : "Currently closed"}
              <br />
              {s.hours.open} – {s.hours.close} IST
              <br />
              <small>
                {s.hours.days
                  .map(
                    (d) => ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"][d],
                  )
                  .join(", ")}
              </small>
            </span>
          </div>
          <div className="row">
            <MapPin />
            {s.address}
          </div>
          <div className="row">
            <Phone />
            <a href={`tel:${s.phone}`}>{s.phone}</a>
          </div>
          <Button className="mt full-width" asChild>
            <a
              href={`https://www.google.com/maps/dir/?api=1&destination=${s.lat},${s.lng}`}
              target="_blank"
              rel="noreferrer"
            >
              Get directions <ArrowUpRight size={16} />
            </a>
          </Button>
        </aside>
      </div>
    </div>
  );
}
