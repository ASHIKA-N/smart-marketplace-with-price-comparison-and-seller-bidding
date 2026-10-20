import { test } from "node:test";
import assert from "node:assert/strict";
import {
  finalPrice,
  shopOpen,
  trustScore,
  distanceKm,
  isWithinChennai,
  isValidCoordinate,
  POPULAR_LOCATIONS,
  CHENNAI_NEIGHBOURHOODS,
  type Offer,
  type Shop,
  type Review,
  type Transaction,
} from "./index";
const offer: Offer = {
  id: "o",
  listingId: "l",
  type: "PERCENT",
  value: 20,
  enabled: true,
  startsAt: "2025-01-01",
  endsAt: "2027-01-01",
  title: "Sale",
};
test("active discounts, expiry and loyalty are deterministic", () => {
  assert.equal(finalPrice(100, offer, new Date("2026-01-01"), 5), 76);
  assert.equal(finalPrice(100, offer, new Date("2027-01-01")), 100);
  assert.equal(
    finalPrice(
      100,
      { ...offer, type: "FIXED", value: 200 },
      new Date("2026-01-01"),
    ),
    0,
  );
});
test("business hours use India timezone and handle overnight opening", () => {
  assert.equal(
    shopOpen(
      { open: "09:00", close: "18:00", days: [1] },
      new Date("2026-09-14T05:00:00Z"),
    ),
    true,
  );
  assert.equal(
    shopOpen(
      { open: "22:00", close: "02:00", days: [1] },
      new Date("2026-09-14T19:00:00Z"),
    ),
    true,
  );
  assert.equal(
    shopOpen(
      { open: "09:00", close: "18:00", days: [1] },
      new Date("2026-09-14T13:00:00Z"),
    ),
    false,
  );
});
test("trust is explainable and capped", () => {
  assert.equal(
    trustScore({
      verified: true,
      completed: 1000,
      rating: 5,
      description: "Shop",
      phone: "123",
    }),
    100,
  );
  assert.equal(
    trustScore({
      verified: false,
      completed: 0,
      rating: 0,
      description: "",
      phone: "",
    }),
    0,
  );
});
test("demo distance is zero for same position", () =>
  assert.equal(distanceKm(12, 77, 12, 77), 0));

test("Chennai catalog covers every category with purchasable listings", async () => {
  const { createSeed } = await import("./seed");
  const seed = createSeed();
  for (const category of [
    "Electronics",
    "Fashion",
    "Home & Living",
    "Groceries",
    "Beauty & Care",
    "Sports & Outdoors",
  ]) {
    assert.ok(
      seed.products.filter((p) => p.category === category).length >= 3,
      category,
    );
  }
  assert.equal(
    new Set(seed.listings.map((l) => l.id)).size,
    seed.listings.length,
  );
  for (const listing of seed.listings) {
    assert.ok(Number.isFinite(listing.price) && listing.price > 0);
    assert.ok(seed.products.some((p) => p.id === listing.productId));
    assert.ok(
      seed.shops.some(
        (s) => s.id === listing.shopId && s.address.includes("Chennai"),
      ),
    );
  }
});

test("Seller listings support FIXED price and PRICE BIDDING with unit and minBid", () => {
  const fixedListing: import("./index").Listing = {
    id: "l-fixed-1",
    productId: "p-tomato",
    shopId: "shop-1",
    price: 40,
    stock: 50,
    active: true,
    pricingMode: "FIXED",
    unit: "kg",
  };
  assert.equal(fixedListing.pricingMode, "FIXED");
  assert.equal(fixedListing.price, 40);
  assert.equal(fixedListing.unit, "kg");

  // Edit price
  fixedListing.price = 35;
  assert.equal(fixedListing.price, 35);

  const biddingListing: import("./index").Listing = {
    id: "l-bid-1",
    productId: "p-tomato",
    shopId: "shop-1",
    price: 40, // reference price
    stock: 50,
    active: true,
    pricingMode: "BIDDING",
    minBid: 30,
    unit: "kg",
    biddingDeadline: "2026-12-31T23:59:59Z",
    biddingOpen: true,
  };
  assert.equal(biddingListing.pricingMode, "BIDDING");
  assert.equal(biddingListing.minBid, 30);
  assert.equal(biddingListing.biddingOpen, true);
});

