"use client";
import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  Star,
  ChevronRight,
  MapPin,
  ShieldCheck,
  Store,
  ArrowRight,
  BadgeCheck,
  Info,
  Check,
  MessageSquare,
} from "lucide-react";
import { api } from "@/lib/api";
import { useAuth, useLocation, useToast } from "./providers";
import { Loading, ErrorState, EmptyState } from "./shell";
import { FavoriteButton } from "./catalog";
import { Button } from "./ui/button";
import { Dialog } from "./ui/dialog";
import {
  money,
  type Product,
  type ListingResult,
  type Review,
} from "../../../../packages/shared/src";
type Detail = Omit<Product, "reviews"> & {
  listings: ListingResult[];
  reviews: Review[];
};
export function ProductPage({
  id,
  compare = false,
}: {
  id: string;
  compare?: boolean;
}) {
  const { location } = useLocation();
  const { user, loading: authLoading } = useAuth();
  const router = useRouter();
  const toast = useToast();
  const cache = useQueryClient();
  const [selected, setSelected] = useState<ListingResult | null>(null);
  const [quantity, setQuantity] = useState(1);
  const [requestOpen, setRequestOpen] = useState(false);
  const [sort, setSort] = useState("price");
  const {
    data: p,
    isPending,
    error,
    refetch,
  } = useQuery({
    queryKey: ["product", id, location, user?.id],
    queryFn: () =>
      api<Detail>(`/products/${id}?lat=${location.lat}&lng=${location.lng}`),
  });
  const reserve = useMutation({
    mutationFn: () =>
      api("/transactions", {
        method: "POST",
        body: { listingId: selected?.id, quantity },
      }),
    onSuccess: () => {
      setSelected(null);
      void cache.invalidateQueries();
      toast("Reserved! The seller will confirm your pickup.");
      router.push("/transactions");
    },
  });
  const request = useMutation({
    mutationFn: (body: unknown) => api("/requests", { method: "POST", body }),
    onSuccess: () => {
      setRequestOpen(false);
      toast("Your price request is open to local sellers.");
      router.push("/requests");
    },
  });
  if (isPending)
    return (
      <div className="container section">
        <Loading />
      </div>
    );
  if (error) return <ErrorState error={error} retry={() => refetch()} />;
  if (!p) return null;
  const listings = [...p.listings].sort((a, b) =>
    sort === "nearest"
      ? (a.shop.distance || 0) - (b.shop.distance || 0)
      : sort === "rating"
        ? b.shop.rating - a.shop.rating
        : a.finalPrice - b.finalPrice,
  );
  const best = p.listings[0];
  return (
    <div className="container page-body">
      <div className="breadcrumb">
        <Link href="/">Discover</Link>
        <ChevronRight />
        <Link href={`/search?category=${encodeURIComponent(p.category)}`}>
          {p.category}
        </Link>
        <ChevronRight />
        <span>{p.name}</span>
      </div>
      <div className="product-detail">
        <div className="detail-image">
          <Image
            src={p.image}
            alt={p.name}
            fill
            priority
            sizes="(max-width: 560px) 100vw, 50vw"
          />
          <FavoriteButton id={p.id} />
          {p.unique && (
            <span className="product-badge local">Locally made</span>
          )}
        </div>
        <div className="detail-copy">
          <span className="eyebrow">
            {p.brand} · {p.category}
          </span>
          <h1>{p.name}</h1>
          <span className="rating">
            <Star size={15} fill="currentColor" />
            {p.rating} <small>({p.reviews.length} verified reviews)</small>
          </span>
          <p>{p.description}</p>
          {best ? (
            <>
              <div className="detail-price">
                <small>Starting at</small>
                <strong>{money(best.finalPrice)}</strong>
                {best.offer && (
                  <span className="badge">
                    Save {money(best.price - best.finalPrice)}
                  </span>
                )}
              </div>
              <p className="muted">
                Available from {p.listings.length} nearby shops. Compare before
                you decide.
              </p>
            </>
          ) : (
            <p>No available sellers within 10 km of your location.</p>
          )}
          <div className="row">
            <Button asChild>
              <a href="#compare">
                Compare {p.listings.length} sellers <ArrowRight size={16} />
              </a>
            </Button>
            <Button
              variant="outline"
              onClick={() =>
                user ? setRequestOpen(true) : router.push("/login")
              }
            >
              <MessageSquare size={16} />
              Request a better price
            </Button>
          </div>
          <div className="detail-perks">
            <span>
              <ShieldCheck />
              Verified purchase reviews
            </span>
            <span>
              <Store />
              Pay at the shop
            </span>
            <span>
              <MapPin />
              Shop locally
            </span>
          </div>
        </div>
      </div>
      <div className="section-heading" id="compare">
        <div>
          <span className="eyebrow">A LITTLE COMPARISON GOES A LONG WAY</span>
          <h2>
            {compare
              ? "Find your best local price"
              : "One product. More possibilities."}
          </h2>
          <p>Compare the price, the distance, and the people behind it.</p>
        </div>
        <select
          className="control"
          style={{ width: 155 }}
          aria-label="Sort sellers"
          value={sort}
          onChange={(e) => setSort(e.target.value)}
        >
          <option value="price">Lowest price</option>
          <option value="nearest">Nearest shop</option>
          <option value="rating">Highest rated</option>
        </select>
      </div>
      {listings.length ? (
        <div className="table-wrap">
          <table className="comparison-table">
            <thead>
              <tr>
                <th>Local seller</th>
                <th>Distance</th>
                <th>Shop rating</th>
                <th>Availability</th>
                <th>Estimated price</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {listings.map((l) => (
                <tr key={l.id} className={l.id === best?.id ? "best-row" : ""}>
                  <td>
                    <div className="shop-cell">
                      <Image src={l.shop.image} alt="" width={42} height={42} />
                      <div>
                        <Link href={`/shops/${l.shop.id}`}>{l.shop.name}</Link>
                        <small>
                          {l.shop.isOpen ? "Open now" : "Currently closed"} ·
                          Trust {l.shop.trust}/100
                        </small>
                        {l.id === best?.id && (
                          <span className="badge" style={{ marginTop: 6 }}>
                            Lowest price
                          </span>
                        )}
                      </div>
                    </div>
                  </td>
                  <td>{l.shop.distance?.toFixed(1)} km</td>
                  <td>
                    <span className="rating">
                      <Star size={12} fill="currentColor" />
                      {l.shop.rating}
                    </span>
                  </td>
                  <td>
                    <span className={`badge ${l.stock ? "" : "gray"}`}>
                      {l.stock ? (
                        <>
                          <Check size={12} />
                          In stock
                        </>
                      ) : (
                        "Out of stock"
                      )}
                    </span>
                    <small>{l.stock} available</small>
                  </td>
                  <td>
                    <strong>{money(l.finalPrice)}</strong>
                    {l.price !== l.finalPrice && (
                      <small>
                        <del>{money(l.price)}</del> · {l.offer?.title}
                      </small>
                    )}
                    {l.loyaltyDiscount > 0 && (
                      <small>
                        Includes {l.loyaltyDiscount}% loyalty discount
                      </small>
                    )}
                  </td>
                  <td>
                    <Button
                      size="sm"
                      disabled={!l.stock || authLoading}
                      onClick={() => {
                        if (!user) {
                          router.push("/login");
                          return;
                        }
                        setQuantity(1);
                        reserve.reset();
                        setSelected(l);
                      }}
                    >
                      Reserve <ArrowRight size={13} />
                    </Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <EmptyState
          title="No sellers in this area"
          description="Choose another location to find this product nearby."
        />
      )}
      <div className="comparison-notes">
        <Info size={15} />
        <span>
          Prices include active offers. Reserve to lock in the displayed price.
          Payment happens at the shop; no online payment is collected.
        </span>
      </div>
      <h2 className="section-title">From the neighbourhood</h2>
      {Array.isArray(p.reviews) && p.reviews.length ? (
        <div className="review-list">
          {p.reviews.map((r) => (
            <div className="review-card" key={r.id}>
              <div className="row spread">
                <span className="rating">
                  <Star fill="currentColor" size={14} />
                  {r.rating}.0
                </span>
                <span className="badge">
                  <BadgeCheck size={12} />
                  Verified purchase
                </span>
              </div>
              <p>{r.text}</p>
              <small>{new Date(r.createdAt).toLocaleDateString()}</small>
            </div>
          ))}
        </div>
      ) : (
        <p className="muted">
          Be the first to share your experience after a completed purchase.
          Sample aggregate ratings are shown for demo products.
        </p>
      )}
      <Dialog
        open={!!selected}
        onOpenChange={(open) => {
          if (!open) setSelected(null);
        }}
        title="A good find, reserved for you"
        description="Reserve now and pay when you pick up. The shop will confirm your reservation."
      >
        {selected && (
          <div className="stack">
            <div className="row">
              <Image
                src={p.image}
                alt={p.name}
                width={65}
                height={65}
                style={{ borderRadius: 8 }}
              />
              <div>
                <strong>{p.name}</strong>
                <p className="muted">{selected.shop.name}</p>
              </div>
            </div>
            <label className="field">
              Quantity
              <input
                type="number"
                min={1}
                max={Math.min(100, selected.stock)}
                value={quantity}
                onChange={(e) => setQuantity(Number(e.target.value))}
              />
            </label>
            <div className="row spread">
              <span>Reservation total</span>
              <strong>{money(selected.finalPrice * quantity)}</strong>
            </div>
            {reserve.error && (
              <p className="form-error">{reserve.error.message}</p>
            )}
            <Button
              disabled={
                reserve.isPending ||
                quantity < 1 ||
                quantity > selected.stock ||
                !Number.isInteger(quantity)
              }
              onClick={() => reserve.mutate()}
            >
              {reserve.isPending ? "Reserving…" : "Confirm reservation"}
              <ArrowRight size={16} />
            </Button>
          </div>
        )}
      </Dialog>
      <Dialog
        open={requestOpen}
        onOpenChange={setRequestOpen}
        title="Your price. Their best offer."
        description="Let nearby sellers know what works for you. They can respond with a personal offer."
      >
        <form
          className="stack"
          onSubmit={(e) => {
            e.preventDefault();
            const f = new FormData(e.currentTarget);
            request.mutate({
              productId: p.id,
              quantity: Number(f.get("quantity")),
              targetPrice: Number(f.get("price")),
              note: f.get("note"),
            });
          }}
        >
          <label className="field">
            Your target price per item (₹)
            <input
              name="price"
              type="number"
              min="1"
              step="0.01"
              defaultValue={best ? Math.round(best.finalPrice * 0.9) : 100}
              required
            />
          </label>
          <label className="field">
            Quantity
            <input
              name="quantity"
              type="number"
              min="1"
              max="100"
              defaultValue="1"
              required
            />
          </label>
          <label className="field">
            A note for the sellers
            <textarea
              name="note"
              maxLength={500}
              placeholder="Colour preferences, when you can pick up…"
            />
          </label>
          {request.error && (
            <p className="form-error">{request.error.message}</p>
          )}
          <Button disabled={request.isPending}>
            {request.isPending ? "Sending…" : "Send price request"}
            <ArrowRight size={16} />
          </Button>
        </form>
      </Dialog>
    </div>
  );
}
