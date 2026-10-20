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
  city?: string;
  state?: string;
  postalCode?: string;
  country?: string;
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
  price: number;       // fixed price OR reference price for bidding
  stock: number;
  active: boolean;
  pricingMode?: "FIXED" | "BIDDING";  // default FIXED if absent
  minBid?: number;          // minimum bid amount (BIDDING mode)
  biddingDeadline?: string | null; // ISO datetime, optional
  biddingOpen?: boolean;    // if false, bidding closed
  unit?: string;            // e.g. "kg", "pcs", "each"
}
export interface ListingBid {
  id: string;
  listingId: string;
  productId: string;
  shopId: string;
  buyerId: string;
  offeredPrice: number;
  quantity: number;
  status: "PENDING" | "ACCEPTED" | "REJECTED" | "WITHDRAWN" | "EXPIRED";
  note: string;
  createdAt: string;
  updatedAt: string;
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
  pickupOtp?: string;
  completedAt?: string;
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
  updatedAt?: string;
  userName?: string;
  reply?: string;
  repliedAt?: string;
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
  listingBids: ListingBid[];
}
export interface ProductResult extends Product {
  price: number;
  maxPrice: number;
  sellerCount: number;
  distance: number;
  discount: number;
  pricingMode?: "FIXED" | "BIDDING";
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

export function isValidCoordinate(lat: number, lng: number): boolean {
  return (
    typeof lat === "number" &&
    !isNaN(lat) &&
    lat >= -90 &&
    lat <= 90 &&
    typeof lng === "number" &&
    !isNaN(lng) &&
    lng >= -180 &&
    lng <= 180
  );
}

export const CHENNAI_BOUNDS = {
  minLat: 12.8,
  maxLat: 13.3,
  minLng: 80.0,
  maxLng: 80.35,
};

export function isWithinChennai(lat: number, lng: number): boolean {
  return (
    lat >= CHENNAI_BOUNDS.minLat &&
    lat <= CHENNAI_BOUNDS.maxLat &&
    lng >= CHENNAI_BOUNDS.minLng &&
    lng <= CHENNAI_BOUNDS.maxLng
  );
}

export const POPULAR_LOCATIONS = [
  // Bengaluru
  { name: "Koramangala, Bengaluru", lat: 12.9352, lng: 77.6245, city: "Bengaluru" },
  { name: "Indiranagar, Bengaluru", lat: 12.9784, lng: 77.6408, city: "Bengaluru" },
  { name: "HSR Layout, Bengaluru", lat: 12.9121, lng: 77.6446, city: "Bengaluru" },
  { name: "Whitefield, Bengaluru", lat: 12.9698, lng: 77.75, city: "Bengaluru" },
  { name: "Jayanagar, Bengaluru", lat: 12.9308, lng: 77.5838, city: "Bengaluru" },
  { name: "MG Road, Bengaluru", lat: 12.9756, lng: 77.6066, city: "Bengaluru" },
  { name: "Bengaluru (Central)", lat: 12.9716, lng: 77.5946, city: "Bengaluru" },
  // Chennai
  { name: "T. Nagar, Chennai", lat: 13.0418, lng: 80.2341, city: "Chennai" },
  { name: "Anna Nagar, Chennai", lat: 13.085, lng: 80.2101, city: "Chennai" },
  { name: "Adyar, Chennai", lat: 13.0067, lng: 80.2206, city: "Chennai" },
  { name: "Mylapore, Chennai", lat: 13.0368, lng: 80.2676, city: "Chennai" },
  { name: "Velachery, Chennai", lat: 12.9815, lng: 80.218, city: "Chennai" },
  { name: "OMR / Thoraipakkam, Chennai", lat: 12.9438, lng: 80.2366, city: "Chennai" },
  // Mumbai
  { name: "Bandra West, Mumbai", lat: 19.0596, lng: 72.8295, city: "Mumbai" },
  { name: "Andheri West, Mumbai", lat: 19.1136, lng: 72.8697, city: "Mumbai" },
  { name: "Colaba, Mumbai", lat: 18.9067, lng: 72.8147, city: "Mumbai" },
  { name: "Powai, Mumbai", lat: 19.1176, lng: 72.906, city: "Mumbai" },
  // Delhi NCR
  { name: "Connaught Place, New Delhi", lat: 28.6304, lng: 77.2177, city: "Delhi" },
  { name: "Hauz Khas, New Delhi", lat: 28.5494, lng: 77.2001, city: "Delhi" },
  { name: "Cyber City, Gurugram", lat: 28.4952, lng: 77.0894, city: "Gurugram" },
  // Hyderabad
  { name: "HITEC City, Hyderabad", lat: 17.4435, lng: 78.3772, city: "Hyderabad" },
  { name: "Banjara Hills, Hyderabad", lat: 17.4156, lng: 78.435, city: "Hyderabad" },
  // Pune & Kolkata
  { name: "Koregaon Park, Pune", lat: 18.5362, lng: 73.894, city: "Pune" },
  { name: "Park Street, Kolkata", lat: 22.5516, lng: 88.3524, city: "Kolkata" },
];

export const CHENNAI_NEIGHBOURHOODS = [
  { name: "T. Nagar, Chennai", lat: 13.0418, lng: 80.2341 },
  { name: "Anna Nagar, Chennai", lat: 13.085, lng: 80.2101 },
  { name: "Adyar, Chennai", lat: 13.0067, lng: 80.2206 },
  { name: "Mylapore, Chennai", lat: 13.0368, lng: 80.2676 },
  { name: "Velachery, Chennai", lat: 12.9815, lng: 80.218 },
  { name: "Guindy, Chennai", lat: 13.0067, lng: 80.2025 },
  { name: "Nungambakkam, Chennai", lat: 13.0569, lng: 80.2425 },
  { name: "Kilpauk, Chennai", lat: 13.0784, lng: 80.2407 },
  { name: "Alwarpet, Chennai", lat: 13.0336, lng: 80.252 },
  { name: "Besant Nagar, Chennai", lat: 13.0001, lng: 80.2667 },
  { name: "Porur, Chennai", lat: 13.0382, lng: 80.1565 },
  { name: "Tambaram, Chennai", lat: 12.9249, lng: 80.1 },
  { name: "OMR / Thoraipakkam, Chennai", lat: 12.9438, lng: 80.2366 },
  { name: "Royapettah, Chennai", lat: 13.0587, lng: 80.2642 },
  { name: "Egmore, Chennai", lat: 13.0732, lng: 80.2609 },
  { name: "Kodambakkam, Chennai", lat: 13.0514, lng: 80.2241 },
];
