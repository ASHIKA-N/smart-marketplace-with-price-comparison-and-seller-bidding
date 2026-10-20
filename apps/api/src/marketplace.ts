import {
  Inject,
  Injectable,
  BadRequestException,
  ForbiddenException,
  NotFoundException,
} from "@nestjs/common";
import { randomUUID, randomInt } from "node:crypto";
import { z } from "zod";
import { StoreService } from "./store";
import {
  finalPrice,
  shopOpen,
  trustScore,
  type PublicUser,
  type Store,
  type Shop,
  type ProductResult,
  type ListingResult,
  POPULAR_LOCATIONS,
} from "../../../packages/shared/src";
export const searchSchema = z.object({
  q: z.string().max(100).default(""),
  category: z.string().max(80).default("All"),
  lat: z.coerce.number().min(-90).max(90).default(13.0418),
  lng: z.coerce.number().min(-180).max(180).default(80.2341),
  radius: z.coerce.number().positive().max(100).default(10),
  min: z.coerce.number().nonnegative().default(0),
  max: z.coerce.number().nonnegative().default(1000000),
  rating: z.coerce.number().min(0).max(5).default(0),
  inStock: z.preprocess((v) => (v === "" || v == null ? "false" : v), z.enum(["true", "false"]).default("false")),
  open: z.preprocess((v) => (v === "" || v == null ? "false" : v), z.enum(["true", "false"]).default("false")),
  unique: z.preprocess((v) => (v === "" || v == null ? "false" : v), z.enum(["true", "false"]).default("false")),
  sort: z
    .enum(["popular", "price", "nearest", "rating", "deal"])
    .default("popular"),
  page: z.coerce.number().int().min(1).max(10000).default(1),
  limit: z.coerce.number().int().min(1).max(48).default(24),
});
export interface GeocodeResult {
  name: string;
  lat: number;
  lng: number;
  city?: string;
  state?: string;
  country?: string;
  displayName: string;
}
export const shopSchema = z.object({
  name: z.string().min(3).max(100),
  description: z.string().min(10).max(2000),
  address: z.string().min(5).max(300),
  lat: z.coerce
    .number()
    .min(-90, "Latitude must be between -90 and 90")
    .max(90, "Latitude must be between -90 and 90"),
  lng: z.coerce
    .number()
    .min(-180, "Longitude must be between -180 and 180")
    .max(180, "Longitude must be between -180 and 180"),
  city: z.string().max(100).optional(),
  state: z.string().max(100).optional(),
  postalCode: z.string().max(20).optional(),
  country: z.string().max(100).optional(),
  phone: z.string().min(7).max(25),
  image: z
    .string()
    .refine(
      (v) =>
        /^\/images\/photo-[a-z0-9-]+\.jpg$/.test(v) ||
        v.startsWith("https://images.unsplash.com/"),
      "Use a bundled image path or an Unsplash image URL",
    )
    .default("/images/photo-1441986300917-64674bd600d8.jpg"),
  hours: z
    .object({
      open: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/),
      close: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/),
      days: z.array(z.number().int().min(0).max(6)).min(1),
    })
    .default({ open: "09:00", close: "21:00", days: [0, 1, 2, 3, 4, 5, 6] }),
});
export const listingSchema = z.object({
  shopId: z.string(),
  productId: z.string(),
  price: z.coerce.number().positive().max(10000000),
  stock: z.coerce.number().int().min(0).max(100000),
  active: z.boolean().default(true),
  pricingMode: z.enum(["FIXED", "BIDDING"]).default("FIXED"),
  minBid: z.coerce.number().positive().max(10000000).optional(),
  biddingDeadline: z.iso.datetime().optional().nullable(),
  biddingOpen: z.boolean().default(true),
  unit: z.string().max(20).default(""),
});
export const listingBidSchema = z.object({
  listingId: z.string(),
  offeredPrice: z.coerce.number().positive().max(10000000),
  quantity: z.coerce.number().int().min(1).max(100),
  note: z.string().max(500).default(""),
});
export const productSchema = z.object({
  name: z.string().min(3).max(150),
  category: z.enum([
    "Electronics",
    "Fashion",
    "Home & Living",
    "Groceries",
    "Beauty & Care",
    "Sports & Outdoors",
  ]),
  brand: z.string().min(1).max(60),
  description: z.string().min(10).max(3000),
  image: z
    .string()
    .refine(
      (v) =>
        /^\/images\/photo-[a-z0-9-]+\.jpg$/.test(v) ||
        v.startsWith("https://images.unsplash.com/"),
      "Use a bundled image path or an Unsplash image URL",
    ),
  unique: z.boolean().default(false),
  tags: z.array(z.string().max(40)).max(10).default([]),
});
export const offerSchema = z
  .object({
    listingId: z.string(),
    title: z.string().min(3).max(100),
    type: z.enum(["PERCENT", "FIXED"]),
    value: z.coerce.number().positive(),
    startsAt: z.iso.datetime(),
    endsAt: z.iso.datetime(),
    enabled: z.boolean().default(true),
  })
  .refine(
    (o) => new Date(o.endsAt) > new Date(o.startsAt),
    "End date must follow start date",
  )
  .refine(
    (o) => o.type !== "PERCENT" || o.value <= 100,
    "Percentage cannot exceed 100",
  );
