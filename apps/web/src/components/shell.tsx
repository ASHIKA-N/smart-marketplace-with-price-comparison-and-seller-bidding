"use client";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useState } from "react";
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
import type { Notification } from "../../../../packages/shared/src";
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
  const { user } = useAuth();
  const { location, setLocation } = useLocation();
  const toast = useToast();
  const [locationOpen, setLocationOpen] = useState(false);
  const [menu, setMenu] = useState(false);
  const [notifications, setNotifications] = useState(false);
  const [locating, setLocating] = useState(false);
  const { data: notes = [] } = useQuery({
    queryKey: ["notifications", user?.id],
    queryFn: () => api<Notification[]>("/notifications"),
    enabled: !!user,
  });
  function locate() {
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
        toast("Nearby results now use your location.");
      },
      () => {
        setLocating(false);
        toast("Location was unavailable. Choose a neighbourhood below.");
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
                className="avatar"
                href="/profile"
                aria-label="Your profile"
              >
                {user.name.charAt(0)}
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
            <Link className="seller-nav" href="/seller">
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
        onOpenChange={setLocationOpen}
        title="Find your neighbourhood"
        description="We use your location to show nearby shops and calculate their distance. Your location history is not saved."
      >
        <div className="stack">
          <Button onClick={locate} disabled={locating}>
            <LocateFixed size={17} />
            {locating ? "Finding your location…" : "Use my current location"}
          </Button>
          <span className="eyebrow">OR CHOOSE A NEIGHBOURHOOD</span>
          {[
            { name: "Koramangala, Bengaluru", lat: 12.9352, lng: 77.6245 },
            { name: "Indiranagar, Bengaluru", lat: 12.9719, lng: 77.6412 },
            { name: "HSR Layout, Bengaluru", lat: 12.918, lng: 77.635 },
          ].map((l) => (
            <button
              className="location-option"
              key={l.name}
              onClick={() => {
                setLocation(l);
                setLocationOpen(false);
              }}
            >
              <MapPin size={18} />
              {l.name}
              <ArrowUpRight size={15} />
            </button>
          ))}
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
          href="/login"
          label="Sign in"
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