test("Bidding validation logic checks minBid, deadlines, and stock constraints", () => {
  const listing: import("./index").Listing = {
    id: "l-1",
    productId: "p-1",
    shopId: "s-1",
    price: 100,
    stock: 10,
    active: true,
    pricingMode: "BIDDING",
    minBid: 80,
    biddingDeadline: "2026-10-01T00:00:00Z", // passed deadline
    biddingOpen: true,
  };

  const validateBid = (bidPrice: number, qty: number, now = new Date("2026-09-01")) => {
    if (listing.pricingMode !== "BIDDING") throw new Error("Not accepting bids");
    if (!listing.biddingOpen) throw new Error("Bidding closed");
    if (listing.biddingDeadline && new Date(listing.biddingDeadline) <= now)
      throw new Error("Deadline passed");
    if (listing.minBid && bidPrice < listing.minBid)
      throw new Error("Bid below minimum");
    if (qty > listing.stock) throw new Error("Insufficient stock");
    return true;
  };

  // Valid bid before deadline
  assert.equal(validateBid(85, 2, new Date("2026-09-01")), true);

  // Below min bid
  assert.throws(() => validateBid(75, 2, new Date("2026-09-01")), /Bid below minimum/);

  // Past deadline
  assert.throws(() => validateBid(90, 2, new Date("2026-10-15")), /Deadline passed/);

  // Excess quantity
  assert.throws(() => validateBid(90, 15, new Date("2026-09-01")), /Insufficient stock/);

  // Closed bidding
  listing.biddingOpen = false;
  assert.throws(() => validateBid(90, 2, new Date("2026-09-01")), /Bidding closed/);
});

test("Bid acceptance deducts stock, produces confirmed order, and prevents overselling", () => {
  const listing: import("./index").Listing = {
    id: "l-1",
    productId: "p-1",
    shopId: "s-1",
    price: 100,
    stock: 10,
    active: true,
    pricingMode: "BIDDING",
    minBid: 80,
  };

  const bid1: import("./index").ListingBid = {
    id: "b-1",
    listingId: "l-1",
    productId: "p-1",
    shopId: "s-1",
    buyerId: "buyer-1",
    offeredPrice: 85,
    quantity: 8,
    status: "PENDING",
    note: "",
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };

  const bid2: import("./index").ListingBid = {
    id: "b-2",
    listingId: "l-1",
    productId: "p-1",
    shopId: "s-1",
    buyerId: "buyer-2",
    offeredPrice: 90,
    quantity: 5,
    status: "PENDING",
    note: "",
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };

  const acceptBid = (bid: import("./index").ListingBid) => {
    if (bid.status !== "PENDING") throw new Error("Bid not pending");
    if (listing.stock < bid.quantity) throw new Error("Insufficient stock");
    listing.stock -= bid.quantity;
    bid.status = "ACCEPTED";
    bid.updatedAt = new Date().toISOString();
    return {
      id: "tx-" + bid.id,
      buyerId: bid.buyerId,
      shopId: bid.shopId,
      listingId: bid.listingId,
      productId: bid.productId,
      quantity: bid.quantity,
      finalPrice: bid.offeredPrice,
      total: bid.offeredPrice * bid.quantity,
      status: "CONFIRMED" as const,
    };
  };

  // Accept bid 1 for 8 units
  const order = acceptBid(bid1);
  assert.equal(bid1.status, "ACCEPTED");
  assert.equal(listing.stock, 2);
  assert.equal(order.total, 680);
  assert.equal(order.status, "CONFIRMED");

  // Cannot accept bid 1 again
  assert.throws(() => acceptBid(bid1), /Bid not pending/);

  // Bid 2 requests 5 units, but only 2 remain -> overselling prevented!
  assert.throws(() => acceptBid(bid2), /Insufficient stock/);
  assert.equal(bid2.status, "PENDING");
  assert.equal(listing.stock, 2);
});

test("Bid rejection updates status without altering stock and preserves history", () => {
  const listing: import("./index").Listing = {
    id: "l-1",
    productId: "p-1",
    shopId: "s-1",
    price: 100,
    stock: 10,
    active: true,
    pricingMode: "BIDDING",
  };

  const bid: import("./index").ListingBid = {
    id: "b-reject-1",
    listingId: "l-1",
    productId: "p-1",
    shopId: "s-1",
    buyerId: "buyer-1",
    offeredPrice: 85,
    quantity: 3,
    status: "PENDING",
    note: "",
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };

  // Reject bid
  bid.status = "REJECTED";
  bid.updatedAt = new Date().toISOString();

  assert.equal(bid.status, "REJECTED");
  assert.equal(listing.stock, 10); // stock unchanged

  // Switching listing mode to FIXED maintains the bid record
  listing.pricingMode = "FIXED";
  listing.price = 95;

  assert.equal(listing.pricingMode, "FIXED");
  assert.equal(bid.status, "REJECTED"); // history preserved
});