export function requireSeller(user: PublicUser) {
  if (!user.roles.includes("SELLER"))
    throw new ForbiddenException("A seller account is required.");
}
export function ownedShop(s: Store, id: string, user: PublicUser) {
  requireSeller(user);
  const shop = s.shops.find((v) => v.id === id);
  if (!shop) throw new NotFoundException("Shop not found.");
  if (shop.ownerId !== user.id)
    throw new ForbiddenException("You do not own this shop.");
  return shop;
}
export function ownedListing(s: Store, listingId: string, user: PublicUser) {
  requireSeller(user);
  const listing = s.listings.find((l) => l.id === listingId);
  if (!listing) throw new NotFoundException("Listing not found.");
  const shop = s.shops.find((sh) => sh.id === listing.shopId);
  if (!shop || shop.ownerId !== user.id)
    throw new ForbiddenException("You do not own this listing.");
  return listing;
}
@Injectable()
export class MarketplaceService {
  constructor(@Inject(StoreService) private readonly db: StoreService) {}
  private decorate(shop: Shop, distance?: number): Shop {
    return {
      ...shop,
      distance,
      isOpen: shopOpen(shop.hours),
      trust: trustScore(shop),
    };
  }
  private listing(
    s: Store,
    id: string,
    user?: PublicUser,
    distance?: number,
  ): ListingResult {
    const l = s.listings.find((v) => v.id === id)!;
    const offer = s.offers
      .filter(
        (o) =>
          o.listingId === id &&
          o.enabled &&
          new Date(o.startsAt) <= new Date() &&
          new Date(o.endsAt) > new Date(),
      )
      .sort((a, b) => finalPrice(l.price, a) - finalPrice(l.price, b))[0];
    const loyaltyDiscount =
      user &&
      s.transactions.filter(
        (t) =>
          t.buyerId === user.id &&
          t.shopId === l.shopId &&
          t.status === "COMPLETED",
      ).length >= 3
        ? 3
        : 0;
    return {
      ...l,
      shop: this.decorate(
        s.shops.find((sh) => sh.id === l.shopId)!,
        distance,
      ),
      offer,
      loyaltyDiscount,
      finalPrice: finalPrice(l.price, offer, new Date(), loyaltyDiscount),
    };
  }
  async search(query: unknown) {
    const f = searchSchema.parse(query);
    const s = await this.db.read();
    const matched = await this.db.matchingProducts(f.q);
    const nearby = await this.db.nearby(f.lat, f.lng, f.radius);
    const distances = new Map(nearby.map((v) => [v.id, v.distance]));
    let products: ProductResult[] = s.products
      .filter(
        (p) =>
          (matched
            ? matched.includes(p.id)
            : !f.q ||
              `${p.name} ${p.brand} ${p.category} ${p.tags.join(" ")}`
                .toLowerCase()
                .includes(f.q.toLowerCase().trim())) &&
          (f.category === "All" || p.category === f.category) &&
          p.rating >= f.rating &&
          (f.unique !== "true" || p.unique),
      )
      .flatMap((p) => {
        const listings = s.listings
          .filter(
            (l) =>
              l.productId === p.id &&
              l.active &&
              distances.has(l.shopId) &&
              (f.inStock !== "true" || l.stock > 0),
          )
          .map((l) => this.listing(s, l.id, undefined, distances.get(l.shopId)))
          .filter(
            (l) =>
              l.finalPrice >= f.min &&
              l.finalPrice <= f.max &&
              (f.open !== "true" || l.shop.isOpen),
          );
        if (!listings.length) return [];
        const best = listings.reduce((a, b) =>
          a.finalPrice < b.finalPrice ? a : b,
        );
        return [
          {
            ...p,
            price: best.finalPrice,
            maxPrice: Math.max(...listings.map((l) => l.price)),
            sellerCount: listings.length,
            distance: Math.min(...listings.map((l) => l.shop.distance || 0)),
            discount: best.price > 0 ? Math.round((1 - best.finalPrice / best.price) * 100) : 0,
            pricingMode: listings.some((l) => (l.pricingMode ?? "FIXED") === "BIDDING") ? "BIDDING" : "FIXED",
          },
        ];
      });
    products = products.sort((a, b) => {
      const order =
        f.sort === "price"
          ? a.price - b.price
          : f.sort === "nearest"
            ? a.distance - b.distance
            : f.sort === "rating"
              ? b.rating - a.rating
              : f.sort === "deal"
                ? b.discount - a.discount
                : b.reviews - a.reviews;
      return order || a.id.localeCompare(b.id);
    });
    return {
      items: products.slice((f.page - 1) * f.limit, f.page * f.limit),
      total: products.length,
      page: f.page,
      filters: f,
    };
  }
  async shops(query: unknown) {
    const f = searchSchema.parse(query);
    const s = await this.db.read();
    const nearby = await this.db.nearby(f.lat, f.lng, f.radius);
    return nearby
      .map((n) =>
        this.decorate(
          s.shops.find((sh) => sh.id === n.id)!,
          n.distance,
        ),
      )
      .filter((sh) => f.open !== "true" || sh.isOpen);
  }
  async shop(id: string) {
    const s = await this.db.read();
    const shop = s.shops.find((sh) => sh.id === id);
    if (!shop) throw new NotFoundException("Shop not found.");
    return {
      ...this.decorate(shop),
      listings: s.listings
        .filter((l) => l.shopId === id && l.active)
        .map((l) => ({
          ...this.listing(s, l.id),
          product: s.products.find((p) => p.id === l.productId),
        })),
      reviews: s.reviews
        .filter((r) => r.shopId === id)
        .map((r) => ({
          ...r,
          userName: r.userName || s.users.find((u) => u.id === r.userId)?.name || "Verified Buyer",
        })),
    };
  }
  async product(id: string, query: unknown, user?: PublicUser) {
    const s = await this.db.read();
    const p = s.products.find((p) => p.id === id);
    if (!p) throw new NotFoundException("Product not found.");
    const f = searchSchema.parse(query);
    const nearby = await this.db.nearby(f.lat, f.lng, f.radius);
    return {
      ...p,
      listings: s.listings
        .filter(
          (l) =>
            l.productId === id &&
            l.active &&
            nearby.some((n) => n.id === l.shopId),
        )
        .map((l) =>
          this.listing(
            s,
            l.id,
            user,
            nearby.find((n) => n.id === l.shopId)?.distance,
          ),
        )
        .sort(
          (a, b) => a.finalPrice - b.finalPrice || a.id.localeCompare(b.id),
        ),
      reviews: s.reviews
        .filter((r) => r.productId === id)
        .map((r) => ({
          ...r,
          userName: r.userName || s.users.find((u) => u.id === r.userId)?.name || "Verified Buyer",
        })),
      listingBids: user ? s.listingBids.filter(
        (b) => b.productId === id && b.buyerId === user.id
      ) : [],
    };
  }
  async saveShop(user: PublicUser, input: unknown, id?: string) {
    requireSeller(user);
    const data = shopSchema.parse(input);
    return this.db.mutate((s) => {
      if (id) {
        const shop = ownedShop(s, id, user);
        Object.assign(shop, data);
        return shop;
      }
      const shop: Shop = {
        ...data,
        id: randomUUID(),
        ownerId: user.id,
        rating: 0,
        reviews: 0,
        verified: false,
        completed: 0,
      };
      s.shops.push(shop);
      return shop;
    });
  }
  async createProduct(user: PublicUser, input: unknown) {
    requireSeller(user);
    const data = productSchema.parse(input);
    return this.db.mutate((s) => {
      const product = { ...data, id: randomUUID(), rating: 0, reviews: 0 };
      s.products.push(product);
      return product;
    });
  }
  async saveListing(user: PublicUser, input: unknown, id?: string) {
    const data = listingSchema.parse(input);
    return this.db.mutate((s) => {
      ownedShop(s, data.shopId, user);
      if (!s.products.some((p) => p.id === data.productId))
        throw new NotFoundException("Product not found.");
      if (id) {
        const l = s.listings.find((l) => l.id === id);
        if (!l) throw new NotFoundException();
        ownedShop(s, l.shopId, user);
        Object.assign(l, data);
        return l;
      }
      if (
        s.listings.some(
          (l) => l.productId === data.productId && l.shopId === data.shopId,
        )
      )
        throw new BadRequestException(
          "This product is already listed in your shop.",
        );
      const l = { ...data, id: randomUUID() };
      s.listings.push(l);
      return l;
    });
  }
  async offer(user: PublicUser, input: unknown) {
    const data = offerSchema.parse(input);
    return this.db.mutate((s) => {
      const l = s.listings.find((l) => l.id === data.listingId);
      if (!l) throw new NotFoundException();
      ownedShop(s, l.shopId, user);
      if (data.type === "FIXED" && data.value > l.price)
        throw new BadRequestException("Discount cannot exceed price.");
      const offer = { ...data, id: randomUUID() };
      s.offers.push(offer);
      return offer;
    });
  }
  async reserve(user: PublicUser, input: unknown) {
    const data = z
      .object({
        listingId: z.string(),
        quantity: z.coerce.number().int().min(1).max(100),
        bidId: z.string().optional(),
      })
      .parse(input);
    return this.db.mutate((s) => {
      const l = s.listings.find((l) => l.id === data.listingId && l.active);
      if (!l) throw new NotFoundException();
      const shop = s.shops.find((sh) => sh.id === l.shopId)!;
      if (shop.ownerId === user.id)
        throw new BadRequestException("You cannot reserve your own listing.");
      if (!s.users.some((u) => u.id === shop.ownerId && u.active))
        throw new BadRequestException("This shop is unavailable.");
      if (l.stock < data.quantity)
        throw new BadRequestException("Insufficient stock.");
      let price = this.listing(s, l.id, user).finalPrice;
      if (data.bidId) {
        const bid = s.bids.find(
          (b) => b.id === data.bidId && b.shopId === l.shopId,
        );
        const request = s.requests.find(
          (r) =>
            r.id === bid?.requestId &&
            r.buyerId === user.id &&
            r.productId === l.productId &&
            r.status === "OPEN",
        );
        if (!bid || !request || request.quantity !== data.quantity)
          throw new BadRequestException("This bid is no longer available.");
        price = bid.price;
        request.status = "CLOSED";
      }
      l.stock -= data.quantity;
      const t = {
        id: randomUUID(),
        buyerId: user.id,
        shopId: l.shopId,
        listingId: l.id,
        productId: l.productId,
        quantity: data.quantity,
        basePrice: l.price,
        finalPrice: price,
        total: Math.round(price * data.quantity * 100) / 100,
        status: "INITIATED" as const,
        pickupOtp: randomInt(100000, 1000000).toString(),
        createdAt: new Date().toISOString(),
      };
      s.transactions.push(t);
      s.notifications.push({
        id: randomUUID(),
        userId: shop.ownerId,
        title: "New reservation received",
        read: false,
        createdAt: new Date().toISOString(),
      });
      return t;
    });
  }
  async transition(user: PublicUser, id: string, input: unknown) {
    const { status, otp } = z
      .object({
        status: z.enum(["CONFIRMED", "COMPLETED", "CANCELLED"]),
        otp: z.string().trim().optional(),
      })
      .parse(input);
    return this.db.mutate((s) => {
      const t = s.transactions.find((t) => t.id === id);
      if (!t) throw new NotFoundException();
      const shop = s.shops.find((sh) => sh.id === t.shopId)!;
      const seller = shop.ownerId === user.id;
      if (!seller && t.buyerId !== user.id) throw new ForbiddenException();
      if (status !== "CANCELLED" && !seller)
        throw new ForbiddenException("Only the seller can confirm completion.");
      if (!(
        (status === "CONFIRMED" && t.status === "INITIATED") ||
        (status === "COMPLETED" && t.status === "CONFIRMED") ||
        (status === "CANCELLED" &&
          ["INITIATED", "CONFIRMED"].includes(t.status))
      ))
        throw new BadRequestException("Invalid status transition.");
      if (status === "COMPLETED") {
        if (t.pickupOtp) {
          if (!otp) {
            throw new BadRequestException("Pickup OTP is required to complete this reservation.");
          }
          if (otp.trim() !== t.pickupOtp.trim()) {
            throw new BadRequestException("Invalid pickup OTP. Please verify the 6-digit code with the customer.");
          }
        }
        shop.completed++;
        t.completedAt = new Date().toISOString();
      }
      t.status = status;
      if (status === "CANCELLED") {
        const listing = s.listings.find((l) => l.id === t.listingId);
        if (listing) listing.stock += t.quantity;
      }
      // Notify the other party: seller actions notify the buyer; buyer cancellation notifies the seller.
      const notifyUserId = seller ? t.buyerId : shop.ownerId;
      s.notifications.push({
        id: randomUUID(),
        userId: notifyUserId,
        title: `Reservation ${status.toLowerCase()}`,
        read: false,
        createdAt: new Date().toISOString(),
      });
      return t;
    });
  }
  private recalcRating(s: Store, shopId: string, productId: string) {
    const shop = s.shops.find((sh) => sh.id === shopId);
    if (shop) {
      const shopReviews = s.reviews.filter((rev) => rev.shopId === shopId);
      shop.reviews = shopReviews.length;
      shop.rating = shopReviews.length
        ? Math.round((shopReviews.reduce((sum, rev) => sum + rev.rating, 0) / shopReviews.length) * 10) / 10
        : 0;
    }
    const product = s.products.find((p) => p.id === productId);
    if (product) {
      const prodReviews = s.reviews.filter((rev) => rev.productId === productId);
      product.reviews = prodReviews.length;
      product.rating = prodReviews.length
        ? Math.round((prodReviews.reduce((sum, rev) => sum + rev.rating, 0) / prodReviews.length) * 10) / 10
        : 0;
    }
  }

