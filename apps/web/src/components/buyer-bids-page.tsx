"use client";
import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { money, type ListingBid } from "../../../../packages/shared/src";
import { AuthRequired, Loading, ErrorState, EmptyState } from "./shell";

type BidWithDetails = ListingBid & {
  product?: { name: string; image: string };
  shop?: { name: string };
  listing?: { unit?: string };
};

export function BuyerBidsPage() {
  return (
    <AuthRequired>
      <BuyerBidsList />
    </AuthRequired>
  );
}

function BuyerBidsList() {
  const { data, isPending, error, refetch } = useQuery({
    queryKey: ["buyer-listing-bids"],
    queryFn: () => api<BidWithDetails[]>("/buyer/listing-bids"),
  });
  if (isPending) return <div className="container section"><Loading /></div>;
  if (error) return <ErrorState error={error} retry={() => refetch()} />;
  if (!data?.length) return (
    <div className="container section">
      <EmptyState title="No bids yet" description="Browse bidding listings and submit your first offer." href="/products" label="Browse products" />
    </div>
  );
  return (
    <div className="container page-body">
      <h1 className="page-title">My bids</h1>
      <div className="stack">
        {data.slice().reverse().map(bid => (
          <div className="panel" key={bid.id}>
            <div className="row spread">
              <div>
                <h3>{bid.product?.name ?? bid.productId}</h3>
                <p className="muted">{bid.shop?.name}</p>
                <p className="muted">Offered {money(bid.offeredPrice)} · Qty {bid.quantity}{bid.listing?.unit ? ` ${bid.listing.unit}` : ""}</p>
                <p className="muted">{new Date(bid.createdAt).toLocaleString()}</p>
                {bid.note && <p className="muted mt">{bid.note}</p>}
              </div>
              <span className={`badge ${bid.status === "ACCEPTED" ? "" : bid.status === "REJECTED" ? "amber" : ""}`}>
                {bid.status.charAt(0) + bid.status.slice(1).toLowerCase()}
              </span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
