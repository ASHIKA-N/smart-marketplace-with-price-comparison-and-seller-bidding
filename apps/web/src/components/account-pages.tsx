"use client";
import Image from "next/image";
import Link from "next/link";
import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  Heart,
  ArrowRight,
  Star,
  ShieldCheck,
  Store,
  Plus,
} from "lucide-react";
import { api } from "@/lib/api";
import { useAuth, useLocation, useToast } from "./providers";
import {
  PageIntro,
  AuthRequired,
  EmptyState,
  Loading,
  ErrorState,
  LogoutButton,
} from "./shell";
import { ProductCard, ShopCard } from "./catalog";
import { Button } from "./ui/button";
import { Dialog } from "./ui/dialog";
import {
  money,
  type ProductResult,
  type Shop as ShopType,
  type Transaction,
  type Product,
  type BidRequest,
  type Bid,
  type PublicUser,
} from "../../../../packages/shared/src";
export function FavoritesPage() {
  return (
    <AuthRequired>
      <Favorites />
    </AuthRequired>
  );
}
function Favorites() {
  const { user } = useAuth();
  const { location } = useLocation();
  const [tab, setTab] = useState("products");
  const {
    data: favorites = [],
    isPending,
    error,
  } = useQuery({
    queryKey: ["favorites", user?.id],
    queryFn: () => api<{ targetId: string; kind: string }[]>("/favorites"),
  });
  const products = useQuery({
    queryKey: ["saved-products", location],
    queryFn: () =>
      api<{ items: ProductResult[] }>(
        `/products?lat=${location.lat}&lng=${location.lng}&radius=100&limit=48`,
      ),
  });
  const shops = useQuery({
    queryKey: ["saved-shops", location],
    queryFn: () =>
      api<ShopType[]>(
        `/shops?lat=${location.lat}&lng=${location.lng}&radius=100`,
      ),
  });
  const selectedProducts =
    products.data?.items.filter((p) =>
      favorites.some((f) => f.targetId === p.id && f.kind === "product"),
    ) || [];
  const selectedShops =
    shops.data?.filter((s) =>
      favorites.some((f) => f.targetId === s.id && f.kind === "shop"),
    ) || [];
  return (
    <div className="container page-body">
      <PageIntro
        eyebrow="THE ONES YOU LOVE"
        title="Your saved finds."
        description="Keep the good stuff close. Your favourite products and neighbourhood shops."
      />
      <div className="row mb">
        <Button
          variant={tab === "products" ? "default" : "outline"}
          onClick={() => setTab("products")}
        >
          <Heart size={15} />
          Products
        </Button>
        <Button
          variant={tab === "shops" ? "default" : "outline"}
          onClick={() => setTab("shops")}
        >
          <Store size={15} />
          Shops
        </Button>
      </div>
      {isPending || products.isPending || shops.isPending ? (
        <Loading />
      ) : error || products.error || shops.error ? (
        <ErrorState error={(error || products.error || shops.error)!} />
      ) : tab === "products" ? (
        selectedProducts.length ? (
          <div className="product-grid">
            {selectedProducts.map((p) => (
              <ProductCard product={p} key={p.id} />
            ))}
          </div>
        ) : (
          <EmptyState
            title="Save a little inspiration"
            description="Tap the heart on anything you love. We’ll keep it here for you."
          />
        )
      ) : selectedShops.length ? (
        <div className="shop-grid">
          {selectedShops.map((s) => (
            <ShopCard shop={s} key={s.id} />
          ))}
        </div>
      ) : (
        <EmptyState
          title="Your favourite shops belong here"
          description="Save neighbourhood shops to find them again easily."
          href="/shops"
          label="Meet local shops"
        />
      )}
    </div>
  );
}
type Order = Transaction & {
  product: Product;
  shop: ShopType;
  reviewed: boolean;
};
export function TransactionsPage() {
  return (
    <AuthRequired>
      <Transactions />
    </AuthRequired>
  );
}
function Transactions() {
  const cache = useQueryClient();
  const toast = useToast();
  const [review, setReview] = useState<Order | null>(null);
  const [cancel, setCancel] = useState<Order | null>(null);
  const [rating, setRating] = useState(5);
  const {
    data = [],
    isPending,
    error,
    refetch,
  } = useQuery({
    queryKey: ["transactions"],
    queryFn: () => api<Order[]>("/transactions"),
  });
  const cancellation = useMutation({
    mutationFn: () =>
      api(`/transactions/${cancel?.id}`, {
        method: "PATCH",
        body: { status: "CANCELLED" },
      }),
    onSuccess: () => {
      setCancel(null);
      void cache.invalidateQueries();
      toast("Reservation cancelled and stock released.");
    },
  });
  const reviewMutation = useMutation({
    mutationFn: (text: string) =>
      api("/reviews", {
        method: "POST",
        body: { transactionId: review?.id, rating, text },
      }),
    onSuccess: () => {
      setReview(null);
      void cache.invalidateQueries();
      toast("Thank you for sharing your local experience.");
    },
  });
  return (
    <div className="container page-body">
      <PageIntro
        eyebrow="YOUR LOCAL FINDS"
        title="Your reservations."
        description="Reserve online, pay at the shop. Keep track of every good find."
      />
      {isPending ? (
        <Loading />
      ) : error ? (
        <ErrorState error={error} retry={() => refetch()} />
      ) : !data.length ? (
        <EmptyState
          title="Your next good find is waiting"
          description="Compare local prices and reserve something you love. Your reservations will appear here."
        />
      ) : (
        data
          .slice()
          .reverse()
          .map((t) => (
            <article className="transaction-card" key={t.id}>
              <div className="row">
                <Image
                  src={t.product.image}
                  alt={t.product.name}
                  width={78}
                  height={78}
                />
                <div>
                  <Link href={`/products/${t.productId}`}>
                    <h3>{t.product.name}</h3>
                  </Link>
                  <p>
                    {t.shop.name} · Quantity {t.quantity}
                  </p>
                  <p>
                    {new Date(t.createdAt).toLocaleDateString("en-IN", {
                      day: "numeric",
                      month: "short",
                      year: "numeric",
                    })}
                  </p>
                </div>
                <div className="transaction-total">
                  <strong>{money(t.total)}</strong>
                  <p>
                    <span
                      className={`badge ${t.status === "CANCELLED" ? "gray" : t.status === "INITIATED" ? "amber" : ""}`}
                    >
                      {t.status === "INITIATED"
                        ? "Awaiting confirmation"
                        : t.status.toLowerCase()}
                    </span>
                  </p>
                </div>
              </div>
              <div className="transaction-actions">
                <span>Reservation #{t.id.slice(0, 8)} · Pay at pickup</span>
                <div className="row">
                  {["INITIATED", "CONFIRMED"].includes(t.status) && (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => {
                        cancellation.reset();
                        setCancel(t);
                      }}
                    >
                      Cancel reservation
                    </Button>
                  )}
                  {t.status === "COMPLETED" && !t.reviewed && (
                    <Button
                      size="sm"
                      onClick={() => {
                        reviewMutation.reset();
                        setRating(5);
                        setReview(t);
                      }}
                    >
                      <Star size={13} />
                      Leave a review
                    </Button>
                  )}
                  {t.reviewed && (
                    <span className="badge">
                      <ShieldCheck size={12} />
                      Review submitted
                    </span>
                  )}
                  <Button asChild variant="outline" size="sm">
                    <Link href={`/shops/${t.shopId}`}>
                      Visit shop
                      <ArrowRight size={13} />
                    </Link>
                  </Button>
                </div>
              </div>
            </article>
          ))
      )}
      <Dialog
        open={!!cancel}
        onOpenChange={(v) => {
          if (!v) setCancel(null);
        }}
        title="Cancel this reservation?"
        description="The shop will release your reserved stock. You can always reserve again if it’s available."
      >
        <div className="stack">
          {cancellation.error && (
            <p className="form-error">{cancellation.error.message}</p>
          )}
          <Button
            disabled={cancellation.isPending}
            onClick={() => cancellation.mutate()}
          >
            Yes, cancel reservation
          </Button>
          <Button variant="outline" onClick={() => setCancel(null)}>
            Keep my reservation
          </Button>
        </div>
      </Dialog>
      <Dialog
        open={!!review}
        onOpenChange={(v) => {
          if (!v) setReview(null);
        }}
        title="How was your local find?"
        description="Your verified review helps neighbours shop with confidence."
      >
        <form
          className="stack"
          onSubmit={(e) => {
            e.preventDefault();
            reviewMutation.mutate(
              String(new FormData(e.currentTarget).get("text")),
            );
          }}
        >
          <div className="review-stars">
            {[1, 2, 3, 4, 5].map((n) => (
              <button
                type="button"
                key={n}
                onClick={() => setRating(n)}
                aria-label={`Rate ${n} stars`}
              >
                <Star fill={n <= rating ? "currentColor" : "none"} />
              </button>
            ))}
          </div>
          <label className="field">
            Your experience
            <textarea
              name="text"
              minLength={5}
              maxLength={2000}
              required
              placeholder="Tell your neighbours about the product and the shop…"
            />
          </label>
          {reviewMutation.error && (
            <p className="form-error">{reviewMutation.error.message}</p>
          )}
          <Button disabled={reviewMutation.isPending}>
            Publish verified review
          </Button>
        </form>
      </Dialog>
    </div>
  );
}
type RequestDetail = BidRequest & {
  product: Product;
  bids: (Bid & { shop: ShopType; listingId: string })[];
};
export function RequestsPage() {
  return (
    <AuthRequired>
      <Requests />
    </AuthRequired>
  );
}
function Requests() {
  const cache = useQueryClient();
  const toast = useToast();
  const [accept, setAccept] = useState<{
    bid: RequestDetail["bids"][number];
    request: RequestDetail;
  } | null>(null);
  const {
    data = [],
    isPending,
    error,
    refetch,
  } = useQuery({
    queryKey: ["requests"],
    queryFn: () => api<RequestDetail[]>("/requests"),
  });
  const mutation = useMutation({
    mutationFn: () =>
      api("/transactions", {
        method: "POST",
        body: {
          listingId: accept?.bid.listingId,
          bidId: accept?.bid.id,
          quantity: accept?.request.quantity,
        },
      }),
    onSuccess: () => {
      setAccept(null);
      void cache.invalidateQueries();
      toast("Offer accepted! Your reservation is ready to view.");
    },
  });
  return (
    <div className="container page-body">
      <PageIntro
        eyebrow="LET THE BEST DEAL FIND YOU"
        title="Your price requests."
        description="Tell sellers what you want. Compare personal offers from shops nearby."
      >
        <Button asChild>
          <Link href="/search">
            <Plus size={15} />
            Find a product
          </Link>
        </Button>
      </PageIntro>
      {isPending ? (
        <Loading />
      ) : error ? (
        <ErrorState error={error} retry={() => refetch()} />
      ) : !data.length ? (
        <EmptyState
          title="Good things come to those who ask"
          description="Open a product and choose “Request a better price”. Local sellers can send you their best offers."
          label="Find a product"
        />
      ) : (
        data
          .slice()
          .reverse()
          .map((r) => (
            <div className="panel request-card" key={r.id}>
              <div className="row spread">
                <div>
                  <h3>{r.product.name}</h3>
                  <p className="muted">
                    Target {money(r.targetPrice)} per item · Quantity{" "}
                    {r.quantity}
                  </p>
                  {r.note && <p className="muted">{r.note}</p>}
                </div>
                <span
                  className={`badge ${r.status === "CLOSED" ? "gray" : ""}`}
                >
                  {r.status === "OPEN" ? "Accepting offers" : "Offer accepted"}
                </span>
              </div>
              {r.bids.length ? (
                r.bids
                  .slice()
                  .sort((a, b) => a.price - b.price)
                  .map((b) => (
                    <div className="bid-row" key={b.id}>
                      <ShieldCheck size={23} color="var(--green)" />
                      <div>
                        <strong>
                          {b.shop.name} · {money(b.price)} / item
                        </strong>
                        <p>
                          {b.note || "A personal offer from a local seller."}
                        </p>
                      </div>
                      <Button
                        size="sm"
                        disabled={r.status === "CLOSED"}
                        onClick={() => {
                          mutation.reset();
                          setAccept({ bid: b, request: r });
                        }}
                      >
                        Accept & reserve
                        <ArrowRight size={13} />
                      </Button>
                    </div>
                  ))
              ) : (
                <p className="muted">
                  Your request is open. Offers from local sellers will appear
                  here.
                </p>
              )}
            </div>
          ))
      )}
      <Dialog
        open={!!accept}
        onOpenChange={(v) => {
          if (!v) setAccept(null);
        }}
        title="A deal made just for you"
        description="Accept this offer to reserve your items. Other offers on this request will close."
      >
        <div className="stack">
          <p>{accept?.bid.shop.name}</p>
          <strong>
            Total:{" "}
            {money((accept?.bid.price || 0) * (accept?.request.quantity || 1))}
          </strong>
          <p className="muted">
            Pay when you pick up. The seller will confirm your reservation.
          </p>
          {mutation.error && (
            <p className="form-error">{mutation.error.message}</p>
          )}
          <Button
            disabled={mutation.isPending}
            onClick={() => mutation.mutate()}
          >
            Accept and reserve
          </Button>
        </div>
      </Dialog>
    </div>
  );
}
export function ProfilePage() {
  return (
    <AuthRequired>
      <Profile />
    </AuthRequired>
  );
}
function Profile() {
  const { user } = useAuth();
  const cache = useQueryClient();
  const toast = useToast();
  const [verification, setVerification] = useState("");
  const update = useMutation({
    mutationFn: (body: unknown) =>
      api<PublicUser>("/users/me", { method: "PATCH", body }),
    onSuccess: (u) => {
      cache.setQueryData(["me"], u);
      toast("Your profile is updated.");
    },
  });
  const password = useMutation({
    mutationFn: (body: unknown) =>
      api("/users/me/password", { method: "POST", body }),
    onSuccess: () =>
      toast("Password changed. Other sessions have been signed out."),
  });
  return (
    <div className="container page-body">
      <PageIntro
        eyebrow="HELLO, NEIGHBOUR"
        title="Make yourself at home."
        description="Manage your account and your place in the neighbourhood."
      >
        <LogoutButton />
      </PageIntro>
      <div className="profile-layout">
        <section className="panel">
          <h2>Your profile</h2>
          <form
            className="stack"
            onSubmit={(e) => {
              e.preventDefault();
              const f = new FormData(e.currentTarget);
              update.mutate({
                name: f.get("name"),
                seller: f.get("seller") === "on",
              });
            }}
          >
            <label className="field">
              Full name
              <input
                name="name"
                defaultValue={user?.name}
                minLength={2}
                maxLength={80}
                required
              />
            </label>
            <label className="field">
              Email address
              <input value={user?.email || ""} disabled />
            </label>
            <span className="badge" style={{ alignSelf: "start" }}>
              <ShieldCheck size={12} />
              {user?.verified ? "Email verified" : "Email not yet verified"}
            </span>
            {!user?.roles.includes("SELLER") && (
              <label className="checkbox">
                <input name="seller" type="checkbox" />
                Enable my seller account
              </label>
            )}
            {update.error && (
              <p className="form-error">{update.error.message}</p>
            )}
            <Button disabled={update.isPending}>Save profile</Button>
          </form>
          {!user?.verified && (
            <div className="stack">
              <Button
                variant="outline"
                onClick={async () => {
                  try {
                    const r = await api<{
                      demoToken?: string;
                      message: string;
                    }>("/auth/send-verification", { method: "POST" });
                    setVerification(r.demoToken || "");
                    toast(
                      r.demoToken
                        ? "Your demo verification link is ready."
                        : r.message,
                    );
                  } catch (e) {
                    toast((e as Error).message);
                  }
                }}
              >
                Get email verification link
              </Button>
              {verification && (
                <Link
                  className="text-link"
                  href={`/verify-email?token=${verification}`}
                >
                  Verify email in local demo →
                </Link>
              )}
            </div>
          )}
        </section>
        <section className="panel">
          <h2>Keep your account secure</h2>
          <p className="muted">
            Use a unique password with at least 10 characters.
          </p>
          <form
            className="stack"
            onSubmit={(e) => {
              e.preventDefault();
              const f = new FormData(e.currentTarget);
              password.mutate({
                currentPassword: f.get("currentPassword"),
                password: f.get("password"),
              });
            }}
          >
            <label className="field">
              Current password
              <input
                name="currentPassword"
                type="password"
                required
                autoComplete="current-password"
              />
            </label>
            <label className="field">
              New password
              <input
                name="password"
                type="password"
                minLength={10}
                maxLength={128}
                required
                autoComplete="new-password"
              />
            </label>
            {password.error && (
              <p className="form-error">{password.error.message}</p>
            )}
            <Button variant="outline" disabled={password.isPending}>
              Change password
            </Button>
          </form>
          <div className="mt">
            <h3>Your neighbourhood activity</h3>
            <div className="stack">
              <Link className="text-link" href="/transactions">
                View your reservations →
              </Link>
              <Link className="text-link" href="/requests">
                View your price requests →
              </Link>
              <Link className="text-link" href="/favorites">
                View your saved finds →
              </Link>
            </div>
          </div>
        </section>
      </div>
    </div>
  );
}