  async review(user: PublicUser, input: unknown) {
    const data = z
      .object({
        transactionId: z.string().optional(),
        shopId: z.string().optional(),
        rating: z.coerce.number().int().min(1, "Rating must be between 1 and 5").max(5, "Rating must be between 1 and 5"),
        text: z.string().min(5, "Review must be at least 5 characters").max(2000, "Review must not exceed 2000 characters"),
      })
      .parse(input);
    return this.db.mutate((s) => {
      let t = data.transactionId
        ? s.transactions.find(
            (t) =>
              t.id === data.transactionId &&
              t.buyerId === user.id &&
              t.status === "COMPLETED",
          )
        : undefined;

      if (!t && data.shopId) {
        t = s.transactions.find(
          (cand) =>
            cand.shopId === data.shopId &&
            cand.buyerId === user.id &&
            cand.status === "COMPLETED" &&
            !s.reviews.some((r) => r.transactionId === cand.id),
        );
      }

      if (!t) throw new ForbiddenException("A completed purchase is required to review this seller.");
      if (s.reviews.some((r) => r.transactionId === t.id))
        throw new BadRequestException("You already reviewed this purchase.");

      const r = {
        id: randomUUID(),
        transactionId: t.id,
        userId: user.id,
        shopId: t.shopId,
        productId: t.productId,
        rating: data.rating,
        text: data.text,
        userName: user.name,
        createdAt: new Date().toISOString(),
      };
      s.reviews.push(r);
      this.recalcRating(s, t.shopId, t.productId);
      return r;
    });
  }

