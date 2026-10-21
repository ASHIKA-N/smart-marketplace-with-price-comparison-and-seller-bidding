"use client";
import Link from "next/link";
import Image from "next/image";
import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  LayoutDashboard,
  Store,
  Package,
  Tags,
  ShoppingBag,
  MessageSquare,
  Plus,
  ArrowRight,
  TrendingUp,
  ShieldCheck,
  Pencil,
  Star,
} from "lucide-react";
import { api } from "@/lib/api";
import { useToast } from "./providers";
import {
  AuthRequired,
  PageIntro,
  Loading,
  ErrorState,
  EmptyState,
} from "./shell";
import { Button } from "./ui/button";
import { Dialog } from "./ui/dialog";
import { categories } from "./home";
import {
  money,
  type Shop,
  type Product,
  type Listing,
  type Offer,
  type Transaction,
  type BidRequest,
  type Bid,
  type ListingBid,
  type Review,
  POPULAR_LOCATIONS,
  isValidCoordinate,
} from "../../../../packages/shared/src";
type Dashboard = {
  shops: Shop[];
  products: Product[];
  listings: Listing[];
  offers: Offer[];
  transactions: Transaction[];
  requests: BidRequest[];
  bids: Bid[];
  listingBids: ListingBid[];
  reviews?: (Review & { product?: Product; shop?: Shop })[];
};
const navigation = [
  { path: "", label: "Overview", icon: LayoutDashboard },
  { path: "/shop", label: "My shop", icon: Store },
  { path: "/listings", label: "Listings & stock", icon: Package },
  { path: "/products", label: "Product catalog", icon: Tags },
  { path: "/offers", label: "Offers", icon: TrendingUp },
  { path: "/transactions", label: "Reservations", icon: ShoppingBag },
  { path: "/listing-bids", label: "Incoming Bids", icon: MessageSquare },
  { path: "/reviews", label: "Customer reviews", icon: Star },
  { path: "/bids", label: "Buyer requests", icon: MessageSquare },
];
export function SellerPage({ tab = "" }: { tab?: string }) {
  return (
    <AuthRequired seller>
      <DashboardPage tab={tab} />
    </AuthRequired>
  );
}
function DashboardPage({ tab }: { tab: string }) {
  const { data, isPending, error, refetch } = useQuery({
    queryKey: ["seller"],
    refetchInterval: 15000,
    queryFn: () => api<Dashboard>("/seller"),
  });
  return (
    <div className="container page-body">
      <PageIntro
        eyebrow="YOUR NEIGHBOURHOOD BUSINESS"
        title={
          tab === ""
            ? "Good things are growing."
            : navigation.find((n) => n.path === `/${tab}`)?.label ||
              "Seller dashboard"
        }
        description="A little closer to your customers. A little more room to grow."
      >
        {data?.shops[0] && (
          <Button asChild variant="outline">
            <Link href={`/shops/${data.shops[0].id}`}>
              View storefront
              <ArrowRight size={15} />
            </Link>
          </Button>
        )}
      </PageIntro>
      <div className="dashboard-layout">
        <aside className="dashboard-nav">
          {navigation.map((n) => (
            <Link
              key={n.path}
              className={n.path === (tab ? `/${tab}` : "") ? "active" : ""}
              href={`/seller${n.path}`}
            >
              <n.icon />
              {n.label}
            </Link>
          ))}
        </aside>
        <div>
          {isPending ? (
            <Loading />
          ) : error ? (
            <ErrorState error={error} retry={() => refetch()} />
          ) : data ? (
            <>
              {tab === "shop" ? (
                <ShopEditor data={data} />
              ) : tab === "products" ? (
                <ProductsEditor data={data} />
              ) : !data.shops.length ? (
                <EmptyState
                  title="Let’s put your shop on the map"
                  description="Tell your neighbours a little about your business, then add your first listing."
                  href="/seller/shop"
                  label="Create your shop"
                />
              ) : tab === "listing-bids" ? (
                <IncomingBidsPanel data={data} />
              ) : tab === "reviews" ? (
                <ReviewsPanel data={data} />
              ) : tab === "listings" ? (
                <ListingsEditor data={data} />
              ) : tab === "offers" ? (
                <OffersEditor data={data} />
              ) : tab === "transactions" ? (
                <SellerTransactions data={data} />
              ) : tab === "bids" ? (
                <BidsEditor data={data} />
              ) : (
                <Overview data={data} />
              )}
            </>
          ) : null}
        </div>
      </div>
    </div>
  );
}
function Overview({ data: d }: { data: Dashboard }) {
  const completed = d.transactions.filter((t) => t.status === "COMPLETED");
  const stats = [
    {
      label: "Your listings",
      value: d.listings.length,
      note: `${d.listings.filter((l) => l.stock < 5).length} running low on stock`,
      icon: Package,
    },
    {
      label: "Fixed-price listings",
      value: d.listings.filter(l => (l.pricingMode ?? "FIXED") === "FIXED").length,
      note: "Listings with a set price",
      icon: Tags,
    },
    {
      label: "Active listings",
      value: d.listings.filter((l) => l.active).length,
      note: `${d.listings.filter((l) => l.active && l.stock < 5).length} low on stock`,
      icon: Package,
    },
    {
      label: "Available inventory",
      value: `${d.listings.filter((l) => l.active).reduce((sum, l) => sum + (l.stock || 0), 0)} pcs`,
      note: "Total stock units across listings",
      icon: Tags,
    },
    {
      label: "Pending reservations",
      value: d.transactions.filter((t) => ["INITIATED", "CONFIRMED"].includes(t.status)).length,
      note: "Pickup orders waiting fulfillment",
      icon: ShoppingBag,
    },
    {
      label: "Pending bids",
      value: (d.listingBids ?? []).filter((b) => b.status === "PENDING").length,
      note: "Awaiting your decision",
      icon: MessageSquare,
    },
    {
      label: "Completed sales",
      value: completed.length,
      note: "From this account’s reservations",
      icon: ShoppingBag,
    },
    {
      label: "Sales revenue",
      value: money(completed.reduce((sum, t) => sum + t.total, 0)),
      note: "Completed reservations only",
      icon: TrendingUp,
    },
    {
      label: "Shop trust",
      value: `${d.shops[0]?.trust || 0}/100`,
      note: "Built through verified experiences",
      icon: ShieldCheck,
    },
  ];
  const recentTransactions = d.transactions.slice().reverse().slice(0, 5);
  const recentBids = (d.listingBids ?? []).slice().reverse().slice(0, 5);

  return (
    <>
      <div className="stat-grid">
        {stats.map((s) => (
          <div className="stat-card" key={s.label}>
            <span>
              {s.label}
              <s.icon />
            </span>
            <strong>{s.value}</strong>
            <small>{s.note}</small>
          </div>
        ))}
      </div>
      <div className="two-columns">
        <div className="panel">
          <h2>Recent Activity</h2>
          <p className="muted" style={{ marginBottom: "14px" }}>
            Latest orders and buyer interactions across your storefronts.
          </p>
          {recentTransactions.length === 0 && recentBids.length === 0 ? (
            <p className="muted">No recent activity recorded yet.</p>
          ) : (
            <div className="stack" style={{ gap: "10px" }}>
              {recentTransactions.map((t) => {
                const prod = d.products.find((p) => p.id === t.productId);
                return (
                  <div
                    key={t.id}
                    style={{
                      display: "flex",
                      justifyContent: "space-between",
                      alignItems: "center",
                      padding: "8px 12px",
                      background: "var(--light)",
                      borderRadius: "6px",
                      fontSize: "12px",
                    }}
                  >
                    <div>
                      <strong>Reservation #{t.id.slice(0, 6)}</strong> ·{" "}
                      <span>{prod?.name || "Product"} (Qty: {t.quantity})</span>
                    </div>
                    <span
                      className={`badge ${t.status === "COMPLETED" ? "green" : t.status === "CANCELLED" ? "gray" : "amber"}`}
                      style={{ fontSize: "10px" }}
                    >
                      {t.status}
                    </span>
                  </div>
                );
              })}
              {recentBids.map((b) => {
                const prod = d.products.find((p) => p.id === b.productId);
                return (
                  <div
                    key={b.id}
                    style={{
                      display: "flex",
                      justifyContent: "space-between",
                      alignItems: "center",
                      padding: "8px 12px",
                      background: "var(--light)",
                      borderRadius: "6px",
                      fontSize: "12px",
                    }}
                  >
                    <div>
                      <strong>Buyer Offer</strong> ·{" "}
                      <span>{prod?.name || "Item"} at {money(b.offeredPrice)}</span>
                    </div>
                    <span
                      className={`badge ${b.status === "ACCEPTED" ? "green" : b.status === "REJECTED" ? "gray" : "amber"}`}
                      style={{ fontSize: "10px" }}
                    >
                      {b.status}
                    </span>
                  </div>
                );
              })}
            </div>
          )}
        </div>
        <div className="panel">
          <h2>Storefront Management</h2>
          <p className="muted" style={{ marginBottom: "12px" }}>
            An up-to-date storefront gives your neighbours more reasons to stop by.
          </p>
          <div className="stack" style={{ marginBottom: "16px" }}>
            <Link className="text-link" href="/seller/shop">
              Edit your shop profile & coordinates →
            </Link>
            <Link className="text-link" href="/seller/listings">
              Add products & configure Fixed/Bidding pricing →
            </Link>
            <Link className="text-link" href="/seller/listing-bids">
              Review and accept/reject buyer bids →
            </Link>
            <Link className="text-link" href="/seller/reviews">
              View customer ratings & post replies →
            </Link>
          </div>
          <div style={{ borderTop: "1px solid var(--border)", paddingTop: "14px" }}>
            <p className="muted" style={{ marginBottom: "6px" }}>
              <strong>{d.transactions.filter((t) => t.status === "INITIATED").length}</strong> reservations waiting for confirmation.
            </p>
            <p className="muted" style={{ marginBottom: "10px" }}>
              <strong>{d.requests.length}</strong> open price requests from buyers.
            </p>
            <Button asChild variant="outline" size="sm">
              <Link href="/seller/bids">
                Explore buyer requests <ArrowRight size={14} />
              </Link>
            </Button>
          </div>
        </div>
      </div>
      <div className="panel mt">
        <h2>Trust is earned, one neighbour at a time.</h2>
        <p className="muted">
          Your score combines shop verification (25 points), completed purchases
          (up to 25), customer ratings (up to 40), and a complete profile (10).
          Keep your listings accurate and your customers informed.
        </p>
      </div>
    </>
  );
}
function useSave(path: string, method = "POST", onDone?: () => void) {
  const cache = useQueryClient();
  const toast = useToast();
  return useMutation({
    mutationFn: (body: unknown) => api(path, { method, body }),
    onSuccess: () => {
      void cache.invalidateQueries();
      toast("Saved. Your neighbourhood is up to date.");
      onDone?.();
    },
  });
}
function ShopEditor({ data }: { data: Dashboard }) {
  const [id, setId] = useState(data.shops[0]?.id || "");
  const shop = data.shops.find((s) => s.id === id);
  const save = useSave(id ? `/shops/${id}` : "/shops", id ? "PATCH" : "POST");
  const toast = useToast();
  const [shopLat, setShopLat] = useState<number | string>(shop?.lat ?? 12.9352);
  const [shopLng, setShopLng] = useState<number | string>(shop?.lng ?? 77.6245);
  const [address, setAddress] = useState(shop?.address || "");
  const [lastResolvedAddress, setLastResolvedAddress] = useState(shop?.address || "");
  const [resolving, setResolving] = useState(false);

  async function resolveAddress() {
    if (!address || address.trim().length < 3) {
      toast("Please enter a valid shop address to resolve coordinates.");
      return;
    }
    setResolving(true);
    try {
      const res = await api<{ results: { name: string; lat: number; lng: number; displayName: string }[] }>(
        `/geocode?q=${encodeURIComponent(address.trim())}`
      );
      if (res.results && res.results.length > 0) {
        const match = res.results[0];
        setShopLat(match.lat);
        setShopLng(match.lng);
        setLastResolvedAddress(address);
        toast(`Resolved coordinates: ${match.displayName}`);
      } else {
        toast("Could not automatically resolve address. Please check spelling or enter coordinates manually.");
      }
    } catch {
      toast("Geocoding service unavailable. Please enter coordinates manually.");
    } finally {
      setResolving(false);
    }
  }
  return (
    <section className="panel">
      <div className="row spread">
        <h2>
          {shop ? "Your shop, your story." : "Welcome your neighbourhood."}
        </h2>
        {data.shops.length > 0 && (
          <select
            className="control"
            style={{ width: 180 }}
            value={id}
            onChange={(e) => {
              const newId = e.target.value;
              setId(newId);
              const found = data.shops.find((s) => s.id === newId);
              setShopLat(found?.lat ?? 12.9352);
              setShopLng(found?.lng ?? 77.6245);
              setAddress(found?.address || "");
              setLastResolvedAddress(found?.address || "");
              save.reset();
            }}
          >
            <option value="">Create another shop</option>
            {data.shops.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
              </option>
            ))}
          </select>
        )}
      </div>
      <form
        key={id}
        className="stack"
        onSubmit={(e) => {
          e.preventDefault();
          const f = new FormData(e.currentTarget);
          const latNum = Number(f.get("lat"));
          const lngNum = Number(f.get("lng"));
          if (!isValidCoordinate(latNum, lngNum)) {
            toast("Coordinates must be valid numbers (Latitude -90 to 90, Longitude -180 to 180).");
            return;
          }
          const rawPhone = String(f.get("phone") || "").trim();
          if (!/^\d{10}$/.test(rawPhone)) {
            toast("Phone number must be exactly 10 digits.");
            return;
          }
          save.mutate({
            name: f.get("name"),
            description: f.get("description"),
            address: f.get("address"),
            phone: rawPhone,
            lat: latNum,
            lng: lngNum,
            image: f.get("image"),
            hours: {
              open: f.get("open"),
              close: f.get("close"),
              days: f.getAll("days").map(Number),
            },
          });
        }}
      >
        <div className="form-grid">
          <label className="field full">
            Shop name
            <input
              name="name"
              required
              minLength={3}
              maxLength={100}
              defaultValue={shop?.name}
              placeholder="Your neighbourhood shop"
            />
          </label>
          <label className="field full">
            Tell your story
            <textarea
              name="description"
              required
              minLength={10}
              maxLength={2000}
              defaultValue={shop?.description}
              placeholder="What makes your shop special?"
            />
          </label>
          <div className="field full">
            <label style={{ display: "block", marginBottom: "6px" }}>
              Address
            </label>
            <div style={{ display: "flex", gap: "8px", flexWrap: "wrap" }}>
              <input
                name="address"
                required
                minLength={5}
                maxLength={300}
                style={{ flex: 1, minWidth: "250px" }}
                value={address}
                onChange={(e) => setAddress(e.target.value)}
                placeholder="Street, neighbourhood, city"
              />
              <Button
                type="button"
                variant="outline"
                size="sm"
                disabled={resolving || !address.trim()}
                onClick={() => void resolveAddress()}
              >
                {resolving ? "Resolving…" : "Resolve coordinates from address"}
              </Button>
            </div>
            {address.trim() && lastResolvedAddress && address.trim() !== lastResolvedAddress.trim() && (
              <small style={{ color: "var(--muted)", marginTop: "4px", display: "block" }}>
                Address changed since last resolution. Click &quot;Resolve coordinates from address&quot; or check latitude/longitude below to prevent stale coordinates.
              </small>
            )}
          </div>
          <div className="field full">
            Shop coordinates helper
            <div className="row" style={{ gap: "8px", flexWrap: "wrap", alignItems: "center" }}>
              <select
                className="control"
                style={{ width: "auto" }}
                aria-label="Pick popular location preset"
                onChange={(e) => {
                  const found = POPULAR_LOCATIONS.find((n) => n.name === e.target.value);
                  if (found) {
                    setShopLat(found.lat);
                    setShopLng(found.lng);
                    setLastResolvedAddress(found.name);
                    toast(`Coordinates set to ${found.name}`);
                  }
                }}
                defaultValue=""
              >
                <option value="" disabled>Pick coordinates from popular locations…</option>
                {POPULAR_LOCATIONS.map((n) => (
                  <option key={n.name} value={n.name}>{n.name}</option>
                ))}
              </select>
            </div>
          </div>
          <label className="field">
            Latitude (-90 to 90)
            <input
              name="lat"
              type="number"
              step="any"
              required
              min={-90}
              max={90}
              value={shopLat}
              onChange={(e) => setShopLat(e.target.value)}
            />
          </label>
          <label className="field">
            Longitude (-180 to 180)
            <input
              name="lng"
              type="number"
              step="any"
              required
              min={-180}
              max={180}
              value={shopLng}
              onChange={(e) => setShopLng(e.target.value)}
            />
          </label>
          <label className="field full">
            Phone number (10 digits)
            <input
              name="phone"
              type="tel"
              pattern="[0-9]{10}"
              minLength={10}
              maxLength={10}
              required
              defaultValue={shop?.phone ? shop.phone.replace(/\D/g, "").slice(-10) : ""}
              placeholder="10-digit mobile number"
              title="Please enter a 10-digit phone number"
            />
          </label>
          <label className="field">
            Opening time (IST)
            <input
              name="open"
              type="time"
              required
              defaultValue={shop?.hours.open || "09:00"}
            />
          </label>
          <label className="field">
            Closing time (IST)
            <input
              name="close"
              type="time"
              required
              defaultValue={shop?.hours.close || "21:00"}
            />
          </label>
          <div className="field full">
            Open on
            <div className="row">
              {["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map(
                (day, i) => (
                  <label key={day} className="checkbox">
                    <input
                      name="days"
                      type="checkbox"
                      value={i}
                      defaultChecked={shop ? shop.hours.days.includes(i) : true}
                    />
                    {day}
                  </label>
                ),
              )}
            </div>
          </div>
          <label className="field full">
            Cover image URL
            <input
              name="image"
              type="text"
              required
              defaultValue={
                shop?.image || "/images/photo-1441986300917-64674bd600d8.jpg"
              }
              placeholder="https://images.unsplash.com/…"
            />
            <span className="muted">
              Use an images.unsplash.com image URL in this release.
            </span>
          </label>
        </div>
        {save.error && <p className="form-error">{save.error.message}</p>}
        <Button disabled={save.isPending}>
          {save.isPending
            ? "Saving…"
            : shop
              ? "Save shop details"
              : "Create your shop"}
        </Button>
      </form>
    </section>
  );
}
function ProductsEditor({ data }: { data: Dashboard }) {
  const [open, setOpen] = useState(false);
  const save = useSave("/products", "POST", () => setOpen(false));
  return (
    <>
      <div className="section-heading">
        <div>
          <h2>The product catalog</h2>
          <p>Shared products make comparing prices possible.</p>
        </div>
        <Button
          onClick={() => {
            save.reset();
            setOpen(true);
          }}
        >
          <Plus size={14} />
          New product
        </Button>
      </div>
      <div className="table-wrap">
        <table className="comparison-table">
          <thead>
            <tr>
              <th>Product</th>
              <th>Brand</th>
              <th>Category</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {data.products.map((p) => (
              <tr key={p.id}>
                <td>
                  <div className="shop-cell">
                    <Image src={p.image} alt="" width={40} height={40} />
                    <Link href={`/products/${p.id}`}>{p.name}</Link>
                  </div>
                </td>
                <td>{p.brand}</td>
                <td>{p.category}</td>
                <td>
                  {p.unique && <span className="badge">Local & unique</span>}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <Dialog
        open={open}
        onOpenChange={setOpen}
        title="Add a new find"
        description="Check the catalog first. If the product already exists, add a listing for it instead."
      >
        <form
          className="stack"
          onSubmit={(e) => {
            e.preventDefault();
            const f = new FormData(e.currentTarget);
            save.mutate({
              name: f.get("name"),
              brand: f.get("brand"),
              category: f.get("category"),
              description: f.get("description"),
              image: f.get("image"),
              unique: f.get("unique") === "on",
              tags: [],
            });
          }}
        >
          <label className="field">
            Product name
            <input name="name" minLength={3} maxLength={150} required />
          </label>
          <div className="form-grid">
            <label className="field">
              Brand
              <input
                name="brand"
                required
                maxLength={60}
                placeholder="Brand or local maker"
              />
            </label>
            <label className="field">
              Category
              <select name="category">
                {categories.map((c) => (
                  <option key={c.name}>{c.name}</option>
                ))}
              </select>
            </label>
          </div>
          <label className="field">
            Description
            <textarea
              name="description"
              minLength={10}
              maxLength={3000}
              required
            />
          </label>
          <label className="field">
            Product image URL
            <input
              name="image"
              type="url"
              required
              placeholder="https://images.unsplash.com/…"
            />
          </label>
          <label className="checkbox">
            <input name="unique" type="checkbox" />
            This is a locally made or unique product
          </label>
          {save.error && <p className="form-error">{save.error.message}</p>}
          <Button disabled={save.isPending}>Create product</Button>
        </form>
      </Dialog>
    </>
  );
}
function ListingsEditor({ data: d }: { data: Dashboard }) {
  const [edit, setEdit] = useState<Listing | null>(null);
  const [open, setOpen] = useState(false);
  const [pricingMode, setPricingMode] = useState<"FIXED" | "BIDDING">(edit?.pricingMode ?? "FIXED");
  const save = useSave(
    edit ? `/listings/${edit.id}` : "/listings",
    edit ? "PATCH" : "POST",
    () => setOpen(false),
  );
  return (
    <>
      <div className="section-heading">
        <div>
          <h2>Your shelf, online.</h2>
          <p>Keep prices and stock up to date.</p>
        </div>
        <Button
          onClick={() => {
            setEdit(null);
            save.reset();
            setOpen(true);
          }}
        >
          <Plus size={14} />
          Add listing
        </Button>
      </div>
      {d.listings.length ? (
        <div className="table-wrap">
          <table className="comparison-table">
            <thead>
              <tr>
                <th>Product</th>
                <th>Price</th>
                <th>Stock</th>
                <th>Mode</th>
                <th>Unit</th>
                <th>Status</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {d.listings.map((l) => {
                const p = d.products.find((p) => p.id === l.productId);
                return (
                  <tr key={l.id}>
                    <td>
                      <div className="shop-cell">
                        {p && (
                          <Image src={p.image} alt="" width={40} height={40} />
                        )}
                        <div>
                          {p?.name}
                          <small>
                            {d.shops.find((s) => s.id === l.shopId)?.name}
                          </small>
                        </div>
                      </div>
                    </td>
                    <td>{money(l.price)}</td>
                    <td>
                      <span className={`badge ${l.stock < 5 ? "amber" : ""}`}>
                        {l.stock} units
                      </span>
                    </td>
                    <td>
                      <span className={`badge ${l.pricingMode === "BIDDING" ? "amber" : ""}`}>
                        {l.pricingMode === "BIDDING" ? "Bidding" : "Fixed"}
                      </span>
                    </td>
                    <td>{l.unit || "—"}</td>
                    <td>{l.active ? "Active" : "Hidden"}</td>
                    <td>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => {
                          setEdit(l);
                          save.reset();
                          setOpen(true);
                        }}
                      >
                        <Pencil size={12} />
                        Edit
                      </Button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      ) : (
        <p className="empty-small">
          Your shelves are ready. Add your first listing above.
        </p>
      )}
      <Dialog
        open={open}
        onOpenChange={setOpen}
        title={edit ? "Update your listing" : "Put a good find on the shelf"}
        description="Your price and availability are shown alongside other local sellers."
      >
        <form
          className="stack"
          key={edit?.id || "new"}
          onSubmit={(e) => {
            e.preventDefault();
            const f = new FormData(e.currentTarget);
            const pm = f.get("pricingMode") as "FIXED" | "BIDDING" || pricingMode;
            save.mutate({
              shopId: f.get("shopId"),
              productId: f.get("productId"),
              price: Number(f.get("price")),
              stock: Number(f.get("stock")),
              active: f.get("active") === "on",
              pricingMode: pm,
              unit: f.get("unit") || "",
              minBid: pm === "BIDDING" && f.get("minBid") ? Number(f.get("minBid")) : undefined,
              biddingDeadline: pm === "BIDDING" && f.get("biddingDeadline")
                ? new Date(String(f.get("biddingDeadline"))).toISOString()
                : undefined,
              biddingOpen: pm === "BIDDING" ? f.get("biddingOpen") === "on" : true,
            });
          }}
        >
          <label className="field">
            Shop
            <select name="shopId" defaultValue={edit?.shopId}>
              {d.shops.map((s) => (
                <option value={s.id} key={s.id}>
                  {s.name}
                </option>
              ))}
            </select>
          </label>
          <label className="field">
            Product
            <select name="productId" defaultValue={edit?.productId}>
              {d.products.map((p) => (
                <option value={p.id} key={p.id}>
                  {p.name}
                </option>
              ))}
            </select>
          </label>
          <div className="form-grid">
            <label className="field">
              Price (₹)
              <input
                name="price"
                type="number"
                min="0.01"
                step="0.01"
                max="10000000"
                required
                defaultValue={edit?.price}
              />
            </label>
            <label className="field">
              Stock quantity
              <input
                name="stock"
                type="number"
                min="0"
                max="100000"
                required
                defaultValue={edit?.stock ?? 1}
              />
            </label>
          </div>
          <label className="checkbox">
            <input
              name="active"
              type="checkbox"
              defaultChecked={edit?.active ?? true}
            />
            Visible to buyers
          </label>
          <div className="field full">
            Pricing mode
            <div className="row">
              <label className="checkbox">
                <input type="radio" name="pricingMode" value="FIXED"
                  checked={pricingMode === "FIXED"} onChange={() => setPricingMode("FIXED")} />
                Fixed Price — buyers pay your listed price
              </label>
              <label className="checkbox">
                <input type="radio" name="pricingMode" value="BIDDING"
                  checked={pricingMode === "BIDDING"} onChange={() => setPricingMode("BIDDING")} />
                Price Bidding — buyers submit offers
              </label>
            </div>
          </div>
          <label className="field">
            Unit of measurement
            <input name="unit" maxLength={20} defaultValue={edit?.unit || ""} placeholder="kg, pcs, each, …" />
          </label>
          {pricingMode === "BIDDING" && (
            <>
              <div className="form-grid">
                <label className="field">
                  Minimum bid (₹)
                  <input name="minBid" type="number" min="0.01" step="0.01" max="10000000" defaultValue={edit?.minBid} />
                </label>
                <label className="field">
                  Bidding deadline (optional)
                  <input name="biddingDeadline" type="datetime-local" defaultValue={edit?.biddingDeadline ? edit.biddingDeadline.slice(0,16) : ""} />
                </label>
              </div>
              <label className="checkbox">
                <input name="biddingOpen" type="checkbox" defaultChecked={edit?.biddingOpen !== false} />
                Bidding is currently open
              </label>
            </>
          )}
          {save.error && <p className="form-error">{save.error.message}</p>}
          <Button disabled={save.isPending}>Save listing</Button>
        </form>
      </Dialog>
    </>
  );
}
function OffersEditor({ data: d }: { data: Dashboard }) {
  const [open, setOpen] = useState(false);
  const save = useSave("/offers", "POST", () => setOpen(false));
  return (
    <>
      <div className="section-heading">
        <div>
          <h2>A reason to stop by.</h2>
          <p>Create offers your neighbours will love.</p>
        </div>
        <Button
          disabled={!d.listings.length}
          onClick={() => {
            save.reset();
            setOpen(true);
          }}
        >
          <Plus size={14} />
          Create offer
        </Button>
      </div>
      {d.offers.length ? (
        d.offers.map((o) => {
          const l = d.listings.find((l) => l.id === o.listingId);
          return (
            <div className="panel mb" key={o.id}>
              <div className="row spread">
                <div>
                  <h3>{o.title}</h3>
                  <p className="muted">
                    {d.products.find((p) => p.id === l?.productId)?.name}
                  </p>
                </div>
                <span className="badge">
                  {o.type === "PERCENT" ? `${o.value}%` : money(o.value)} off
                </span>
              </div>
              <p className="muted mt">
                {new Date(o.startsAt).toLocaleDateString()} –{" "}
                {new Date(o.endsAt).toLocaleDateString()} ·{" "}
                {new Date(o.endsAt) < new Date()
                  ? "Expired"
                  : new Date(o.startsAt) > new Date()
                    ? "Scheduled"
                    : "Active"}
              </p>
            </div>
          );
        })
      ) : (
        <p className="empty-small">
          Create a listing, then give your neighbours a little extra reason to
          choose you.
        </p>
      )}
      <Dialog
        open={open}
        onOpenChange={setOpen}
        title="Make someone’s day"
        description="Active discounts are automatically included in price comparisons."
      >
        <form
          className="stack"
          onSubmit={(e) => {
            e.preventDefault();
            const f = new FormData(e.currentTarget);
            save.mutate({
              title: f.get("title"),
              listingId: f.get("listingId"),
              type: f.get("type"),
              value: Number(f.get("value")),
              startsAt: new Date(String(f.get("startsAt"))).toISOString(),
              endsAt: new Date(String(f.get("endsAt"))).toISOString(),
              enabled: true,
            });
          }}
        >
          <label className="field">
            Offer title
            <input
              name="title"
              required
              minLength={3}
              maxLength={100}
              placeholder="A little neighbourhood treat"
            />
          </label>
          <label className="field">
            Listing
            <select name="listingId">
              {d.listings.map((l) => (
                <option key={l.id} value={l.id}>
                  {d.products.find((p) => p.id === l.productId)?.name} ·{" "}
                  {money(l.price)}
                </option>
              ))}
            </select>
          </label>
          <div className="form-grid">
            <label className="field">
              Discount type
              <select name="type">
                <option value="PERCENT">Percentage</option>
                <option value="FIXED">Fixed amount (₹)</option>
              </select>
            </label>
            <label className="field">
              Discount value
              <input
                name="value"
                type="number"
                min="0.01"
                step="0.01"
                required
              />
            </label>
            <label className="field">
              Starts
              <input name="startsAt" type="datetime-local" required />
            </label>
            <label className="field">
              Ends
              <input name="endsAt" type="datetime-local" required />
            </label>
          </div>
          {save.error && <p className="form-error">{save.error.message}</p>}
          <Button disabled={save.isPending}>Create offer</Button>
        </form>
      </Dialog>
    </>
  );
}
function SellerTransactions({ data: d }: { data: Dashboard }) {
  const [selected, setSelected] = useState<{
    id: string;
    status: string;
  } | null>(null);
  const [otpInput, setOtpInput] = useState("");
  const save = useSave(`/transactions/${selected?.id}`, "PATCH", () => {
    setSelected(null);
    setOtpInput("");
  });
  return (
    <>
      <h2 className="section-title">Customer reservations</h2>
      <p className="muted mb">
        Confirm availability, prepare the items, then mark picked up and paid
        after collection. Cancelling releases reserved stock and notifies the
        customer. Updates refresh every 15 seconds.
      </p>
      {d.transactions.length ? (
        d.transactions
          .slice()
          .reverse()
          .map((t) => (
            <div className="panel mb" key={t.id}>
              <div className="row spread">
                <div>
                  <h3>{d.products.find((p) => p.id === t.productId)?.name}</h3>
                  <p className="muted">
                    {t.quantity} items · {money(t.total)} · #{t.id.slice(0, 8)}
                  </p>
                </div>
                <span className="badge">{t.status.toLowerCase()}</span>
              </div>
              <div className="row mt">
                {t.status === "INITIATED" && (
                  <Button
                    size="sm"
                    onClick={() => {
                      save.reset();
                      setOtpInput("");
                      setSelected({ id: t.id, status: "CONFIRMED" });
                    }}
                  >
                    Confirm reservation
                  </Button>
                )}
                {t.status === "CONFIRMED" && (
                  <Button
                    size="sm"
                    onClick={() => {
                      save.reset();
                      setOtpInput("");
                      setSelected({ id: t.id, status: "COMPLETED" });
                    }}
                  >
                    Mark picked up & paid
                  </Button>
                )}
                {["INITIATED", "CONFIRMED"].includes(t.status) && (
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => {
                      save.reset();
                      setOtpInput("");
                      setSelected({ id: t.id, status: "CANCELLED" });
                    }}
                  >
                    Cancel reservation
                  </Button>
                )}
              </div>
            </div>
          ))
      ) : (
        <p className="empty-small">New buyer reservations will appear here.</p>
      )}
      <Dialog
        open={!!selected}
        onOpenChange={(v) => {
          if (!v) {
            setSelected(null);
            setOtpInput("");
          }
        }}
        title={
          selected?.status === "COMPLETED"
            ? "Confirm customer pickup"
            : selected?.status === "CANCELLED"
              ? "Cancel this reservation?"
              : "Ready for your neighbour?"
        }
        description={
          selected?.status === "COMPLETED"
            ? "Ask the buyer for their 6-digit pickup OTP to verify the collection and payment."
            : selected?.status === "CANCELLED"
              ? "Reserved stock will be released and the buyer will be notified."
              : "Confirm the stock is ready for pickup. The buyer will receive an update."
        }
      >
        <div className="stack">
          {selected?.status === "COMPLETED" && (
            <div>
              <label
                htmlFor="pickup-otp-input"
                style={{
                  display: "block",
                  fontSize: "14px",
                  fontWeight: 600,
                  marginBottom: "6px",
                }}
              >
                Customer Pickup OTP (6 digits)
              </label>
              <input
                id="pickup-otp-input"
                type="text"
                inputMode="numeric"
                pattern="[0-9]*"
                maxLength={6}
                placeholder="Enter 6-digit OTP"
                value={otpInput}
                onChange={(e) =>
                  setOtpInput(e.target.value.replace(/\D/g, "").slice(0, 6))
                }
                style={{
                  width: "100%",
                  padding: "10px 14px",
                  fontSize: "18px",
                  letterSpacing: "4px",
                  textAlign: "center",
                  fontFamily: "monospace",
                  border: "1px solid var(--border)",
                  borderRadius: "8px",
                }}
                autoFocus
              />
              <p
                style={{
                  fontSize: "12px",
                  color: "var(--text-muted, #64748b)",
                  marginTop: "4px",
                }}
              >
                Ask the customer for the 6-digit code shown on their reservation page.
              </p>
            </div>
          )}
          {save.error && <p className="form-error">{save.error.message}</p>}
          <Button
            disabled={
              save.isPending ||
              (selected?.status === "COMPLETED" && otpInput.trim().length !== 6)
            }
            onClick={() =>
              save.mutate(
                selected?.status === "COMPLETED"
                  ? { status: selected.status, otp: otpInput.trim() }
                  : { status: selected?.status },
              )
            }
          >
            {selected?.status === "COMPLETED"
              ? "Verify OTP & Complete"
              : "Confirm update"}
          </Button>
          <Button
            variant="outline"
            onClick={() => {
              setSelected(null);
              setOtpInput("");
            }}
          >
            Go back
          </Button>
        </div>
      </Dialog>
    </>
  );
}
function BidsEditor({ data: d }: { data: Dashboard }) {
  const [request, setRequest] = useState<BidRequest | null>(null);
  const save = useSave("/bids", "POST", () => setRequest(null));
  return (
    <>
      <h2 className="section-title">Make your neighbour an offer.</h2>
      {d.requests.length ? (
        d.requests.map((r) => (
          <div className="panel mb" key={r.id}>
            <div className="row spread">
              <div>
                <h3>{d.products.find((p) => p.id === r.productId)?.name}</h3>
                <p className="muted">
                  Target {money(r.targetPrice)} / item · Quantity {r.quantity}
                </p>
                {r.note && <p className="muted mt">{r.note}</p>}
              </div>
              {d.bids.some((b) => b.requestId === r.id) ? (
                <span className="badge">Offer sent</span>
              ) : (
                <Button
                  size="sm"
                  onClick={() => {
                    save.reset();
                    setRequest(r);
                  }}
                >
                  Make an offer
                </Button>
              )}
            </div>
          </div>
        ))
      ) : (
        <p className="empty-small">
          No open requests yet. New opportunities will appear here.
        </p>
      )}
      <Dialog
        open={!!request}
        onOpenChange={(v) => {
          if (!v) setRequest(null);
        }}
        title="Your best local offer"
        description="Your shop needs an active listing with enough stock for this product."
      >
        <form
          className="stack"
          onSubmit={(e) => {
            e.preventDefault();
            const f = new FormData(e.currentTarget);
            save.mutate({
              requestId: request?.id,
              shopId: f.get("shopId"),
              price: Number(f.get("price")),
              note: f.get("note"),
            });
          }}
        >
          <label className="field">
            Shop
            <select name="shopId">
              {d.shops.map((s) => (
                <option value={s.id} key={s.id}>
                  {s.name}
                </option>
              ))}
            </select>
          </label>
          <label className="field">
            Your price per item (₹)
            <input
              name="price"
              type="number"
              min="0.01"
              step="0.01"
              max="10000000"
              required
              defaultValue={request?.targetPrice}
            />
          </label>
          <label className="field">
            A personal note
            <textarea
              name="note"
              maxLength={500}
              placeholder="Pickup timing, product details, or a friendly hello…"
            />
          </label>
          {save.error && <p className="form-error">{save.error.message}</p>}
          <Button disabled={save.isPending}>Send your offer</Button>
        </form>
      </Dialog>
    </>
  );
}
function IncomingBidsPanel({ data: d }: { data: Dashboard }) {
  const [filter, setFilter] = useState<"ALL" | "PENDING" | "ACCEPTED" | "REJECTED">("PENDING");
  const cache = useQueryClient();
  const toast = useToast();

  const bids = (d.listingBids ?? []).filter(b => filter === "ALL" || b.status === filter);

  const handleAccept = (bidId: string) => {
    api(`/listing-bids/${bidId}/accept`, { method: "PATCH" })
      .then(() => { void cache.invalidateQueries(); toast("Bid accepted!"); })
      .catch((e: Error) => toast(e.message));
  };
  const handleReject = (bidId: string) => {
    api(`/listing-bids/${bidId}/reject`, { method: "PATCH" })
      .then(() => { void cache.invalidateQueries(); toast("Bid rejected."); })
      .catch((e: Error) => toast(e.message));
  };

  return (
    <>
      <div className="section-heading">
        <div>
          <h2>Incoming bids</h2>
          <p>Review offers from buyers on your bidding listings.</p>
        </div>
        <div className="row">
          {(["ALL", "PENDING", "ACCEPTED", "REJECTED"] as const).map(f => (
            <button key={f} className={`control ${filter === f ? "active" : ""}`}
              onClick={() => setFilter(f)} style={{ marginRight: 4 }}>
              {f === "ALL" ? "All" : f.charAt(0) + f.slice(1).toLowerCase()}
            </button>
          ))}
        </div>
      </div>
      {bids.length ? (
        bids.slice().reverse().map(bid => {
          const listing = d.listings.find(l => l.id === bid.listingId);
          const product = d.products.find(p => p.id === bid.productId);
          return (
            <div className="panel mb" key={bid.id}>
              <div className="row spread">
                <div>
                  <h3>{product?.name ?? bid.productId}</h3>
                  <p className="muted">
                    Offered {money(bid.offeredPrice)} · Qty {bid.quantity}{listing?.unit ? ` ${listing.unit}` : ""} · {new Date(bid.createdAt).toLocaleString()}
                  </p>
                  {bid.note && <p className="muted mt">{bid.note}</p>}
                </div>
                <span className={`badge ${bid.status === "ACCEPTED" ? "" : bid.status === "REJECTED" ? "amber" : ""}`}>
                  {bid.status.charAt(0) + bid.status.slice(1).toLowerCase()}
                </span>
              </div>
              {bid.status === "PENDING" && (
                <div className="row mt">
                  <Button size="sm" onClick={() => handleAccept(bid.id)}>Accept</Button>
                  <Button size="sm" variant="outline" onClick={() => handleReject(bid.id)}>Reject</Button>
                </div>
              )}
            </div>
          );
        })
      ) : (
        <p className="empty-small">
          {filter === "PENDING"
            ? "No pending bids. Buyers will see your bidding listings and submit offers."
            : "No bids match this filter."}
        </p>
      )}
    </>
  );
}

function ReviewsPanel({ data: d }: { data: Dashboard }) {
  const [filter, setFilter] = useState<"ALL" | "5" | "4" | "3" | "2" | "1" | "UNREPLIED">("ALL");
  const [replyingTo, setReplyingTo] = useState<string | null>(null);
  const [replyText, setReplyText] = useState("");
  const [submittingReply, setSubmittingReply] = useState(false);
  const cache = useQueryClient();
  const toast = useToast();

  const reviews = d.reviews || [];
  const total = reviews.length;
  const avgRating = total ? (reviews.reduce((sum, r) => sum + r.rating, 0) / total).toFixed(1) : "0.0";

  const distribution = [5, 4, 3, 2, 1].map((stars) => {
    const count = reviews.filter((r) => r.rating === stars).length;
    const pct = total ? Math.round((count / total) * 100) : 0;
    return { stars, count, pct };
  });

  const filtered = reviews.filter((r) => {
    if (filter === "ALL") return true;
    if (filter === "UNREPLIED") return !r.reply;
    return r.rating === Number(filter);
  });

  async function handleSendReply(reviewId: string) {
    if (!replyText.trim() || replyText.trim().length < 2) {
      toast("Please enter a response of at least 2 characters.");
      return;
    }
    setSubmittingReply(true);
    try {
      await api(`/reviews/${reviewId}/reply`, {
        method: "POST",
        body: { reply: replyText.trim() },
      });
      await cache.invalidateQueries();
      toast("Your reply has been published.");
      setReplyingTo(null);
      setReplyText("");
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Failed to post reply.";
      toast(msg);
    } finally {
      setSubmittingReply(false);
    }
  }

  return (
    <>
      <div className="section-heading">
        <div>
          <h2>Customer reviews &amp; ratings</h2>
          <p>Feedback from verified neighbours who purchased at your shop.</p>
        </div>
      </div>
      <div className="panel mb" style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: "20px", alignItems: "center" }}>
        <div style={{ textAlign: "center", padding: "10px" }}>
          <div style={{ fontSize: "40px", fontWeight: "bold", lineHeight: 1 }}>{avgRating}</div>
          <div style={{ color: "#f59e0b", fontSize: "18px", margin: "6px 0" }}>
            {"★".repeat(Math.round(Number(avgRating))) + "☆".repeat(5 - Math.round(Number(avgRating)))}
          </div>
          <p className="muted" style={{ margin: 0 }}>
            {total === 1 ? "1 verified review" : `${total} verified reviews`}
          </p>
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
          {distribution.map((d) => (
            <div key={d.stars} style={{ display: "flex", alignItems: "center", gap: "10px", fontSize: "13px" }}>
              <span style={{ width: "35px" }}>{d.stars} ★</span>
              <div style={{ flex: 1, height: "8px", background: "var(--border, #e5e7eb)", borderRadius: "4px", overflow: "hidden" }}>
                <div style={{ width: `${d.pct}%`, height: "100%", background: "#f59e0b" }} />
              </div>
              <span style={{ width: "30px", textAlign: "right", color: "var(--muted)" }}>{d.count}</span>
            </div>
          ))}
        </div>
      </div>
      <div className="row spread mb" style={{ alignItems: "center" }}>
        <div className="row" style={{ flexWrap: "wrap", gap: "6px" }}>
          {(["ALL", "5", "4", "3", "2", "1", "UNREPLIED"] as const).map((f) => (
            <button
              key={f}
              className={`control ${filter === f ? "active" : ""}`}
              onClick={() => setFilter(f)}
              style={{ fontSize: "12px", padding: "4px 10px" }}
            >
              {f === "ALL" ? "All" : f === "UNREPLIED" ? "Needs reply" : `${f} Stars`}
            </button>
          ))}
        </div>
        <span className="muted" style={{ fontSize: "13px" }}>{filtered.length} shown</span>
      </div>
      {filtered.length > 0 ? (
        filtered.slice().reverse().map((r) => (
          <div className="panel mb" key={r.id}>
            <div className="row spread" style={{ alignItems: "flex-start" }}>
              <div>
                <div className="row" style={{ gap: "8px", alignItems: "center" }}>
                  <span style={{ color: "#f59e0b", fontWeight: "bold" }}>
                    {"★".repeat(r.rating) + "☆".repeat(5 - r.rating)}
                  </span>
                  <strong>{r.userName || "Verified Buyer"}</strong>
                  <span className="badge">Verified purchase</span>
                </div>
                <small className="muted" style={{ display: "block", marginTop: "4px" }}>
                  {r.product ? `Product: ${r.product.name} · ` : ""}{new Date(r.createdAt).toLocaleDateString()}
                  {r.updatedAt ? " (edited)" : ""}
                </small>
              </div>
            </div>
            <p style={{ marginTop: "12px", whiteSpace: "pre-wrap" }}>{r.text}</p>
            {r.reply && (
              <div style={{ marginTop: "12px", padding: "10px 14px", background: "var(--surface-muted, #f3f4f6)", borderRadius: "8px", borderLeft: "3px solid var(--accent, #059669)" }}>
                <strong style={{ fontSize: "13px", display: "block" }}>Your response:</strong>
                <p style={{ margin: "4px 0 0", fontSize: "14px" }}>{r.reply}</p>
                {r.repliedAt && (
                  <small className="muted" style={{ fontSize: "11px" }}>
                    Replied on {new Date(r.repliedAt).toLocaleDateString()}
                  </small>
                )}
              </div>
            )}
            <div className="row mt" style={{ gap: "8px" }}>
              {replyingTo === r.id ? (
                <div className="stack" style={{ width: "100%", marginTop: "8px" }}>
                  <textarea
                    rows={3}
                    placeholder="Write a polite, professional reply to this customer…"
                    value={replyText}
                    onChange={(e) => setReplyText(e.target.value)}
                    maxLength={1000}
                    style={{ width: "100%", padding: "8px" }}
                  />
                  <div className="row" style={{ gap: "8px" }}>
                    <Button size="sm" disabled={submittingReply} onClick={() => void handleSendReply(r.id)}>
                      {submittingReply ? "Posting…" : "Post reply"}
                    </Button>
                    <Button size="sm" variant="outline" onClick={() => { setReplyingTo(null); setReplyText(""); }}>
                      Cancel
                    </Button>
                  </div>
                </div>
              ) : (
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => {
                    setReplyingTo(r.id);
                    setReplyText(r.reply || "");
                  }}
                >
                  {r.reply ? "Edit your reply" : "Reply to review"}
                </Button>
              )}
            </div>
          </div>
        ))
      ) : (
        <p className="empty-small">
          {total === 0
            ? "No reviews yet. As customers complete reservations at your shop, their verified feedback will appear here."
            : "No reviews match this filter."}
        </p>
      )}
    </>
  );
}
