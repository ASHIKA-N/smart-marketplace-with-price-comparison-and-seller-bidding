import {
  Inject,
  Injectable,
  BadRequestException,
  ForbiddenException,
  NotFoundException,
} from "@nestjs/common";
import { randomUUID } from "node:crypto";
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
} from "../../../packages/shared/src";
export const searchSchema = z.object({
  q: z.string().max(100).default(""),
  category: z.string().max(80).default("All"),
  lat: z.coerce.number().min(-90).max(90).default(12.9352),
  lng: z.coerce.number().min(-180).max(180).default(77.6245),
  radius: z.coerce.number().positive().max(100).default(10),
  min: z.coerce.number().nonnegative().default(0),
  max: z.coerce.number().nonnegative().default(1000000),
  rating: z.coerce.number().min(0).max(5).default(0),
  inStock: z.enum(["true", "false"]).default("false"),
  open: z.enum(["true", "false"]).default("false"),
  unique: z.enum(["true", "false"]).default("false"),
  sort: z
    .enum(["popular", "price", "nearest", "rating", "deal"])
    .default("popular"),
  page: z.coerce.number().int().min(1).max(10000).default(1),
  limit: z.coerce.number().int().min(1).max(48).default(24),
});
export const shopSchema = z.object({
  name: z.string().min(3).max(100),
  description: z.string().min(10).max(2000),
  address: z.string().min(5).max(300),
  lat: z.coerce.number().min(-90).max(90),
  lng: z.coerce.number().min(-180).max(180),
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
            discount: Math.round((1 - best.finalPrice / best.price) * 100),
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
      reviews: s.reviews.filter((r) => r.shopId === id),
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
      reviews: s.reviews.filter((r) => r.productId === id),
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
    const { status } = z
      .object({ status: z.enum(["CONFIRMED", "COMPLETED", "CANCELLED"]) })
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
      t.status = status;
      if (status === "CANCELLED")
        s.listings.find((l) => l.id === t.listingId)!.stock += t.quantity;
      if (status === "COMPLETED") shop.completed++;
      s.notifications.push({
        id: randomUUID(),
        userId: t.buyerId,
        title: `Reservation ${status.toLowerCase()}`,
        read: false,
        createdAt: new Date().toISOString(),
      });
      return t;
    });
  }
  async review(user: PublicUser, input: unknown) {
    const data = z
      .object({
        transactionId: z.string(),
        rating: z.coerce.number().int().min(1).max(5),
        text: z.string().min(5).max(2000),
      })
      .parse(input);
    return this.db.mutate((s) => {
      const t = s.transactions.find(
        (t) =>
          t.id === data.transactionId &&
          t.buyerId === user.id &&
          t.status === "COMPLETED",
      );
      if (!t) throw new ForbiddenException("A completed purchase is required.");
      if (s.reviews.some((r) => r.transactionId === t.id))
        throw new BadRequestException("You already reviewed this purchase.");
      const r = {
        ...data,
        id: randomUUID(),
        userId: user.id,
        shopId: t.shopId,
        productId: t.productId,
        createdAt: new Date().toISOString(),
      };
      s.reviews.push(r);
      for (const item of [
        s.products.find((p) => p.id === t.productId)!,
        s.shops.find((sh) => sh.id === t.shopId)!,
      ]) {
        item.rating =
          Math.round(
            ((item.rating * item.reviews + data.rating) / (item.reviews + 1)) *
              10,
          ) / 10;
        item.reviews++;
      }
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
      }));
  }
  async favorites(user: PublicUser) {
    const s = await this.db.read();
    return s.favorites.filter((f) => f.userId === user.id);
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
}