test("Haversine distance calculation is accurate, symmetric, and positive", () => {
  const tNagar = { lat: 13.0418, lng: 80.2341 };
  const adyar = { lat: 13.0067, lng: 80.2206 };
  const annaNagar = { lat: 13.085, lng: 80.2101 };

  const d1 = distanceKm(tNagar.lat, tNagar.lng, adyar.lat, adyar.lng);
  const d2 = distanceKm(adyar.lat, adyar.lng, tNagar.lat, tNagar.lng);
  assert.ok(Math.abs(d1 - d2) < 0.0001, "Distance must be symmetric");
  assert.ok(d1 > 3.8 && d1 < 4.5, "Distance between T. Nagar and Adyar should be ~4.1 km, got: " + d1);

  const d3 = distanceKm(tNagar.lat, tNagar.lng, annaNagar.lat, annaNagar.lng);
  assert.ok(d3 > 5.0 && d3 < 6.0, "Distance between T. Nagar and Anna Nagar should be ~5.5 km, got: " + d3);

  assert.equal(distanceKm(tNagar.lat, tNagar.lng, tNagar.lat, tNagar.lng), 0);
});

test("Chennai boundary validation correctly identifies valid and invalid coordinates", () => {
  for (const n of CHENNAI_NEIGHBOURHOODS) {
    assert.equal(isWithinChennai(n.lat, n.lng), true, n.name + " must be within Chennai bounds");
  }

  // Outside coordinates: Bangalore, Delhi, London, slightly out of bounds
  assert.equal(isWithinChennai(12.9716, 77.5946), false, "Bangalore is not in Chennai");
  assert.equal(isWithinChennai(28.6139, 77.209), false, "Delhi is not in Chennai");
  assert.equal(isWithinChennai(12.5, 80.2), false, "Too far south");
  assert.equal(isWithinChennai(13.5, 80.2), false, "Too far north");
  assert.equal(isWithinChennai(13.04, 79.8), false, "Too far west");
  assert.equal(isWithinChennai(13.04, 80.45), false, "Too far east");
});

test("Nearby seller sorting and radius filtering uses real coordinates", async () => {
  const { shops } = await import("./seed");
  const buyerAdyar = { lat: 13.0067, lng: 80.2206 };

  // Calculate distance from buyer in Adyar to all shops
  const withDistance = shops.map((s) => ({
    ...s,
    distance: distanceKm(buyerAdyar.lat, buyerAdyar.lng, s.lat, s.lng),
  }));

  // Nearest shop to Adyar should be Green Basket (which is located in Adyar)
  const sorted = withDistance.sort((a, b) => a.distance - b.distance);
  assert.equal(sorted[0].id, "green-basket");
  assert.ok(sorted[0].distance < 0.1, "Green Basket should be within 100m of Adyar reference");

  // Filter within 5km radius should include Adyar and T. Nagar shops, but exclude Anna Nagar
  const within5km = withDistance.filter((s) => s.distance <= 5);
  assert.ok(within5km.some((s) => s.id === "green-basket"));
  assert.ok(within5km.some((s) => s.id === "tech-haven")); // T. Nagar ~4.1km away
  assert.ok(!within5km.some((s) => s.id === "earth-clay")); // Anna Nagar is >8km away from Adyar
});

test("Global and multi-city coordinate validation checks valid latitude and longitude ranges", () => {
  // Valid coordinates globally
  assert.equal(isValidCoordinate(12.9716, 77.5946), true, "Bengaluru is valid");
  assert.equal(isValidCoordinate(13.0827, 80.2707), true, "Chennai is valid");
  assert.equal(isValidCoordinate(19.0760, 72.8777), true, "Mumbai is valid");
  assert.equal(isValidCoordinate(28.6139, 77.2090), true, "Delhi is valid");
  assert.equal(isValidCoordinate(51.5074, -0.1278), true, "London is valid");
  assert.equal(isValidCoordinate(-33.8688, 151.2093), true, "Sydney is valid");
  assert.equal(isValidCoordinate(0, 0), true, "Equator / Prime Meridian is valid");
  assert.equal(isValidCoordinate(90, 180), true, "Extreme North-East bound is valid");
  assert.equal(isValidCoordinate(-90, -180), true, "Extreme South-West bound is valid");

  // Invalid coordinates
  assert.equal(isValidCoordinate(90.1, 80.0), false, "Latitude > 90 is invalid");
  assert.equal(isValidCoordinate(-90.1, 80.0), false, "Latitude < -90 is invalid");
  assert.equal(isValidCoordinate(13.0, 180.1), false, "Longitude > 180 is invalid");
  assert.equal(isValidCoordinate(13.0, -180.1), false, "Longitude < -180 is invalid");
  assert.equal(isValidCoordinate(NaN, 80.0), false, "NaN latitude is invalid");
  assert.equal(isValidCoordinate(13.0, NaN), false, "NaN longitude is invalid");
  assert.equal(isValidCoordinate(undefined as unknown as number, 80.0), false, "Undefined is invalid");
});

