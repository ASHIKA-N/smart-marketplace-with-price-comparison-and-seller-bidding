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
} from "../../../../packages/shared/src";
type Dashboard = {
  shops: Shop[];
  products: Product[];
  listings: Listing[];
  offers: Offer[];
  transactions: Transaction[];
  requests: BidRequest[];
  bids: Bid[];
};
const navigation = [
  { path: "", label: "Overview", icon: LayoutDashboard },
  { path: "/shop", label: "My shop", icon: Store },
  { path: "/listings", label: "Listings & stock", icon: Package },
  { path: "/products", label: "Product catalog", icon: Tags },
  { path: "/offers", label: "Offers", icon: TrendingUp },
  { path: "/transactions", label: "Reservations", icon: ShoppingBag },
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
      label: "Completed sales",
      value: completed.length,
      note: "From this account’s reservations",
      icon: ShoppingBag,
    },
    {
      label: "Sales value",
      value: money(completed.reduce((sum, t) => sum + t.total, 0)),
      note: "Completed reservations only",
      icon: TrendingUp,
    },
    {
      label: "Shop trust",
      value: `${d.shops[0]?.trust || 0}/100`,
      note: "Built through great experiences",
      icon: ShieldCheck,
    },
  ];
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
          <h2>Make a good first impression.</h2>
          <p className="muted">
            An up-to-date storefront gives your neighbours more reasons to stop
            by.
          </p>
          <div className="stack">
            <Link className="text-link" href="/seller/shop">
              Edit your shop profile →
            </Link>
            <Link className="text-link" href="/seller/listings">
              Add products and update stock →
            </Link>
            <Link className="text-link" href="/seller/offers">
              Create a neighbourhood offer →
            </Link>
          </div>
        </div>
        <div className="panel">
          <h2>Your next opportunities</h2>
          <div className="stack">
            <p className="muted">
              <strong>
                {d.transactions.filter((t) => t.status === "INITIATED").length}
              </strong>{" "}
              reservations waiting for confirmation.
            </p>
            <p className="muted">
              <strong>{d.requests.length}</strong> open price requests from
              buyers.
            </p>
            <Button asChild variant="outline">
              <Link href="/seller/bids">
                Explore buyer requests
                <ArrowRight size={15} />
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
              setId(e.target.value);
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
          save.mutate({
            name: f.get("name"),
            description: f.get("description"),
            address: f.get("address"),
            phone: f.get("phone"),
            lat: Number(f.get("lat")),
            lng: Number(f.get("lng")),
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
          <label className="field full">
            Address
            <input
              name="address"
              required
              minLength={5}
              maxLength={300}
              defaultValue={shop?.address}
              placeholder="Street, neighbourhood, city"
            />
          </label>
          <label className="field">
            Latitude
            <input
              name="lat"
              type="number"
              step="any"
              required
              min={-90}
              max={90}
              defaultValue={shop?.lat || 12.9352}
            />
          </label>
          <label className="field">
            Longitude
            <input
              name="lng"
              type="number"
              step="any"
              required
              min={-180}
              max={180}
              defaultValue={shop?.lng || 77.6245}
            />
          </label>
          <label className="field full">
            Phone number
            <input
              name="phone"
              type="tel"
              minLength={7}
              maxLength={25}
              required
              defaultValue={shop?.phone}
              placeholder="+91 …"
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
            save.mutate({
              shopId: f.get("shopId"),
              productId: f.get("productId"),
              price: Number(f.get("price")),
              stock: Number(f.get("stock")),
              active: f.get("active") === "on",
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
  const save = useSave(`/transactions/${selected?.id}`, "PATCH", () =>
    setSelected(null),
  );
  return (
    <>
      <h2 className="section-title">Your neighbours are shopping.</h2>
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
          if (!v) setSelected(null);
        }}
        title={
          selected?.status === "COMPLETED"
            ? "Has your neighbour picked up?"
            : selected?.status === "CANCELLED"
              ? "Cancel this reservation?"
              : "Ready for your neighbour?"
        }
        description={
          selected?.status === "COMPLETED"
            ? "Confirm only after the buyer has collected and paid for their items. This enables a verified review."
            : selected?.status === "CANCELLED"
              ? "Reserved stock will be released and the buyer will be notified."
              : "Confirm the stock is ready for pickup. The buyer will receive an update."
        }
      >
        <div className="stack">
          {save.error && <p className="form-error">{save.error.message}</p>}
          <Button
            disabled={save.isPending}
            onClick={() => save.mutate({ status: selected?.status })}
          >
            Confirm update
          </Button>
          <Button variant="outline" onClick={() => setSelected(null)}>
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
