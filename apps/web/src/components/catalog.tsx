"use client";
import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  Heart,
  Star,
  MapPin,
  ArrowUpRight,
  BadgeCheck,
  ArrowRight,
  Store,
  Leaf,
} from "lucide-react";
import type { ProductResult, Shop } from "../../../../packages/shared/src";
import { money } from "../../../../packages/shared/src";
import { api } from "@/lib/api";
import { useAuth, useToast } from "./providers";
export function FavoriteButton({
  id,
  kind = "product",
}: {
  id: string;
  kind?: "product" | "shop";
}) {
  const { user, loading } = useAuth();
  const router = useRouter();
  const toast = useToast();
  const cache = useQueryClient();
  const { data = [] } = useQuery({
    queryKey: ["favorites", user?.id],
    queryFn: () => api<{ targetId: string; kind: string }[]>("/favorites"),
    enabled: !!user,
  });
  const saved = data.some((f) => f.targetId === id && f.kind === kind);
  const mutation = useMutation({
    mutationFn: () =>
      api<{ saved: boolean }>("/favorites", {
        method: "POST",
        body: { targetId: id, kind },
      }),
    onSuccess: (r) => {
      void cache.invalidateQueries({ queryKey: ["favorites"] });
      toast(r.saved ? "Added to your saved finds" : "Removed from saved finds");
    },
    onError: (e) => toast(e.message),
  });
  return (
    <button
      className={`favorite-button ${saved ? "saved" : ""}`}
      aria-label={saved ? "Remove from saved finds" : "Save to favourites"}
      disabled={mutation.isPending || loading}
      onClick={() => (user ? mutation.mutate() : router.push("/login"))}
    >
      <Heart size={18} fill={saved ? "currentColor" : "none"} />
    </button>
  );
}
export function ProductCard({ product: p }: { product: ProductResult }) {
  return (
    <article className="product-card">
      <div className="product-image">
        <Link href={`/products/${p.id}`}>
          <Image
            src={p.image}
            alt={p.name}
            fill
            sizes="(max-width: 640px) 50vw, (max-width: 1024px) 33vw, 25vw"
          />
        </Link>
        {p.discount > 0 ? (
          <span className="product-badge">{p.discount}% OFF</span>
        ) : p.unique ? (
          <span className="product-badge local">
            <Leaf size={11} /> Locally made
          </span>
        ) : p.pricingMode === "BIDDING" ? (
          <span className="product-badge bidding">Bidding Open</span>
        ) : null}
        <FavoriteButton id={p.id} />
      </div>
      <div className="product-info">
        <div className="product-meta">
          <span>{p.brand}</span>
          <span className="rating">
            <Star size={12} fill="currentColor" />
            {p.rating.toFixed(1)} <small>({p.reviews})</small>
          </span>
        </div>
        <Link href={`/products/${p.id}`} className="product-name" title={p.name}>
          {p.name}
        </Link>
        <div className="price-line">
          <span>
            from <strong>{money(p.price)}</strong>
          </span>
          {p.discount > 0 && <del>{money(p.maxPrice)}</del>}
        </div>
        <div className="product-status-row">
          <span className="status-dot" />
          <span>In Stock · Available</span>
        </div>
        <div className="product-location">
          <Store size={13} />
          <span>{p.sellerCount} nearby {p.sellerCount === 1 ? "seller" : "sellers"}</span>
          <span>·</span>
          <MapPin size={12} />
          <span>{p.distance.toFixed(1)} km away</span>
        </div>
        <Link className="compare-link" href={`/products/${p.id}/compare`} aria-label="Compare prices">
          View Prices <ArrowRight size={14} />
        </Link>
      </div>
    </article>
  );
}
export function ShopCard({ shop: s }: { shop: Shop }) {
  return (
    <article className="shop-card">
      <div className="shop-image">
        <Link href={`/shops/${s.id}`}>
          <Image
            src={s.image}
            alt={s.name}
            fill
            sizes="(max-width: 640px) 100vw, 33vw"
          />
        </Link>
        <span className={`open-badge ${s.isOpen ? "" : "closed"}`}>
          <i />
          {s.isOpen ? "Open now" : "Closed now"}
        </span>
        <FavoriteButton id={s.id} kind="shop" />
      </div>
      <div className="shop-info">
        <div className="shop-title">
          <Link href={`/shops/${s.id}`}>{s.name}</Link>
          {s.verified && <BadgeCheck size={18} />}
        </div>
        <p>{s.address}</p>
        <div className="shop-card-bottom">
          <span className="rating">
            <Star size={13} fill="currentColor" />
            {s.rating} <small>({s.reviews} reviews)</small>
          </span>
          <span>
            <MapPin size={13} />
            {s.distance != null ? `${s.distance.toFixed(1)} km (straight line)` : "—"}
          </span>
          <Link href={`/shops/${s.id}`} aria-label={`Visit ${s.name}`}>
            <ArrowUpRight size={19} />
          </Link>
        </div>
      </div>
    </article>
  );
}