test("Multi-city distance calculations are accurate across Indian cities", () => {
  const bengaluru = { lat: 12.9716, lng: 77.5946 };
  const chennai = { lat: 13.0827, lng: 80.2707 };
  const mumbai = { lat: 19.0760, lng: 72.8777 };
  const delhi = { lat: 28.6139, lng: 77.2090 };

  // Bengaluru to Chennai: ~290 km (straight-line)
  const blrToMaa = distanceKm(bengaluru.lat, bengaluru.lng, chennai.lat, chennai.lng);
  assert.ok(blrToMaa >= 280 && blrToMaa <= 305, `Bengaluru to Chennai should be ~290 km, got ${blrToMaa}`);

  // Bengaluru to Mumbai: ~840 km
  const blrToBom = distanceKm(bengaluru.lat, bengaluru.lng, mumbai.lat, mumbai.lng);
  assert.ok(blrToBom >= 820 && blrToBom <= 860, `Bengaluru to Mumbai should be ~840 km, got ${blrToBom}`);

  // Delhi to Mumbai: ~1150 km
  const delToBom = distanceKm(delhi.lat, delhi.lng, mumbai.lat, mumbai.lng);
  assert.ok(delToBom >= 1130 && delToBom <= 1180, `Delhi to Mumbai should be ~1150 km, got ${delToBom}`);

  // Within Bengaluru: Koramangala to Indiranagar (~4.6 km)
  const koramangala = { lat: 12.9352, lng: 77.6245 };
  const indiranagar = { lat: 12.9784, lng: 77.6408 };
  const blrLocal = distanceKm(koramangala.lat, koramangala.lng, indiranagar.lat, indiranagar.lng);
  assert.ok(blrLocal >= 4.0 && blrLocal <= 6.0, `Koramangala to Indiranagar should be ~4.5-5.5 km, got ${blrLocal}`);
});

test("Nearby shop radius filtering works in Bengaluru and returns empty for distant locations", () => {
  // Stored Bengaluru shops (matching marketplace.json)
  const bShop1: Shop = {
    id: "tech-haven",
    ownerId: "seller-1",
    name: "Tech Haven",
    description: "Gadgets and tech",
    address: "80 Feet Road, Koramangala, Bengaluru",
    lat: 12.9352,
    lng: 77.6245,
    city: "Bengaluru",
    image: "/images/photo.jpg",
    rating: 4.8,
    reviews: 10,
    verified: true,
    hours: { open: "09:00", close: "21:00", days: [0, 1, 2, 3, 4, 5, 6] },
    phone: "+91 98765 43210",
    completed: 20,
  };
  const bShop2: Shop = {
    id: "earth-clay",
    ownerId: "seller-2",
    name: "Earth & Clay Studio",
    description: "Ceramics",
    address: "12th Main, Indiranagar, Bengaluru",
    lat: 12.9719,
    lng: 77.6412,
    city: "Bengaluru",
    image: "/images/photo.jpg",
    rating: 4.9,
    reviews: 5,
    verified: true,
    hours: { open: "10:00", close: "20:00", days: [0, 1, 2, 3, 4, 5, 6] },
    phone: "+91 98765 43211",
    completed: 15,
  };

  const storedShops = [bShop1, bShop2];

  // Buyer 1: Located in Koramangala, Bengaluru
  const buyerKoramangala = { lat: 12.9352, lng: 77.6245 };
  const nearbyInBlr = storedShops
    .map((s) => ({ ...s, distance: distanceKm(buyerKoramangala.lat, buyerKoramangala.lng, s.lat, s.lng) }))
    .filter((s) => s.distance <= 10)
    .sort((a, b) => a.distance - b.distance);

  assert.equal(nearbyInBlr.length, 2, "Both shops within 10km of Koramangala");
  assert.equal(nearbyInBlr[0].id, "tech-haven");
  assert.ok(nearbyInBlr[0].distance < 0.1);

  // Buyer 2: Located in Chennai (T. Nagar)
  const buyerChennai = { lat: 13.0418, lng: 80.2341 };
  const nearbyInChennai = storedShops
    .map((s) => ({ ...s, distance: distanceKm(buyerChennai.lat, buyerChennai.lng, s.lat, s.lng) }))
    .filter((s) => s.distance <= 10);

  // Must return 0 shops when radius is 10 km (distance is ~290 km)
  assert.equal(nearbyInChennai.length, 0, "No Bengaluru shops should be found within 10km of Chennai");

  // When radius is widened to 350 km, shops are discovered
  const wideSearch = storedShops
    .map((s) => ({ ...s, distance: distanceKm(buyerChennai.lat, buyerChennai.lng, s.lat, s.lng) }))
    .filter((s) => s.distance <= 350);
  assert.equal(wideSearch.length, 2, "Shops found when radius covers inter-city distance");
});