  async editReview(user: PublicUser, reviewId: string, input: unknown) {
    const data = z
      .object({
        rating: z.coerce.number().int().min(1, "Rating must be between 1 and 5").max(5, "Rating must be between 1 and 5").optional(),
        text: z.string().min(5, "Review must be at least 5 characters").max(2000, "Review must not exceed 2000 characters").optional(),
      })
      .refine((v) => v.rating !== undefined || v.text !== undefined, "Provide rating or text to update.")
      .parse(input);
    return this.db.mutate((s) => {
      const r = s.reviews.find((rev) => rev.id === reviewId);
      if (!r) throw new NotFoundException("Review not found.");
      if (r.userId !== user.id)
        throw new ForbiddenException("You can only edit your own reviews.");
      if (data.rating !== undefined) r.rating = data.rating;
      if (data.text !== undefined) r.text = data.text;
      r.updatedAt = new Date().toISOString();
      this.recalcRating(s, r.shopId, r.productId);
      return r;
    });
  }

  async deleteReview(user: PublicUser, reviewId: string) {
    return this.db.mutate((s) => {
      const r = s.reviews.find((rev) => rev.id === reviewId);
      if (!r) throw new NotFoundException("Review not found.");
      if (r.userId !== user.id)
        throw new ForbiddenException("You can only delete your own reviews.");
      const { shopId, productId } = r;
      s.reviews = s.reviews.filter((rev) => rev.id !== reviewId);
      this.recalcRating(s, shopId, productId);
      return { success: true, id: reviewId };
    });
  }

