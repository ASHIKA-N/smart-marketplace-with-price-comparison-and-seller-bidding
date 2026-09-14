"use client";
import { useState } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { Search, SlidersHorizontal } from "lucide-react";
import { api } from "@/lib/api";
import { useLocation } from "./providers";
import { PageIntro, Loading, ErrorState, EmptyState } from "./shell";
import { ProductCard } from "./catalog";
import { Button } from "./ui/button";
import { categories } from "./home";
import type { ProductResult } from "../../../../packages/shared/src";
export function SearchPage() {
  const params = useSearchParams();
  const router = useRouter();
  const { location } = useLocation();
  const [filtersOpen, setFiltersOpen] = useState(false);
  const query = new URLSearchParams(params.toString());
  query.set("lat", String(location.lat));
  query.set("lng", String(location.lng));
  query.set("limit", "12");
  const { data, isPending, error, refetch } = useQuery({
    queryKey: ["search", query.toString()],
    queryFn: () =>
      api<{ items: ProductResult[]; total: number; page: number }>(
        `/products/search?${query}`,
      ),
  });
  function update(key: string, value: string) {
    const next = new URLSearchParams(params.toString());
    if (value) next.set(key, value);
    else next.delete(key);
    if (key !== "page") next.delete("page");
    router.push(`/search?${next}`, { scroll: false });
  }
  const title = params.get("q")
    ? `Good finds for “${params.get("q")}”`
    : params.get("unique") === "true"
      ? "Made here. Loved everywhere."
      : params.get("sort") === "deal"
        ? "A good find. An even better price."
        : "Find your next favourite.";
  return (
    <div className="container page-body">
      <PageIntro
        eyebrow="EXPLORE YOUR NEIGHBOURHOOD"
        title={title}
        description={`Compare real prices from shops near ${location.name}.`}
      />
      <form
        className="search-query"
        onSubmit={(e) => {
          e.preventDefault();
          update("q", String(new FormData(e.currentTarget).get("q") || ""));
        }}
      >
        <Search size={18} />
        <input
          key={params.get("q")}
          name="q"
          aria-label="Search products"
          placeholder="Product, brand, or category"
          defaultValue={params.get("q") || ""}
        />
        <Button type="submit">Search</Button>
      </form>
      <div className="search-layout">
        <aside
          className={`filter-sidebar ${filtersOpen ? "filters-open" : ""}`}
          aria-label="Product filters"
        >
          <div className="filter-title">
            Filters
            <button onClick={() => router.push("/search")}>Reset all</button>
          </div>
          <div className="filter-group">
            <strong>Category</strong>
            <div className="filter-categories">
              {["All", ...categories.map((c) => c.name)].map((c) => (
                <button
                  key={c}
                  className={
                    (params.get("category") || "All") === c ? "selected" : ""
                  }
                  onClick={() => update("category", c)}
                >
                  {c}
                </button>
              ))}
            </div>
          </div>
          <div className="filter-group">
            <strong>Price range</strong>
            <div className="form-grid">
              <input
                className="control"
                type="number"
                min="0"
                placeholder="Min ₹"
                aria-label="Minimum price"
                defaultValue={params.get("min") || ""}
                onBlur={(e) => update("min", e.target.value)}
              />
              <input
                className="control"
                type="number"
                min="0"
                placeholder="Max ₹"
                aria-label="Maximum price"
                defaultValue={params.get("max") || ""}
                onBlur={(e) => update("max", e.target.value)}
              />
            </div>
          </div>
          <div className="filter-group">
            <strong>Distance</strong>
            <select
              className="control"
              aria-label="Search radius"
              value={params.get("radius") || "10"}
              onChange={(e) => update("radius", e.target.value)}
            >
              {[2, 5, 10, 25, 50].map((n) => (
                <option key={n} value={n}>
                  Within {n} km
                </option>
              ))}
            </select>
          </div>
          <div className="filter-group">
            <strong>Minimum rating</strong>
            <select
              className="control"
              aria-label="Minimum product rating"
              value={params.get("rating") || "0"}
              onChange={(e) => update("rating", e.target.value)}
            >
              <option value="0">All ratings</option>
              <option value="4">4 stars & above</option>
              <option value="4.5">4.5 stars & above</option>
              <option value="4.8">4.8 stars & above</option>
            </select>
          </div>
          <div className="filter-group">
            <strong>A few more preferences</strong>
            {[
              { key: "inStock", label: "In stock only" },
              { key: "open", label: "Shop open now" },
              { key: "unique", label: "Locally made & unique" },
            ].map((f) => (
              <label className="checkbox" key={f.key}>
                <input
                  type="checkbox"
                  checked={params.get(f.key) === "true"}
                  onChange={(e) =>
                    update(f.key, e.target.checked ? "true" : "")
                  }
                />
                {f.label}
              </label>
            ))}
          </div>
        </aside>
        <div className="search-results">
          <div className="results-toolbar">
            <p>
              <strong>{data?.total ?? "…"}</strong> good finds nearby
            </p>
            <Button
              className="mobile-filter"
              variant="outline"
              onClick={() => setFiltersOpen(!filtersOpen)}
            >
              <SlidersHorizontal size={14} />
              Filters
            </Button>
            <select
              className="control"
              aria-label="Sort products"
              value={params.get("sort") || "popular"}
              onChange={(e) => update("sort", e.target.value)}
            >
              <option value="popular">Most popular</option>
              <option value="price">Price: low to high</option>
              <option value="nearest">Nearest to you</option>
              <option value="rating">Highest rated</option>
              <option value="deal">Best discount</option>
            </select>
          </div>
          {isPending ? (
            <Loading />
          ) : error ? (
            <ErrorState error={error} retry={() => refetch()} />
          ) : data?.items.length ? (
            <>
              <div className="product-grid">
                {data.items.map((p) => (
                  <ProductCard key={p.id} product={p} />
                ))}
              </div>
              {data.total > 12 && (
                <div className="pagination">
                  <Button
                    variant="outline"
                    disabled={data.page === 1}
                    onClick={() => update("page", String(data.page - 1))}
                  >
                    Previous
                  </Button>
                  <span>
                    Page {data.page} of {Math.ceil(data.total / 12)}
                  </span>
                  <Button
                    variant="outline"
                    disabled={data.page * 12 >= data.total}
                    onClick={() => update("page", String(data.page + 1))}
                  >
                    Next
                  </Button>
                </div>
              )}
            </>
          ) : (
            <EmptyState
              title="No finds just yet"
              description="Try a wider distance, another search, or fewer filters."
              label="Reset search"
            />
          )}
        </div>
      </div>
    </div>
  );
}