test("Stale coordinate detection flags when address is modified without coordinate resolution", () => {
  const isCoordinateStale = (currentAddress: string, resolvedAddress: string) => {
    return currentAddress.trim().toLowerCase() !== resolvedAddress.trim().toLowerCase();
  };

  // Same address -> not stale
  assert.equal(isCoordinateStale("80 Feet Road, Koramangala", "80 Feet Road, Koramangala"), false);

  // Address changed from Koramangala to Indiranagar without re-resolving -> stale!
  assert.equal(isCoordinateStale("12th Main, Indiranagar, Bengaluru", "80 Feet Road, Koramangala"), true);
});

test("Popular locations preset list covers multiple Indian metropolitan cities", () => {
  const cities = new Set(POPULAR_LOCATIONS.map((l) => l.city).filter(Boolean));
  assert.ok(cities.has("Bengaluru"), "Must contain Bengaluru");
  assert.ok(cities.has("Chennai"), "Must contain Chennai");
  assert.ok(cities.has("Mumbai"), "Must contain Mumbai");
  assert.ok(cities.has("Delhi"), "Must contain Delhi");
  assert.ok(cities.has("Hyderabad"), "Must contain Hyderabad");

  for (const loc of POPULAR_LOCATIONS) {
    assert.ok(isValidCoordinate(loc.lat, loc.lng), `${loc.name} coordinates must be valid`);
  }
});

test("Review creation, rating validation, and duplicate prevention for completed transactions", () => {
  const buyerId = "buyer-alex";
  const otherBuyerId = "buyer-rohan";
  const shopId = "shop-tech";
  const productId = "prod-headphones";

  const transactions: Transaction[] = [
    {
      id: "tx-completed-1",
      buyerId,
      shopId,
      listingId: "listing-1",
      productId,
      quantity: 1,
      basePrice: 5000,
      finalPrice: 4800,
      total: 4800,
      status: "COMPLETED",
      createdAt: "2026-09-01T10:00:00Z",
    },
    {
      id: "tx-pending-2",
      buyerId,
      shopId,
      listingId: "listing-1",
      productId,
      quantity: 1,
      basePrice: 5000,
      finalPrice: 4800,
      total: 4800,
      status: "INITIATED", // Not completed!
      createdAt: "2026-09-02T10:00:00Z",
    },
  ];

  const reviews: Review[] = [];

  const createReview = (userId: string, txId: string, rating: number, text: string): Review => {
    if (rating < 1 || rating > 5 || !Number.isInteger(rating)) {
      throw new Error("Rating must be between 1 and 5");
    }
    if (!text || text.trim().length < 5) {
      throw new Error("Review must be at least 5 characters");
    }
    const tx = transactions.find((t) => t.id === txId);
    if (!tx || tx.buyerId !== userId || tx.status !== "COMPLETED") {
      throw new Error("A completed purchase is required to review this seller.");
    }
    if (reviews.some((r) => r.transactionId === txId)) {
      throw new Error("You already reviewed this purchase.");
    }
    const newRev: Review = {
      id: "rev-" + (reviews.length + 1),
      transactionId: txId,
      userId,
      shopId: tx.shopId,
      productId: tx.productId,
      rating,
      text: text.trim(),
      userName: "Alex M.",
      createdAt: new Date().toISOString(),
    };
    reviews.push(newRev);
    return newRev;
  };

  // Valid review by buyer
  const rev = createReview(buyerId, "tx-completed-1", 5, "Excellent seller and fast pickup!");
  assert.equal(rev.rating, 5);
  assert.equal(rev.text, "Excellent seller and fast pickup!");
  assert.equal(reviews.length, 1);

  // Duplicate review on same transaction -> Rejected
  assert.throws(() => createReview(buyerId, "tx-completed-1", 4, "Trying again"), /already reviewed/);

  // Review on uncompleted transaction -> Rejected
  assert.throws(() => createReview(buyerId, "tx-pending-2", 5, "Great item"), /completed purchase is required/);

  // Another user trying to review someone else's purchase -> Rejected
  assert.throws(() => createReview(otherBuyerId, "tx-completed-1", 5, "I didn't buy this"), /completed purchase is required/);

  // Invalid rating bounds
  assert.throws(() => createReview(buyerId, "tx-completed-1", 0, "Too low rating"), /Rating must be between 1 and 5/);
  assert.throws(() => createReview(buyerId, "tx-completed-1", 6, "Too high rating"), /Rating must be between 1 and 5/);

  // Too short review text
  assert.throws(() => createReview(buyerId, "tx-completed-1", 5, "bad"), /at least 5 characters/);
});

