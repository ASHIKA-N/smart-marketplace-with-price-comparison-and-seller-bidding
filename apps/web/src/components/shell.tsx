"use client";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useState, useEffect } from "react";
import {
  MapPin,
  ChevronDown,
  Search,
  Heart,
  ArrowUpRight,
  Store,
  Menu,
  X,
  LocateFixed,
  Bell,
  LogOut,
  ShoppingBag,
  SlidersHorizontal,
  Sparkles,
} from "lucide-react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useAuth, useLocation, useToast } from "./providers";
import { Button } from "./ui/button";
import { Dialog } from "./ui/dialog";
import { api } from "@/lib/api";
import { POPULAR_LOCATIONS, isValidCoordinate, type Notification } from "../../../../packages/shared/src";
export function Logo() {
  return (
    <Link href="/" className="logo" aria-label="Aroundly home">
      <span className="logo-mark">
        <MapPin size={24} strokeWidth={2.8} />
      </span>
      aroundly<span className="logo-dot">.</span>
    </Link>
  );
}
export function Shell({ children }: { children: React.ReactNode }) {
  const { data: health } = useQuery({
    queryKey: ["health"],
    queryFn: () => api<{ mode: string }>("/health"),
    staleTime: Infinity,
  });
  const cache = useQueryClient();
  const path = usePathname();
  const router = useRouter();
  const { user, logout } = useAuth();
  const { location, setLocation } = useLocation();
  const toast = useToast();
  const [locationOpen, setLocationOpen] = useState(false);
  const [menu, setMenu] = useState(false);
  const [notifications, setNotifications] = useState(false);
  const [locating, setLocating] = useState(false);
  const [locFilter, setLocFilter] = useState("");
  const [locError, setLocError] = useState("");
  const [showCustomCoord, setShowCustomCoord] = useState(false);
  const [geoResults, setGeoResults] = useState<{ name: string; lat: number; lng: number; displayName: string }[]>([]);
  const [searchingGeo, setSearchingGeo] = useState(false);

  async function searchOnlineLocation() {
    if (!locFilter || locFilter.trim().length < 2) return;
    setSearchingGeo(true);
    try {
      const res = await api<{ results: { name: string; lat: number; lng: number; displayName: string }[] }>(
        `/geocode?q=${encodeURIComponent(locFilter.trim())}`
      );
      setGeoResults(res.results || []);
      if (!res.results || res.results.length === 0) {
        toast("No geocoding results found. Try another term or enter custom coordinates below.");
      }
    } catch {
      toast("Could not reach location service. Enter custom coordinates below.");
    } finally {
      setSearchingGeo(false);
    }
  }
  const [customName, setCustomName] = useState("");
  const [customLat, setCustomLat] = useState("");
  const [customLng, setCustomLng] = useState("");
  const { data: notes = [] } = useQuery({
    queryKey: ["notifications", user?.id],
    queryFn: () => api<Notification[]>("/notifications"),
    enabled: !!user,
  });
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if (
        e.key === "/" &&
        !["INPUT", "TEXTAREA", "SELECT"].includes(
          (document.activeElement as HTMLElement)?.tagName,
        )
      ) {
        e.preventDefault();
        const input = document.getElementById(
          "header-search-input",
        ) as HTMLInputElement | null;
        input?.focus();
      }
    }
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, []);
  function locate() {
    setLocError("");
    if (!navigator.geolocation) {
      const msg = "Geolocation is not supported by your browser. Please choose or enter a neighbourhood below.";
      setLocError(msg);
      toast(msg);
      return;
    }
    setLocating(true);
    navigator.geolocation.getCurrentPosition(
      (p) => {
        setLocation({
          lat: p.coords.latitude,
          lng: p.coords.longitude,
          name: "Your current location",
        });
        setLocating(false);
        setLocationOpen(false);
        setLocError("");
        toast("Nearby results now use your location.");
      },
      (err) => {
        setLocating(false);
        const reason = err.code === 1 ? "Location permission denied." : err.code === 2 ? "Position unavailable." : "Location request timed out.";
        const msg = `${reason} Please search or select a neighbourhood below.`;
        setLocError(msg);
        toast(msg);
      },
      { timeout: 10000 },
    );
  }
  return (
    <>
      <div className="announcement">
        <span>
          <Sparkles size={13} />{" "}
          {health?.mode === "demo"
            ? "Demo marketplace · Sample shops and prices"
            : "Good finds. Great prices. Right around you."}
        </span>
        <Link href="/seller">
          Grow your local business <ArrowUpRight size={13} />
        </Link>
      </div>
      <header className="header">
        <div className="header-main">
          <Logo />
          <button
            className="location-button"
            onClick={() => setLocationOpen(true)}
          >
            <MapPin size={19} />
            <span>
              <small>Shopping around</small>
              <strong>{location.name}</strong>
            </span>
            <ChevronDown size={14} />
          </button>
          <form className="header-search" action="/search">
            <Search size={18} />
            <input
              id="header-search-input"
              name="q"
              aria-label="Search products"
              placeholder="Search for a product, brand, or store"
            />
            <kbd>/</kbd>
          </form>
          <div className="header-actions">
            <Link
              className="icon-link"
              href="/favorites"
              aria-label="Saved finds"
            >
              <Heart size={21} />
            </Link>
            <button
              className="icon-link notification-button"
              aria-label="Notifications"
              onClick={() =>
                user ? setNotifications(true) : router.push("/login")
              }
            >
              <Bell size={20} />
              {notes.some((n) => !n.read) && <i />}
            </button>
            {user ? (
              <Link
                className="avatar signed-in-account"
                href="/profile"
                aria-label="Your profile"
              >
                {user.name.charAt(0)}
                <span className="account-name">{user.name.split(" ")[0]}</span>
              </Link>
            ) : (
              <Button asChild variant="outline" size="sm">
                <Link href="/login">Sign in</Link>
              </Button>
            )}
            <button
              className="mobile-menu icon-link"
              aria-label="Toggle navigation"
              onClick={() => setMenu(!menu)}
            >
              {menu ? <X /> : <Menu />}
            </button>
          </div>
        </div>
        <div className={`nav-wrap ${menu ? "nav-open" : ""}`}>
          <nav className="main-nav" aria-label="Main navigation">
            {[
              { href: "/", label: "Discover" },
              { href: "/shops/nearby", label: "Nearby shops" },
              { href: "/search?sort=deal", label: "Best deals", badge: true },
              { href: "/search?unique=true", label: "Local & unique" },
              { href: "/requests", label: "Request a price" },
            ].map((n) => (
              <Link
                key={n.label}
                onClick={() => setMenu(false)}
                className={path === n.href ? "active" : ""}
                href={n.href}
              >
                {n.label}
                {n.badge && <span className="tiny-badge">HOT</span>}
              </Link>
            ))}
            <Link
              className="mobile-account"
              href={user ? "/profile" : "/login"}
              onClick={() => setMenu(false)}
            >
              {user ? "Your account" : "Sign in / Create account"}
            </Link>
            {user && (
              <button
                className="mobile-account"
                style={{
                  textAlign: "left",
                  background: "none",
                  border: "none",
                  cursor: "pointer",
                  display: "flex",
                  alignItems: "center",
                  gap: 8,
                  padding: "10px 14px",
                  fontSize: 14,
                  color: "inherit",
                }}
                onClick={async () => {
                  setMenu(false);
                  await logout();
                  router.push("/");
                }}
              >
                <LogOut size={16} /> Sign out
              </button>
            )}
            <Link
              className="seller-nav"
              href={
                user?.roles.includes("SELLER") ? "/seller" : "/seller/login"
              }
            >
              <Store size={16} /> Seller dashboard <ArrowUpRight size={14} />
            </Link>
          </nav>
        </div>
      </header>
      <main>{children}</main>
      <footer>
        <div className="footer-top">
          <div>
            <Logo />
            <p>
              A world of good finds.
              <br />A little closer to home.
            </p>
          </div>
          <div>
            <strong>Explore your neighbourhood</strong>
            <Link href="/search">Shop all products</Link>
            <Link href="/shops">Meet local sellers</Link>
            <Link href="/search?unique=true">Made locally</Link>
          </div>
          <div>
            <strong>Your Aroundly</strong>
            <Link href="/favorites">Saved finds</Link>
            <Link href="/transactions">Your reservations</Link>
            <Link href="/my-bids">Your bids</Link>
            <Link href="/seller">Become a seller</Link>
          </div>
          <div className="footer-note">
            <MapPin size={24} />
            <strong>
              Small distances.
              <br />
              Bigger possibilities.
            </strong>
            <p>
              Discover local. Compare confidently.
              <br />
              Support your community.
            </p>
          </div>
        </div>
        <div className="footer-bottom">
          <span>
            © {new Date().getFullYear()} Aroundly. Made for your neighbourhood.
          </span>
          <span>Prices in INR · Purchases paid at the shop</span>
        </div>
      </footer>
      <Dialog
        open={locationOpen}
        onOpenChange={(v) => {
          setLocationOpen(v);
          if (!v) {
            setLocError("");
            setLocFilter("");
          }
        }}
        title="Find your neighbourhood"
        description="We use your location to show nearby shops and calculate their distance. Your location history is not saved."
      >
        <div className="stack">
          <Button onClick={locate} disabled={locating}>
            <LocateFixed size={17} />
            {locating ? "Finding your location…" : "Use my current location"}
          </Button>
          {locError && <p className="form-error">{locError}</p>}
          <div className="row spread" style={{ alignItems: "center" }}>
            <span className="eyebrow" style={{ margin: 0 }}>CHOOSE OR SEARCH A NEIGHBOURHOOD</span>
            <button
              type="button"
              className="text-link"
              style={{ fontSize: "12px" }}
              onClick={() => {
                setLocation({ name: "T. Nagar, Chennai", lat: 13.0418, lng: 80.2341 });
                setLocationOpen(false);
                toast("Reset to default location (T. Nagar).");
              }}
            >
              Reset to default
            </button>
          </div>
          <div style={{ display: "flex", gap: "8px" }}>
            <input
              className="control"
              placeholder="Search city, area or neighbourhood…"
              aria-label="Filter locations"
              value={locFilter}
              onChange={(e) => {
                setLocFilter(e.target.value);
                setGeoResults([]);
              }}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  void searchOnlineLocation();
                }
              }}
            />
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={searchingGeo || !locFilter.trim()}
              onClick={() => void searchOnlineLocation()}
            >
              {searchingGeo ? "Searching…" : "Search"}
            </Button>
          </div>
          {geoResults.length > 0 && (
            <div style={{ maxHeight: "160px", overflowY: "auto", display: "flex", flexDirection: "column", gap: "6px", border: "1px solid var(--border, #e5e7eb)", borderRadius: "8px", padding: "6px" }}>
              <span className="eyebrow" style={{ margin: "4px 8px" }}>SEARCH RESULTS</span>
              {geoResults.map((r, i) => (
                <button
                  key={i}
                  className="location-option"
                  onClick={() => {
                    setLocation({ lat: r.lat, lng: r.lng, name: r.name });
                    setLocationOpen(false);
                    setGeoResults([]);
                    toast(`Location set to ${r.name}`);
                  }}
                >
                  <MapPin size={18} />
                  <span style={{ textAlign: "left", fontSize: "13px" }}>
                    <strong>{r.name}</strong>
                    <br />
                    <small style={{ color: "var(--muted)" }}>{r.displayName}</small>
                  </span>
                  <ArrowUpRight size={15} />
                </button>
              ))}
            </div>
          )}
          <div style={{ maxHeight: "200px", overflowY: "auto", display: "flex", flexDirection: "column", gap: "6px" }}>
            {POPULAR_LOCATIONS.filter((n) =>
              n.name.toLowerCase().includes(locFilter.toLowerCase().trim()) ||
              (n.city && n.city.toLowerCase().includes(locFilter.toLowerCase().trim()))
            ).map((l) => (
              <button
                className={`location-option ${location.name === l.name ? "selected" : ""}`}
                key={l.name}
                onClick={() => {
                  setLocation(l);
                  setLocationOpen(false);
                  toast(`Location set to ${l.name}`);
                }}
              >
                <MapPin size={18} />
                <span>{l.name}</span>
                <ArrowUpRight size={15} />
              </button>
            ))}
            {POPULAR_LOCATIONS.filter((n) =>
              n.name.toLowerCase().includes(locFilter.toLowerCase().trim()) ||
              (n.city && n.city.toLowerCase().includes(locFilter.toLowerCase().trim()))
            ).length === 0 && geoResults.length === 0 && (
              <p className="empty-small">No preset match. Click &quot;Search&quot; above to look up this address or enter custom coordinates below.</p>
            )}
          </div>
          <div style={{ borderTop: "1px solid var(--border, #e5e7eb)", paddingTop: "10px" }}>
            <button
              type="button"
              className="text-link"
              style={{ fontSize: "13px" }}
              onClick={() => setShowCustomCoord(!showCustomCoord)}
            >
              {showCustomCoord ? "Hide custom coordinates" : "Enter custom coordinates / area →"}
            </button>
            {showCustomCoord && (
              <form
                className="stack mt"
                onSubmit={(e) => {
                  e.preventDefault();
                  const latNum = parseFloat(customLat);
                  const lngNum = parseFloat(customLng);
                  if (isNaN(latNum) || isNaN(lngNum)) {
                    toast("Please enter valid numeric latitude and longitude.");
                    return;
                  }
                  if (!isValidCoordinate(latNum, lngNum)) {
                    toast("Coordinates must be valid numbers (Latitude: -90 to 90, Longitude: -180 to 180).");
                    return;
                  }
                  const name = customName.trim() || `Custom (${latNum.toFixed(4)}, ${lngNum.toFixed(4)})`;
                  setLocation({ lat: latNum, lng: lngNum, name });
                  setLocationOpen(false);
                  toast(`Location set to ${name}`);
                }}
              >
                <label className="field">
                  Area or Locality name
                  <input
                    placeholder="e.g. Near Phoenix Marketcity"
                    value={customName}
                    onChange={(e) => setCustomName(e.target.value)}
                    maxLength={100}
                  />
                </label>
                <div className="form-grid">
                  <label className="field">
                    Latitude (-90 to 90)
                    <input
                      type="number"
                      step="any"
                      min={-90}
                      max={90}
                      required
                      placeholder="12.9352"
                      value={customLat}
                      onChange={(e) => setCustomLat(e.target.value)}
                    />
                  </label>
                  <label className="field">
                    Longitude (-180 to 180)
                    <input
                      type="number"
                      step="any"
                      min={-180}
                      max={180}
                      required
                      placeholder="77.6245"
                      value={customLng}
                      onChange={(e) => setCustomLng(e.target.value)}
                    />
                  </label>
                </div>
                <Button size="sm">Set Custom Location</Button>
              </form>
            )}
          </div>
        </div>
      </Dialog>
      <Dialog
        open={notifications}
        onOpenChange={setNotifications}
        title="Your updates"
        description="Reservation updates and offers from your neighbourhood."
      >
        <div className="stack">
          {notes.length ? (
            notes.map((n) => (
              <div key={n.id} className="notification-item">
                <Bell size={18} />
                <div>
                  <strong>{n.title}</strong>
                  <small>{new Date(n.createdAt).toLocaleDateString()}</small>
                </div>
              </div>
            ))
          ) : (
            <p className="empty-small">
              You’re all caught up. Updates will appear here.
            </p>
          )}
          <Button
            variant="outline"
            disabled={!notes.some((n) => !n.read)}
            onClick={async () => {
              try {
                await api("/notifications/read", { method: "POST" });
                await cache.invalidateQueries({ queryKey: ["notifications"] });
                setNotifications(false);
              } catch (error) {
                toast((error as Error).message);
              }
            }}
          >
            Mark all as read
          </Button>
        </div>
      </Dialog>
    </>
  );
}
export function PageIntro({
  eyebrow,
  title,
  description,
  children,
}: {
  eyebrow?: string;
  title: string;
  description?: string;
  children?: React.ReactNode;
}) {
  return (
    <div className="page-intro">
      <div>
        {eyebrow && <span className="eyebrow">{eyebrow}</span>}
        <h1>{title}</h1>
        {description && <p>{description}</p>}
      </div>
      {children}
    </div>
  );
}
export function EmptyState({
  title = "Nothing here yet",
  description = "Try another search or explore your neighbourhood.",
  href = "/search",
  label = "Explore products",
}: {
  title?: string;
  description?: string;
  href?: string;
  label?: string;
}) {
  return (
    <div className="empty-state">
      <ShoppingBag size={36} />
      <h2>{title}</h2>
      <p>{description}</p>
      <Button asChild>
        <Link href={href}>
          {label}
          <ArrowUpRight size={16} />
        </Link>
      </Button>
    </div>
  );
}
export function Loading() {
  return (
    <div className="product-grid">
      {Array.from({ length: 4 }, (_, i) => (
        <div className="skeleton-card" key={i}>
          <div />
          <span />
          <span />
        </div>
      ))}
    </div>
  );
}
export function ErrorState({
  error,
  retry,
}: {
  error: Error;
  retry?: () => void;
}) {
  return (
    <div className="error-state" role="alert">
      <SlidersHorizontal />
      <h2>We couldn’t load this just yet</h2>
      <p>{error.message}</p>
      {retry && <Button onClick={retry}>Try again</Button>}
    </div>
  );
}
export function AuthRequired({
  children,
  seller = false,
}: {
  children: React.ReactNode;
  seller?: boolean;
}) {
  const { user, loading } = useAuth();
  if (loading)
    return (
      <div className="container section">
        <Loading />
      </div>
    );
  if (!user)
    return (
      <div className="container">
        <EmptyState
          title="A little more local, with an account"
          description="Sign in to save your favourites, reserve products, and connect with local sellers."
          href={seller ? "/seller/login" : "/login"}
          label={seller ? "Shopkeeper sign in" : "Sign in"}
        />
      </div>
    );
  if (seller && !user.roles.includes("SELLER"))
    return (
      <div className="container">
        <EmptyState
          title="Your next customer is nearby"
          description="Enable your seller account in your profile, then create your first shop."
          href="/profile"
          label="Become a seller"
        />
      </div>
    );
  return <>{children}</>;
}
export function LogoutButton() {
  const { logout } = useAuth();
  const router = useRouter();
  return (
    <Button
      variant="outline"
      onClick={async () => {
        await logout();
        router.push("/");
      }}
    >
      <LogOut size={16} />
      Sign out
    </Button>
  );
}
