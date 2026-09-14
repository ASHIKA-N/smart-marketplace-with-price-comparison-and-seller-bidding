import { test } from "node:test";
import assert from "node:assert/strict";
import {
  finalPrice,
  shopOpen,
  trustScore,
  distanceKm,
  type Offer,
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