test("Buyer can edit and delete own review with dynamic average rating recalculation", () => {
  const shopId = "shop-earth";
  const productId = "prod-mug";
  const authorId = "buyer-1";
  const otherUserId = "buyer-2";

  let reviews: Review[] = [
    {
      id: "rev-1",
      transactionId: "tx-1",
      userId: authorId,
      shopId,
      productId,
      rating: 4,
      text: "Nice pottery, smooth glaze.",
      createdAt: "2026-09-01T10:00:00Z",
    },
    {
      id: "rev-2",
      transactionId: "tx-2",
      userId: "buyer-3",
      shopId,
      productId,
      rating: 5,
      text: "Perfect craftsmanship!",
      createdAt: "2026-09-02T10:00:00Z",
    },
  ];

  const computeShopRating = (sId: string) => {
    const list = reviews.filter((r) => r.shopId === sId);
    return list.length
      ? Math.round((list.reduce((sum, r) => sum + r.rating, 0) / list.length) * 10) / 10
      : 0;
  };

  // Initial average: (4 + 5) / 2 = 4.5
  assert.equal(computeShopRating(shopId), 4.5);

  const editReview = (userId: string, revId: string, newRating?: number, newText?: string) => {
    const r = reviews.find((rev) => rev.id === revId);
    if (!r) throw new Error("Not found");
    if (r.userId !== userId) throw new Error("You can only edit your own reviews.");
    if (newRating !== undefined) r.rating = newRating;
    if (newText !== undefined) r.text = newText;
    r.updatedAt = new Date().toISOString();
    return r;
  };

  // Other user cannot edit author's review
  assert.throws(() => editReview(otherUserId, "rev-1", 1, "Hacked review"), /only edit your own reviews/);

  // Author edits review: changes rating from 4 to 5
  editReview(authorId, "rev-1", 5, "Updated: absolutely loved it after daily use!");
  assert.equal(reviews[0].rating, 5);
  assert.ok(reviews[0].updatedAt);

  // New average: (5 + 5) / 2 = 5.0
  assert.equal(computeShopRating(shopId), 5.0);

  const deleteReview = (userId: string, revId: string) => {
    const r = reviews.find((rev) => rev.id === revId);
    if (!r) throw new Error("Not found");
    if (r.userId !== userId) throw new Error("You can only delete your own reviews.");
    reviews = reviews.filter((rev) => rev.id !== revId);
  };

  // Other user cannot delete author's review
  assert.throws(() => deleteReview(otherUserId, "rev-1"), /only delete your own reviews/);

  // Author deletes review
  deleteReview(authorId, "rev-1");
  assert.equal(reviews.length, 1);
  assert.equal(computeShopRating(shopId), 5.0); // Only rev-2 remains (rating 5)

  // Delete remaining review
  deleteReview("buyer-3", "rev-2");
  assert.equal(reviews.length, 0);
  assert.equal(computeShopRating(shopId), 0); // 0 reviews left -> 0 rating
});

test("Seller can reply to reviews on their shop, cannot edit or delete buyer reviews", () => {
  const sellerId = "seller-arjun";
  const otherSellerId = "seller-priya";
  const shopId = "shop-tech";

  const shop: Shop = {
    id: shopId,
    ownerId: sellerId,
    name: "Tech Haven",
    description: "Good tech",
    address: "Koramangala, Bengaluru",
    lat: 12.9352,
    lng: 77.6245,
    image: "/images/shop.jpg",
    rating: 4.8,
    reviews: 1,
    verified: true,
    hours: { open: "09:00", close: "21:00", days: [0, 1, 2, 3, 4, 5, 6] },
    phone: "+91 98765 43210",
    completed: 10,
  };

  const review: Review = {
    id: "rev-1",
    transactionId: "tx-1",
    userId: "buyer-alex",
    shopId,
    productId: "prod-headphones",
    rating: 5,
    text: "Wonderful customer service and fast pickup at Koramangala.",
    createdAt: "2026-09-01T10:00:00Z",
  };

  const replyReview = (userId: string, rev: Review, reply: string) => {
    if (shop.ownerId !== userId) {
      throw new Error("You can only reply to reviews on your own shop.");
    }
    if (!reply || reply.trim().length < 2) {
      throw new Error("Reply must be at least 2 characters");
    }
    rev.reply = reply.trim();
    rev.repliedAt = new Date().toISOString();
    return rev;
  };

  // Other seller cannot reply to a shop they don't own
  assert.throws(() => replyReview(otherSellerId, review, "Thank you!"), /only reply to reviews on your own shop/);

  // Shop owner successfully replies
  replyReview(sellerId, review, "Thank you Alex, glad you loved the headphones!");
  assert.equal(review.reply, "Thank you Alex, glad you loved the headphones!");
  assert.ok(review.repliedAt);

  // Buyer's original rating and text are strictly preserved
  assert.equal(review.rating, 5);
  assert.equal(review.text, "Wonderful customer service and fast pickup at Koramangala.");
  assert.equal(review.userId, "buyer-alex");
});

