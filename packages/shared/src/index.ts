export type Role = "BUYER" | "SELLER" | "ADMIN";
export interface User {
  id: string;
  name: string;
  email: string;
  passwordHash: string;
  roles: Role[];
  verified: boolean;
  active: boolean;
}
export interface Product {
  id: string;
  name: string;
  category: string;
  brand: string;
  description: string;
  image: string;
  rating: number;
  reviews: number;
  unique: boolean;
  tags: string[];
}
export interface Shop {
  id: string;
  ownerId: string;
  name: string;
  description: string;
  address: string;
  lat: number;
  lng: number;
  image: string;
  rating: number;
  reviews: number;
  verified: boolean;
  hours: { open: string; close: string; days: number[] };
  phone: string;
  completed: number;
  distance?: number;
  isOpen?: boolean;
  trust?: number;
}
export interface Listing {
  id: string;
  productId: string;
  shopId: string;
  price: number;
  stock: number;
  active: boolean;
}
export interface Offer {
  id: string;
  listingId: string;
  type: "PERCENT" | "FIXED";
  value: number;
  startsAt: string;
  endsAt: string;
  enabled: boolean;
  title: string;
}
export interface Transaction {
  id: string;
  buyerId: string;
  shopId: string;
  listingId: string;
  productId: string;
  quantity: number;
  basePrice: number;
  finalPrice: number;
  total: number;
  status: "INITIATED" | "CONFIRMED" | "COMPLETED" | "CANCELLED";
  createdAt: string;
}
export interface Review {
  id: string;
  transactionId: string;
  userId: string;
  shopId: string;
  productId: string;
  rating: number;
  text: string;
  createdAt: string;
}
export interface BidRequest {
  id: string;
  buyerId: string;
  productId: string;
  quantity: number;
  targetPrice: number;
  note: string;
  status: "OPEN" | "CLOSED";
  createdAt: string;
}
export interface Bid {
  id: string;
  requestId: string;
  shopId: string;
  price: number;
  note: string;
  createdAt: string;
}
export interface Session {
  id: string;
  userId: string;
  hash: string;
  expiresAt: string;
}
export interface Notification {
  id: string;
  userId: string;
  title: string;
  read: boolean;
  createdAt: string;
}
export interface Store {
  users: User[];
  products: Product[];
  shops: Shop[];
  listings: Listing[];
  offers: Offer[];
  transactions: Transaction[];
  reviews: Review[];
  favorites: { userId: string; targetId: string; kind: "product" | "shop" }[];
  sessions: Session[];
  tokens: {
    hash: string;
    userId: string;
    kind: "reset" | "verify";
    expiresAt: string;
  }[];
  notifications: Notification[];
  requests: BidRequest[];
  bids: Bid[];
  audits: { id: string; actorId: string; action: string; createdAt: string }[];
}
export interface ProductResult extends Product {
  price: number;
  maxPrice: number;
  sellerCount: number;
  distance: number;
  discount: number;
}
export interface ListingResult extends Listing {
  shop: Shop;
  finalPrice: number;
  offer?: Offer;
  loyaltyDiscount: number;
}
export type PublicUser = Omit<User, "passwordHash">;
export function finalPrice(
  price: number,
  offer?: Offer,
  now = new Date(),
  loyalty = 0,
): number {
  let value = price;
  if (
    offer?.enabled &&
    new Date(offer.startsAt) <= now &&
    new Date(offer.endsAt) > now
  )
    value -=
      offer.type === "PERCENT"
        ? (price * Math.min(100, Math.max(0, offer.value))) / 100
        : Math.max(0, offer.value);
  return (
    Math.round(
      Math.max(0, value) * (1 - Math.min(10, Math.max(0, loyalty)) / 100) * 100,
    ) / 100
  );
}
export function shopOpen(hours: Shop["hours"], now = new Date()): boolean {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: "Asia/Kolkata",
    weekday: "short",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).formatToParts(now);
  const part = (type: string) =>
    parts.find((p) => p.type === type)?.value || "";
  const day = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].indexOf(
    part("weekday"),
  );
  const time = `${part("hour")}:${part("minute")}`;
  if (hours.close > hours.open)
    return hours.days.includes(day) && time >= hours.open && time < hours.close;
  return (
    (hours.days.includes(day) && time >= hours.open) ||
    (hours.days.includes((day + 6) % 7) && time < hours.close)
  );
}
export function trustScore(
  shop: Pick<
    Shop,
    "verified" | "completed" | "rating" | "description" | "phone"
  >,
): number {
  // Verification 25, completed purchases 25 (capped at 100), rating 40, complete profile 10.
  return Math.round(
    (shop.verified ? 25 : 0) +
      Math.min(25, shop.completed / 4) +
      shop.rating * 8 +
      (shop.description && shop.phone ? 10 : 0),
  );
}
export function distanceKm(
  lat: number,
  lng: number,
  otherLat: number,
  otherLng: number,
): number {
  const rad = (v: number) => (v * Math.PI) / 180;
  const a =
    Math.sin(rad(otherLat - lat) / 2) ** 2 +
    Math.cos(rad(lat)) *
      Math.cos(rad(otherLat)) *
      Math.sin(rad(otherLng - lng) / 2) ** 2;
  return 6371 * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}
export const money = (n: number) =>
  new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 0,
  }).format(n);
