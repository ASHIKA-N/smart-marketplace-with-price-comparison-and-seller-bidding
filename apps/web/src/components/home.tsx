"use client";
import Link from "next/link";
import Image from "next/image";
import { useQuery } from "@tanstack/react-query";
import {
  Search,
  ArrowRight,
  ArrowUpRight,
  MapPin,
  ShieldCheck,
  SlidersHorizontal,
  Store,
  Headphones,
  Shirt,
  Sofa,
  Apple,
  Sparkles,
  Bike,
  ChevronRight,
  Leaf,
  BadgeCheck,
  Star,
} from "lucide-react";
import { api } from "@/lib/api";
import { useLocation } from "./providers";
import { ProductCard, ShopCard } from "./catalog";
import { Loading, ErrorState } from "./shell";
import type { ProductResult, Shop } from "../../../../packages/shared/src";
import { Button } from "./ui/button";
export const categories = [
  { name: "Electronics", icon: Headphones, color: "peach" },
  { name: "Fashion", icon: Shirt, color: "lilac" },
  { name: "Home & Living", icon: Sofa, color: "sand" },
  { name: "Groceries", icon: Apple, color: "mint" },
  { name: "Beauty & Care", icon: Sparkles, color: "pink" },
  { name: "Sports & Outdoors", icon: Bike, color: "blue" },
];
function SectionHeading({
  eyebrow,
  title,
  description,
  href,
  label = "View all",
}: {
  eyebrow?: string;
  title: string;
  description?: string;
  href: string;
  label?: string;
}) {
  return (
    <div className="section-heading">
      <div>
        {eyebrow && <span className="eyebrow">{eyebrow}</span>}
        <h2>{title}</h2>
        {description && <p>{description}</p>}
      </div>
      <Link href={href}>
        {label}
        <ArrowRight size={17} />
      </Link>
    </div>
  );
}
export function Home() {
  const { location } = useLocation();
  const params = `lat=${location.lat}&lng=${location.lng}`;
  const products = useQuery({
    queryKey: ["products", params],
    queryFn: () =>
      api<{ items: ProductResult[]; total: number }>(`/products?${params}`),
  });
  const shops = useQuery({
    queryKey: ["shops", params],
    queryFn: () => api<Shop[]>(`/shops?${params}`),
  });
  return (
    <>
      <div className="container">
        <section className="hero">
          <div className="hero-copy">
            <div className="hero-label">
              <span /> YOUR NEIGHBOURHOOD. REIMAGINED.
            </div>
            <h1>
              Great finds.
              <br />
              Better prices.
              <br />
              <span>Closer to home.</span>
            </h1>
            <p>
              Discover the best of your neighbourhood.
              <br className="desktop-only" /> Compare local prices. Shop with
              confidence.
            </p>
            <form action="/search" className="hero-search">
              <Search size={20} />
              <input
                name="q"
                aria-label="Find a product nearby"
                placeholder="What are you looking for?"
              />
              <button type="submit" aria-label="Search nearby products">
                <ArrowRight size={20} />
              </button>
            </form>
            <div className="hero-trending">
              <span>Trending:</span>
              <Link href="/search?q=headphones">Headphones</Link>
              <Link href="/search?q=coffee">Artisan coffee</Link>
              <Link href="/search?q=decor">Home décor</Link>
            </div>
            <div className="hero-social">
              <div className="mini-avatars">
                <span>AK</span>
                <span>PM</span>
                <span>RS</span>
                <span>JL</span>
              </div>
              <div>
                <div className="stars">★★★★★</div>
                <small>Good things happen when you shop local.</small>
              </div>
            </div>
          </div>
          <div className="hero-visual">
            <div className="hero-photo">
              <Image
                priority
                src="/images/photo-1441986300917-64674bd600d8.jpg"
                alt="Sunlit neighbourhood boutique filled with carefully selected clothing and plants"
                fill
                sizes="(max-width: 760px) 100vw, 50vw"
              />
              <div className="hero-photo-shade" />
              <div className="photo-caption">
                <span>AROUND THE CORNER</span>
                <strong>
                  Your next favourite
                  <br />
                  is already nearby.
                </strong>
                <Link href="/shops">
                  Meet your local shops <ArrowUpRight size={16} />
                </Link>
              </div>
            </div>
            <div className="floating-card floating-deal">
              <div className="float-icon">
                <SlidersHorizontal size={20} />
              </div>
              <div>
                <strong>
                  A little comparison.
                  <br />A lot of savings.
                </strong>
                <span>Find your best local price</span>
              </div>
              <span className="float-check">
                <BadgeCheck size={21} />
              </span>
            </div>
            <div className="floating-card floating-shop">
              <div className="float-shop-icon">
                <Store size={23} />
              </div>
              <div>
                <strong>Real shops. Real people.</strong>
                <span>
                  <span className="green-dot" /> Discover what’s around you
                </span>
              </div>
            </div>
            <div className="hero-sticker">
              <Leaf size={20} />
              <span>
                LOVE LOCAL
                <br />
                SHOP LOCAL
              </span>
            </div>
          </div>
        </section>
        <div className="benefit-strip">
          <div>
            <MapPin />
            <span>
              <strong>Closer than you think</strong>
              <small>Find great shops in your neighbourhood</small>
            </span>
          </div>
          <div>
            <SlidersHorizontal />
            <span>
              <strong>Compare. Save. Smile.</strong>
              <small>The right product at the right price</small>
            </span>
          </div>
          <div>
            <ShieldCheck />
            <span>
              <strong>Local shops you can trust</strong>
              <small>Transparent ratings and verified reviews</small>
            </span>
          </div>
          <div>
            <Store />
            <span>
              <strong>Make local matter</strong>
              <small>Every purchase supports your community</small>
            </span>
          </div>
        </div>
        <section className="section category-section">
          <SectionHeading
            title="What’s on your list?"
            href="/search"
            label="Explore all categories"
          />
          <div className="categories">
            {categories.map((c) => (
              <Link
                className="category"
                key={c.name}
                href={`/search?category=${encodeURIComponent(c.name)}`}
              >
                <span className={`category-icon ${c.color}`}>
                  <c.icon size={29} strokeWidth={1.55} />
                </span>
                <strong>{c.name}</strong>
                <ChevronRight size={14} />
              </Link>
            ))}
          </div>
        </section>
        <section className="section">
          <SectionHeading
            eyebrow="GOOD FINDS, GREAT PRICES"
            title="Popular around you"
            description="Neighbourhood favourites. Worth a closer look."
            href="/search"
            label="Explore all products"
          />
          {products.isPending ? (
            <Loading />
          ) : products.error ? (
            <ErrorState
              error={products.error}
              retry={() => products.refetch()}
            />
          ) : (
            <div className="product-grid">
              {products.data?.items.slice(0, 4).map((p) => (
                <ProductCard key={p.id} product={p} />
              ))}
            </div>
          )}
        </section>
        <section className="promo-grid">
          <div className="promo-card promo-green">
            <div>
              <span className="eyebrow">SMALL SHOPS. BIG FINDS.</span>
              <h2>
                Not everywhere.
                <br />
                Just around here.
              </h2>
              <p>
                One-of-a-kind pieces from
                <br />
                the makers next door.
              </p>
              <Button asChild variant="outline">
                <Link href="/search?unique=true">
                  Discover local gems <ArrowUpRight size={16} />
                </Link>
              </Button>
            </div>
            <Image
              src="/images/photo-1490312278390-ab64016e0aa9.jpg"
              alt="Handcrafted pottery with a natural finish"
              width={300}
              height={320}
            />
            <span className="promo-decoration">
              <Leaf size={34} />
            </span>
          </div>
          <div className="promo-card promo-peach">
            <div>
              <span className="eyebrow">YOUR PRICE. THEIR BEST OFFER.</span>
              <h2>
                Let the best
                <br />
                deal find you.
              </h2>
              <p>
                Tell local sellers what you want.
                <br />
                Get offers made just for you.
              </p>
              <Button asChild variant="outline">
                <Link href="/requests">
                  Request a price <ArrowUpRight size={16} />
                </Link>
              </Button>
            </div>
            <div className="bid-illustration">
              <div>
                <Store size={19} />
                <span>Local seller offer</span>
                <BadgeCheck size={16} />
              </div>
              <strong>A better price.</strong>
              <p>From a shop near you.</p>
              <div className="bid-pill">
                <ShieldCheck size={14} /> Compare with confidence
              </div>
            </div>
          </div>
        </section>
        <section className="section">
          <SectionHeading
            eyebrow="MEET YOUR NEIGHBOURS"
            title="Good shops. Even better people."
            description="Discover the independent stores that make your neighbourhood, yours."
            href="/shops"
            label="Find nearby shops"
          />
          {shops.isPending ? (
            <Loading />
          ) : shops.error ? (
            <ErrorState error={shops.error} retry={() => shops.refetch()} />
          ) : (
            <div className="shop-grid">
              {shops.data?.slice(0, 3).map((s) => (
                <ShopCard key={s.id} shop={s} />
              ))}
            </div>
          )}
        </section>
        <section className="section">
          <SectionHeading
            eyebrow="A LITTLE SOMETHING FOR YOU"
            title="More to fall in love with"
            href="/search"
            label="Keep exploring"
          />
          <div className="product-grid">
            {products.data?.items.slice(4, 8).map((p) => (
              <ProductCard key={p.id} product={p} />
            ))}
          </div>
        </section>
        <section className="seller-banner">
          <div className="seller-banner-icon">
            <Store size={42} strokeWidth={1.4} />
          </div>
          <div>
            <span className="eyebrow">HELLO, NEIGHBOURHOOD BUSINESSES</span>
            <h2>Your next customer is just around the corner.</h2>
            <p>
              Bring your shop online. Reach local buyers. Grow on your own
              terms.
            </p>
          </div>
          <Button asChild>
            <Link href="/seller">
              Set up your shop <ArrowUpRight size={17} />
            </Link>
          </Button>
        </section>
        <div className="local-signoff">
          <Star size={14} />
          <span>A little closer. A little better. A lot more local.</span>
          <Star size={14} />
        </div>
      </div>
    </>
  );
}
