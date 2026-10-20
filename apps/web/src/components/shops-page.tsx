"use client";
import Image from "next/image";
import Link from "next/link";
import dynamic from "next/dynamic";
import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
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
  ShoppingBag,
} from "lucide-react";
import { api } from "@/lib/api";
import { useLocation, useAuth, useToast } from "./providers";
import { Dialog } from "./ui/dialog";
import { PageIntro, Loading, ErrorState } from "./shell";
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
        <div className="empty-state">
          <ShoppingBag size={36} />
          <h2>No shops found within {radius} km of {location.name}</h2>
          <p>
            There are currently no active physical shops within this search perimeter. You can expand your search distance or switch to another supported city.
          </p>
          <div className="row" style={{ gap: "10px", marginTop: "12px", justifyContent: "center" }}>
            {radius !== "50" && (
              <Button onClick={() => setRadius("50")}>
                Expand radius to 50 km
              </Button>
            )}
            <Button
              variant="outline"
              onClick={() => {
                if (location.lat < 13.0 && location.name.includes("Bengaluru")) {
                  window.location.reload();
                }
                setRadius("25");
              }}
            >
              Reset filters
            </Button>
          </div>
        </div>
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
  const { user } = useAuth();
  const toast = useToast();
  const cache = useQueryClient();
  const [editingReview, setEditingReview] = useState<Review | null>(null);
  const [editRating, setEditRating] = useState(5);
  const [editText, setEditText] = useState("");
  const [savingEdit, setSavingEdit] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  async function handleSaveEdit(e: React.FormEvent) {
    e.preventDefault();
    if (!editingReview) return;
    setSavingEdit(true);
    try {
      await api(`/reviews/${editingReview.id}`, {
        method: "PATCH",
        body: { rating: editRating, text: editText },
      });
      await cache.invalidateQueries();
      toast("Your review has been updated.");
      setEditingReview(null);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Failed to update review.";
      toast(msg);
    } finally {
      setSavingEdit(false);
    }
  }

  async function handleDeleteReview(reviewId: string) {
    if (!confirm("Are you sure you want to delete your review?")) return;
    setDeletingId(reviewId);
    try {
      await api(`/reviews/${reviewId}`, { method: "DELETE" });
      await cache.invalidateQueries();
      toast("Your review has been deleted.");
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Failed to delete review.";
      toast(msg);
    } finally {
      setDeletingId(null);
    }
  }

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
          <div className="mt">
            <h2 className="section-title">
              Verified shop reviews · {s.rating.toFixed(1)}/5 ({s.reviews.length} {s.reviews.length === 1 ? "review" : "reviews"})
            </h2>
            {s.reviews.length > 0 ? (
              s.reviews.map((r) => (
                <div className="review-card" key={r.id}>
                  <div className="row spread" style={{ alignItems: "flex-start" }}>
                    <div>
                      <div className="row" style={{ gap: "8px", alignItems: "center" }}>
                        <span className="rating">
                          <Star size={13} fill="currentColor" />
                          {r.rating}
                        </span>
                        <strong>{r.userName || "Verified Buyer"}</strong>
                      </div>
                      <small className="muted">
                        {new Date(r.createdAt).toLocaleDateString()}
                        {r.updatedAt ? " (edited)" : ""}
                      </small>
                    </div>
                    {user?.id === r.userId && (
                      <div className="row" style={{ gap: "6px" }}>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => {
                            setEditingReview(r);
                            setEditRating(r.rating);
                            setEditText(r.text);
                          }}
                        >
                          Edit
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          disabled={deletingId === r.id}
                          onClick={() => void handleDeleteReview(r.id)}
                        >
                          {deletingId === r.id ? "Deleting…" : "Delete"}
                        </Button>
                      </div>
                    )}
                  </div>
                  <p style={{ marginTop: "8px" }}>{r.text}</p>
                  {r.reply && (
                    <div style={{ marginTop: "10px", padding: "8px 12px", background: "var(--surface-muted, #f3f4f6)", borderRadius: "6px", borderLeft: "3px solid var(--accent, #059669)" }}>
                      <strong style={{ fontSize: "12px", display: "block" }}>Seller response:</strong>
                      <p style={{ margin: "2px 0 0", fontSize: "13px" }}>{r.reply}</p>
                      {r.repliedAt && (
                        <small className="muted" style={{ fontSize: "11px" }}>
                          {new Date(r.repliedAt).toLocaleDateString()}
                        </small>
                      )}
                    </div>
                  )}
                </div>
              ))
            ) : (
              <p className="empty-small">
                No reviews yet for this shop. Verified buyers can share their experience after completing a purchase.
              </p>
            )}
          </div>
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
      <Dialog
        open={!!editingReview}
        onOpenChange={(v) => { if (!v) setEditingReview(null); }}
        title="Edit your review"
        description="Update your star rating or review text for this shop."
      >
        <form className="stack" onSubmit={handleSaveEdit}>
          <div className="review-stars">
            {[1, 2, 3, 4, 5].map((n) => (
              <button
                type="button"
                key={n}
                className={n <= editRating ? "active" : ""}
                onClick={() => setEditRating(n)}
                aria-label={`${n} stars`}
              >
                ★
              </button>
            ))}
          </div>
          <textarea
            required
            minLength={5}
            maxLength={2000}
            rows={4}
            value={editText}
            onChange={(e) => setEditText(e.target.value)}
            placeholder="Share your experience with this shop…"
          />
          <Button disabled={savingEdit}>
            {savingEdit ? "Saving…" : "Save changes"}
          </Button>
        </form>
      </Dialog>
    </div>
  );
}