  async replyReview(user: PublicUser, reviewId: string, input: unknown) {
    requireSeller(user);
    const { reply } = z
      .object({
        reply: z.string().min(2, "Reply must be at least 2 characters").max(1000, "Reply must not exceed 1000 characters"),
      })
      .parse(input);
    return this.db.mutate((s) => {
      const r = s.reviews.find((rev) => rev.id === reviewId);
      if (!r) throw new NotFoundException("Review not found.");
      const shop = s.shops.find((sh) => sh.id === r.shopId);
      if (!shop || shop.ownerId !== user.id)
        throw new ForbiddenException("You can only reply to reviews on your own shop.");
      r.reply = reply.trim();
      r.repliedAt = new Date().toISOString();
      s.notifications.push({
        id: randomUUID(),
        userId: r.userId,
        title: `${shop.name} replied to your review`,
        read: false,
        createdAt: new Date().toISOString(),
      });
      return r;
    });
  }
  async dashboard(user: PublicUser) {
    const s = await this.db.read();
    const shops = s.shops
      .filter((sh) => sh.ownerId === user.id)
      .map((sh) => this.decorate(sh));
    const ids = shops.map((sh) => sh.id);
    return {
      shops,
      products: s.products,
      listings: s.listings.filter((l) => ids.includes(l.shopId)),
      offers: s.offers.filter((o) =>
        s.listings.some((l) => l.id === o.listingId && ids.includes(l.shopId)),
      ),
      transactions: s.transactions.filter((t) => ids.includes(t.shopId)),
      requests: s.requests.filter((r) => r.status === "OPEN"),
      bids: s.bids.filter((b) => ids.includes(b.shopId)),
      listingBids: s.listingBids.filter((b) => ids.includes(b.shopId)),
      reviews: s.reviews
        .filter((r) => ids.includes(r.shopId))
        .map((r) => ({
          ...r,
          userName: r.userName || s.users.find((u) => u.id === r.userId)?.name || "Verified Buyer",
          product: s.products.find((p) => p.id === r.productId),
          shop: s.shops.find((sh) => sh.id === r.shopId),
        })),
    };
  }
  async transactions(user: PublicUser) {
    const s = await this.db.read();
    return s.transactions
      .filter((t) => t.buyerId === user.id)
      .map((t) => ({
        ...t,
        product: s.products.find((p) => p.id === t.productId),
        shop: s.shops.find((sh) => sh.id === t.shopId),
        reviewed: s.reviews.some((r) => r.transactionId === t.id),
        review: s.reviews.find((r) => r.transactionId === t.id),
      }));
  }
  async favorites(user: PublicUser) {
    const s = await this.db.read();
    return s.favorites
      .filter((f) => f.userId === user.id)
      .map((f) => ({
        ...f,
        product:
          f.kind === "product"
            ? s.products.find((p) => p.id === f.targetId)
            : undefined,
        shop:
          f.kind === "shop"
            ? s.shops.find((sh) => sh.id === f.targetId)
            : undefined,
      }));
  }
  async favorite(user: PublicUser, input: unknown) {
    const f = z
      .object({ targetId: z.string(), kind: z.enum(["product", "shop"]) })
      .parse(input);
    return this.db.mutate((s) => {
      if (
        !(f.kind === "product" ? s.products : s.shops).some(
          (v) => v.id === f.targetId,
        )
      )
        throw new NotFoundException();
      const exists = s.favorites.some(
        (v) =>
          v.userId === user.id &&
          v.targetId === f.targetId &&
          v.kind === f.kind,
      );
      s.favorites = s.favorites.filter(
        (v) =>
          !(
            v.userId === user.id &&
            v.targetId === f.targetId &&
            v.kind === f.kind
          ),
      );
      if (!exists) s.favorites.push({ ...f, userId: user.id });
      return { saved: !exists };
    });
  }
  async request(user: PublicUser, input: unknown) {
    const data = z
      .object({
        productId: z.string(),
        quantity: z.coerce.number().int().min(1).max(100),
        targetPrice: z.coerce.number().positive().max(10000000),
        note: z.string().max(500).default(""),
      })
      .parse(input);
    return this.db.mutate((s) => {
      if (!s.products.some((p) => p.id === data.productId))
        throw new NotFoundException();
      const r = {
        ...data,
        id: randomUUID(),
        buyerId: user.id,
        status: "OPEN" as const,
        createdAt: new Date().toISOString(),
      };
      s.requests.push(r);
      return r;
    });
  }
  async bid(user: PublicUser, input: unknown) {
    const data = z
      .object({
        requestId: z.string(),
        shopId: z.string(),
        price: z.coerce.number().positive().max(10000000),
        note: z.string().max(500).default(""),
      })
      .parse(input);
    return this.db.mutate((s) => {
      ownedShop(s, data.shopId, user);
      const request = s.requests.find(
        (r) => r.id === data.requestId && r.status === "OPEN",
      );
      if (!request) throw new BadRequestException("Request is closed.");
      if (request.buyerId === user.id)
        throw new BadRequestException("You cannot bid on your own request.");
      if (
        !s.listings.some(
          (l) =>
            l.shopId === data.shopId &&
            l.productId === request.productId &&
            l.active &&
            l.stock >= request.quantity,
        )
      )
        throw new BadRequestException(
          "Add an in-stock listing for this product first.",
        );
      if (
        s.bids.some(
          (b) => b.requestId === data.requestId && b.shopId === data.shopId,
        )
      )
        throw new BadRequestException("Your shop already submitted an offer.");
      const bid = {
        ...data,
        id: randomUUID(),
        createdAt: new Date().toISOString(),
      };
      s.bids.push(bid);
      s.notifications.push({
        id: randomUUID(),
        userId: request.buyerId,
        title: "A local seller made you an offer",
        read: false,
        createdAt: new Date().toISOString(),
      });
      return bid;
    });
  }
  async requests(user: PublicUser) {
    const s = await this.db.read();
    return s.requests
      .filter((r) => r.buyerId === user.id)
      .map((r) => ({
        ...r,
        product: s.products.find((p) => p.id === r.productId),
        bids: s.bids
          .filter((b) => b.requestId === r.id)
          .map((b) => ({
            ...b,
            shop: s.shops.find((sh) => sh.id === b.shopId),
            listingId: s.listings.find(
              (l) => l.shopId === b.shopId && l.productId === r.productId,
            )?.id,
          })),
      }));
  }
  async placeBid(user: PublicUser, input: unknown) {
    const data = listingBidSchema.parse(input);
    return this.db.mutate((s) => {
      const listing = s.listings.find((l) => l.id === data.listingId && l.active);
      if (!listing) throw new NotFoundException("Listing not found.");
      const mode = listing.pricingMode ?? "FIXED";
      if (mode !== "BIDDING")
        throw new BadRequestException("This listing does not accept bids.");
      if (listing.biddingOpen === false)
        throw new BadRequestException("Bidding is closed for this listing.");
      if (listing.biddingDeadline && new Date(listing.biddingDeadline) <= new Date())
        throw new BadRequestException("The bidding deadline has passed.");
      if (listing.minBid && data.offeredPrice < listing.minBid)
        throw new BadRequestException(
          `Your bid must be at least ${listing.minBid}.`
        );
      if (listing.stock < data.quantity)
        throw new BadRequestException("Insufficient stock available.");
      const shop = s.shops.find((sh) => sh.id === listing.shopId)!;
      if (shop.ownerId === user.id)
        throw new BadRequestException("You cannot bid on your own listing.");
      const existing = s.listingBids.find(
        (b) => b.listingId === data.listingId && b.buyerId === user.id && ["PENDING", "ACCEPTED"].includes(b.status)
      );
      if (existing)
        throw new BadRequestException("You already have an active bid on this listing.");
      const now = new Date().toISOString();
      const bid: import("../../../packages/shared/src").ListingBid = {
        id: randomUUID(),
        listingId: data.listingId,
        productId: listing.productId,
        shopId: listing.shopId,
        buyerId: user.id,
        offeredPrice: data.offeredPrice,
        quantity: data.quantity,
        status: "PENDING",
        note: data.note,
        createdAt: now,
        updatedAt: now,
      };
      s.listingBids.push(bid);
      s.notifications.push({
        id: randomUUID(),
        userId: shop.ownerId,
        title: "New bid received on your listing",
        read: false,
        createdAt: now,
      });
      return bid;
    });
  }
  async acceptListingBid(user: PublicUser, bidId: string) {
    return this.db.mutate((s) => {
      const bid = s.listingBids.find((b) => b.id === bidId);
      if (!bid) throw new NotFoundException("Bid not found.");
      const shop = s.shops.find((sh) => sh.id === bid.shopId);
      if (!shop || shop.ownerId !== user.id)
        throw new ForbiddenException("You do not own this listing.");
      if (bid.status !== "PENDING")
        throw new BadRequestException(`Bid is already ${bid.status.toLowerCase()}.`);
      const listing = s.listings.find((l) => l.id === bid.listingId);
      if (!listing || !listing.active)
        throw new BadRequestException("Listing is no longer active.");
      if (listing.stock < bid.quantity)
        throw new BadRequestException("Insufficient stock to accept this bid.");
      listing.stock -= bid.quantity;
      bid.status = "ACCEPTED";
      bid.updatedAt = new Date().toISOString();
      const now = new Date().toISOString();
      s.transactions.push({
        id: randomUUID(),
        buyerId: bid.buyerId,
        shopId: bid.shopId,
        listingId: bid.listingId,
        productId: bid.productId,
        quantity: bid.quantity,
        basePrice: listing.price,
        finalPrice: bid.offeredPrice,
        total: Math.round(bid.offeredPrice * bid.quantity * 100) / 100,
        status: "CONFIRMED",
        pickupOtp: randomInt(100000, 1000000).toString(),
        createdAt: now,
      });
      s.notifications.push({
        id: randomUUID(),
        userId: bid.buyerId,
        title: "Your bid was accepted!",
        read: false,
        createdAt: now,
      });
      return bid;
    });
  }
  async rejectListingBid(user: PublicUser, bidId: string) {
    return this.db.mutate((s) => {
      const bid = s.listingBids.find((b) => b.id === bidId);
      if (!bid) throw new NotFoundException("Bid not found.");
      const shop = s.shops.find((sh) => sh.id === bid.shopId);
      if (!shop || shop.ownerId !== user.id)
        throw new ForbiddenException("You do not own this listing.");
      if (bid.status !== "PENDING")
        throw new BadRequestException(`Bid is already ${bid.status.toLowerCase()}.`);
      bid.status = "REJECTED";
      bid.updatedAt = new Date().toISOString();
      s.notifications.push({
        id: randomUUID(),
        userId: bid.buyerId,
        title: "Your bid was not accepted",
        read: false,
        createdAt: new Date().toISOString(),
      });
      return bid;
    });
  }
  async buyerListingBids(user: PublicUser) {
    const s = await this.db.read();
    return s.listingBids
      .filter((b) => b.buyerId === user.id)
      .map((b) => ({
        ...b,
        product: s.products.find((p) => p.id === b.productId),
        shop: s.shops.find((sh) => sh.id === b.shopId),
        listing: s.listings.find((l) => l.id === b.listingId),
      }));
  }
  async sellerListingBids(user: PublicUser) {
    const s = await this.db.read();
    const shopIds = s.shops
      .filter((sh) => sh.ownerId === user.id)
      .map((sh) => sh.id);
    return s.listingBids
      .filter((b) => shopIds.includes(b.shopId))
      .map((b) => ({
        ...b,
        product: s.products.find((p) => p.id === b.productId),
        listing: s.listings.find((l) => l.id === b.listingId),
      }));
  }