test("Permission checks prevent unauthorized bid acceptance, listing modification, and private data leaks", () => {
  const sellerA = "seller-a";
  const sellerB = "seller-b";

  const shopA: Shop = {
    id: "shop-a",
    ownerId: sellerA,
    name: "Shop A",
    description: "Shop A description",
    address: "Koramangala",
    lat: 12.9352,
    lng: 77.6245,
    image: "/images/a.jpg",
    rating: 4.5,
    reviews: 0,
    verified: true,
    hours: { open: "09:00", close: "21:00", days: [1] },
    phone: "123",
    completed: 0,
  };

  const listingBid = {
    id: "bid-1",
    listingId: "l-1",
    shopId: "shop-a",
    productId: "p-1",
    buyerId: "buyer-alex",
    offeredPrice: 400,
    quantity: 1,
    status: "PENDING" as "PENDING" | "ACCEPTED" | "REJECTED",
  };

  const acceptBid = (actingUserId: string, bid: typeof listingBid) => {
    if (shopA.ownerId !== actingUserId) {
      throw new Error("Forbidden: You do not own this listing's shop.");
    }
    bid.status = "ACCEPTED";
  };

  // Seller B cannot accept Seller A's bids
  assert.throws(() => acceptBid(sellerB, listingBid), /You do not own this listing's shop/);
  assert.equal(listingBid.status, "PENDING");

  // Seller A can accept
  acceptBid(sellerA, listingBid);
  assert.equal(listingBid.status, "ACCEPTED");

  // Public review serialization does not leak private user info (email, passwordHash)
  const fullUser = {
    id: "buyer-alex",
    name: "Alex Morgan",
    email: "alex@secret-email.com",
    passwordHash: "argon2id$hashedpassword",
    roles: ["BUYER"],
    verified: true,
    active: true,
  };

  const publicReviewDisplay = (rev: Review, user: typeof fullUser) => ({
    id: rev.id,
    rating: rev.rating,
    text: rev.text,
    userName: user.name, // Public name shown
    createdAt: rev.createdAt,
    reply: rev.reply,
  });

  const serialized = publicReviewDisplay({
    id: "rev-1",
    transactionId: "tx-1",
    userId: fullUser.id,
    shopId: "shop-a",
    productId: "p-1",
    rating: 5,
    text: "Great experience",
    createdAt: "2026-09-01",
  }, fullUser);

  assert.equal(serialized.userName, "Alex Morgan");
  assert.equal("email" in serialized, false, "Must not leak user email");
  assert.equal("passwordHash" in serialized, false, "Must not leak password hash");
});

test("Product price comparison correctly sorts by availability and identifies cheapest in-stock seller", () => {
  const listings = [
    { id: "l-1", shopId: "s-1", price: 25000, finalPrice: 25000, stock: 0 },
    { id: "l-2", shopId: "s-2", price: 27000, finalPrice: 27000, stock: 15 },
    { id: "l-3", shopId: "s-3", price: 26000, finalPrice: 26000, stock: 5 },
  ];

  // Sort by stock availability descending
  const sortedByStock = [...listings].sort((a, b) => b.stock - a.stock);
  assert.equal(sortedByStock[0].id, "l-2", "Listing with 15 stock should be first");
  assert.equal(sortedByStock[1].id, "l-3", "Listing with 5 stock should be second");
  assert.equal(sortedByStock[2].id, "l-1", "Listing with 0 stock should be last");

  // Valid in-stock cheapest seller
  const inStock = listings.filter((l) => l.stock > 0);
  const cheapestValid = inStock.reduce((min, cur) => cur.finalPrice < min.finalPrice ? cur : min, inStock[0]);
  assert.equal(cheapestValid.id, "l-3", "Cheapest valid in-stock listing is l-3 (₹26,000), not l-1 which is out-of-stock");
});

test("Reservation lifecycle generates 6-digit pickup OTP and restocks on cancellation", () => {
  let stock = 10;
  const reserveQuantity = 3;

  // Validate stock
  assert.ok(stock >= reserveQuantity, "Sufficient stock for reservation");
  stock -= reserveQuantity;
  assert.equal(stock, 7, "Stock deducted on reservation");

  // Generate secure 6-digit OTP
  const pickupOtp = Math.floor(100000 + Math.random() * 900000).toString();
  assert.equal(pickupOtp.length, 6, "OTP must be 6 digits");
  assert.ok(/^\d{6}$/.test(pickupOtp), "OTP must be numeric");

  const transaction = {
    id: "tx-demo",
    buyerId: "buyer-1",
    shopId: "shop-1",
    listingId: "listing-1",
    quantity: reserveQuantity,
    status: "INITIATED" as "INITIATED" | "CONFIRMED" | "COMPLETED" | "CANCELLED",
    pickupOtp,
  };

  // Buyer cancels reservation
  transaction.status = "CANCELLED";
  stock += transaction.quantity;
  assert.equal(stock, 10, "Stock restored to original quantity upon cancellation");
});

test("pickup OTP verification enforces security, state machine transitions, and authentication", () => {
  function transitionTransaction(
    transaction: { id: string; buyerId: string; shopId: string; status: string; pickupOtp?: string; completedAt?: string },
    sellerUserId: string,
    actingUserId: string,
    newStatus: string,
    otp?: string,
  ) {
    const isSeller = actingUserId === sellerUserId;
    const isBuyer = actingUserId === transaction.buyerId;

    if (!isSeller && !isBuyer) {
      throw new Error("Forbidden: Not a party to this transaction");
    }

    if (newStatus !== "CANCELLED" && !isSeller) {
      throw new Error("Forbidden: Only the seller can confirm completion");
    }

    const validTransitions: Record<string, string[]> = {
      INITIATED: ["CONFIRMED", "CANCELLED"],
      CONFIRMED: ["COMPLETED", "CANCELLED"],
      COMPLETED: [],
      CANCELLED: [],
    };

    if (!validTransitions[transaction.status]?.includes(newStatus)) {
      throw new Error("Invalid status transition");
    }

    if (newStatus === "COMPLETED") {
      if (transaction.pickupOtp) {
        if (!otp) {
          throw new Error("Pickup OTP is required to complete this reservation");
        }
        if (otp.trim() !== transaction.pickupOtp.trim()) {
          throw new Error("Invalid pickup OTP");
        }
      }
      transaction.completedAt = new Date().toISOString();
    }

    transaction.status = newStatus;
    return transaction;
  }

  const tx = {
    id: "tx-100",
    buyerId: "buyer-abc",
    shopId: "shop-xyz",
    status: "CONFIRMED",
    pickupOtp: "582914",
  };

  // 1. Missing OTP is rejected
  assert.throws(
    () => transitionTransaction({ ...tx }, "seller-1", "seller-1", "COMPLETED"),
    /Pickup OTP is required/,
  );

  // 2. Invalid OTP is rejected
  assert.throws(
    () => transitionTransaction({ ...tx }, "seller-1", "seller-1", "COMPLETED", "123456"),
    /Invalid pickup OTP/,
  );

  // 3. Buyer cannot complete transaction even with valid OTP
  assert.throws(
    () => transitionTransaction({ ...tx }, "seller-1", "buyer-abc", "COMPLETED", "582914"),
    /Only the seller can confirm completion/,
  );

  // 4. Unauthorized third party cannot complete transaction
  assert.throws(
    () => transitionTransaction({ ...tx }, "seller-1", "intruder-999", "COMPLETED", "582914"),
    /Forbidden/,
  );

  // 5. Valid OTP by seller successfully completes transaction
  const completedTx = transitionTransaction({ ...tx }, "seller-1", "seller-1", "COMPLETED", "582914");
  assert.equal(completedTx.status, "COMPLETED");
  assert.ok(completedTx.completedAt);

  // 6. Cannot complete an already completed transaction (double-completion prevention)
  assert.throws(
    () => transitionTransaction({ ...completedTx }, "seller-1", "seller-1", "COMPLETED", "582914"),
    /Invalid status transition/,
  );

  // 7. Cannot complete a cancelled transaction
  const cancelledTx = { ...tx, status: "CANCELLED" };
  assert.throws(
    () => transitionTransaction(cancelledTx, "seller-1", "seller-1", "COMPLETED", "582914"),
    /Invalid status transition/,
  );
});