  private geocodeCache = new Map<string, GeocodeResult[]>();

  async geocode(query: string): Promise<GeocodeResult[]> {
    const q = query.trim().toLowerCase();
    if (!q) return [];
    if (this.geocodeCache.has(q)) {
      return this.geocodeCache.get(q)!;
    }

    try {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), 3500);
      const url = "https://nominatim.openstreetmap.org/search?format=json&addressdetails=1&limit=5&q=" + encodeURIComponent(query);
      const res = await fetch(url, {
        signal: controller.signal,
        headers: {
          "User-Agent": "Aroundly-Marketplace/1.0",
          "Accept": "application/json",
        },
      });
      clearTimeout(timer);
      if (res.ok) {
        const raw = (await res.json()) as Array<{
          lat: string;
          lon: string;
          display_name: string;
          name?: string;
          address?: {
            city?: string;
            town?: string;
            suburb?: string;
            state?: string;
            country?: string;
            postcode?: string;
          };
        }>;
        if (Array.isArray(raw) && raw.length > 0) {
          const results: GeocodeResult[] = raw.map((r) => {
            const cityName = r.address?.city || r.address?.town || r.address?.suburb;
            return {
              name: r.name || cityName || r.display_name.split(",")[0].trim(),
              lat: Number(parseFloat(r.lat).toFixed(6)),
              lng: Number(parseFloat(r.lon).toFixed(6)),
              city: cityName,
              state: r.address?.state,
              country: r.address?.country,
              displayName: r.display_name,
            };
          });
          this.geocodeCache.set(q, results);
          return results;
        }
      }
    } catch {
      // Nominatim failed or timed out; fall through to built-in locations
    }

    const matches: GeocodeResult[] = POPULAR_LOCATIONS.filter((loc) => {
      const locName = loc.name.toLowerCase();
      const locCity = (loc.city || "").toLowerCase();
      return (
        locName.includes(q) ||
        locCity.includes(q) ||
        q.includes(locCity) ||
        q.includes(locName.split(",")[0].toLowerCase())
      );
    }).map((loc) => ({
      name: loc.name,
      lat: loc.lat,
      lng: loc.lng,
      city: loc.city,
      country: "India",
      displayName: loc.name,
    }));

    if (matches.length > 0) {
      this.geocodeCache.set(q, matches);
      return matches;
    }

    return [];
  }
}
