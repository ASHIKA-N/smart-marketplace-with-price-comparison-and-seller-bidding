import { test, expect } from "@playwright/test";
test("homepage, search, comparison, and responsive navigation", async ({
  page,
}) => {
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await page.goto("/");
  await expect(
    page.getByRole("heading", { name: /Great finds/ }),
  ).toBeVisible();
  await expect(page.locator(".product-card").first()).toBeVisible();
  await page.evaluate(async () => {
    for (const img of document.images) {
      img.loading = "eager";
    }
    await Promise.all(
      Array.from(document.images).map((img) => img.decode().catch(() => {})),
    );
  });
  await page.screenshot({
    path: "test-results/home-desktop.png",
    fullPage: true,
  });
  await page
    .getByRole("textbox", { name: "Find a product nearby" })
    .fill("Sony");
  await page.getByRole("button", { name: "Search nearby products" }).click();
  await expect(page.locator(".product-card")).toHaveCount(1);
  await page.getByRole("link", { name: "Compare prices" }).click();
  await expect(
    page.getByRole("heading", { name: "Find your best local price" }),
  ).toBeVisible();
  await expect(page.locator("tbody tr")).toHaveCount(3);
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/");
  await expect(page.locator(".product-card").first()).toBeVisible();
  await page.screenshot({
    path: "test-results/home-mobile.png",
    fullPage: true,
  });
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth,
    ),
  ).toBe(true);
  await page.getByRole("button", { name: "Toggle navigation" }).click();
  await expect(
    page.getByRole("link", { name: "Seller dashboard", exact: false }).first(),
  ).toBeVisible();
  expect(errors).toEqual([]);
});
test("buyer can log in, save a product, and reserve it", async ({ page }) => {
  await page.goto("/login");
  await page.getByLabel("Email address").fill("buyer@aroundly.local");
  await page.getByLabel("Password", { exact: true }).fill("DemoPass123!");
  await page.getByRole("button", { name: "Sign in", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: /Great finds/ }),
  ).toBeVisible();
  await page.goto("/products/sony-headphones");
  await expect(
    page.getByRole("heading", { name: "Sony WH-1000XM5" }),
  ).toBeVisible();
  await page
    .locator("tbody tr")
    .first()
    .getByRole("button", { name: "Reserve", exact: false })
    .click();
  await page.getByRole("button", { name: "Confirm reservation" }).click();
  await expect(
    page.getByRole("heading", { name: "Your reservations." }),
  ).toBeVisible();
  await expect(page.locator(".transaction-card").first()).toContainText(
    "Sony WH-1000XM5",
  );
});
test("API enforces ownership, stock, transitions, reviews, and refresh rotation", async ({
  request,
}) => {
  const base = "http://127.0.0.1:4010/api/v1";
  const buyerLogin = await request.post(`${base}/auth/login`, {
    data: { email: "buyer@aroundly.local", password: "DemoPass123!" },
  });
  expect(buyerLogin.ok()).toBeTruthy();
  const buyer = (await buyerLogin.json()).accessToken as string;
  const oldCookie = buyerLogin.headers()["set-cookie"].split(";")[0];
  const refresh = await request.post(`${base}/auth/refresh`, {
    headers: { Cookie: oldCookie },
  });
  expect(refresh.ok()).toBeTruthy();
  expect(
    (
      await request.post(`${base}/auth/refresh`, {
        headers: { Cookie: oldCookie },
      })
    ).status(),
  ).toBe(401);
  const sellerLogin = await request.post(`${base}/auth/login`, {
    data: { email: "seller@aroundly.local", password: "DemoPass123!" },
  });
  const seller = (await sellerLogin.json()).accessToken as string;
  const buyerHeaders = { Authorization: `Bearer ${buyer}` };
  const sellerHeaders = { Authorization: `Bearer ${seller}` };
  expect(
    (
      await request.get(`${base}/users/admin`, { headers: buyerHeaders })
    ).status(),
  ).toBe(403);
  expect(
    (
      await request.patch(`${base}/shops/neighbourhood-store`, {
        headers: sellerHeaders,
        data: {
          name: "Not my shop",
          description: "An unauthorized change",
          address: "Bengaluru",
          phone: "1234567890",
          lat: 12,
          lng: 77,
        },
      })
    ).status(),
  ).toBe(403);
  const detail = await (
    await request.get(`${base}/products/sony-headphones`)
  ).json();
  const listing = detail.listings.find(
    (l: { shopId: string }) => l.shopId === "tech-haven",
  );
  expect(
    (
      await request.post(`${base}/transactions`, {
        headers: buyerHeaders,
        data: { listingId: listing.id, quantity: 100 },
      })
    ).status(),
  ).toBe(400);
  const created = await request.post(`${base}/transactions`, {
    headers: buyerHeaders,
    data: { listingId: listing.id, quantity: 1 },
  });
  expect(created.ok()).toBeTruthy();
  const t = await created.json();
  expect(t.total).toBe(listing.finalPrice);
  expect(
    (
      await request.patch(`${base}/transactions/${t.id}`, {
        headers: buyerHeaders,
        data: { status: "COMPLETED" },
      })
    ).status(),
  ).toBe(403);
  expect(
    (
      await request.post(`${base}/reviews`, {
        headers: buyerHeaders,
        data: { transactionId: t.id, rating: 5, text: "A helpful local shop." },
      })
    ).status(),
  ).toBe(403);
  expect(
    (
      await request.patch(`${base}/transactions/${t.id}`, {
        headers: sellerHeaders,
        data: { status: "CONFIRMED" },
      })
    ).ok(),
  ).toBeTruthy();
  expect(
    (
      await request.patch(`${base}/transactions/${t.id}`, {
        headers: sellerHeaders,
        data: { status: "COMPLETED" },
      })
    ).ok(),
  ).toBeTruthy();
  expect(
    (
      await request.post(`${base}/reviews`, {
        headers: buyerHeaders,
        data: { transactionId: t.id, rating: 5, text: "A helpful local shop." },
      })
    ).ok(),
  ).toBeTruthy();
  expect(
    (
      await request.post(`${base}/reviews`, {
        headers: buyerHeaders,
        data: { transactionId: t.id, rating: 5, text: "Duplicate review." },
      })
    ).status(),
  ).toBe(400);
});
test("new seller can create a shop and listing; buyer can request and accept a bid", async ({
  request,
}) => {
  const base = "http://127.0.0.1:4010/api/v1";
  const email = `seller-${Date.now()}@example.test`;
  expect(
    (
      await request.post(`${base}/auth/register`, {
        data: {
          name: "Test Local Seller",
          email,
          password: "TestingPass123!",
          seller: true,
        },
      })
    ).ok(),
  ).toBeTruthy();
  const token = (
    await (
      await request.post(`${base}/auth/login`, {
        data: { email, password: "TestingPass123!" },
      })
    ).json()
  ).accessToken;
  const headers = { Authorization: `Bearer ${token}` };
  const created = await request.post(`${base}/shops`, {
    headers,
    data: {
      name: "Test Neighbourhood Shop",
      description: "A friendly shop created in an automated test.",
      address: "Koramangala, Bengaluru",
      lat: 12.9353,
      lng: 77.6246,
      phone: "+91 9876543210",
    },
  });
  expect(created.ok()).toBeTruthy();
  const shop = await created.json();
  const listingResponse = await request.post(`${base}/listings`, {
    headers,
    data: {
      shopId: shop.id,
      productId: "ceramic-mug",
      price: 600,
      stock: 5,
      active: true,
    },
  });
  expect(listingResponse.ok()).toBeTruthy();
  const listing = await listingResponse.json();
  const buyerToken = (
    await (
      await request.post(`${base}/auth/login`, {
        data: { email: "buyer@aroundly.local", password: "DemoPass123!" },
      })
    ).json()
  ).accessToken;
  const buyerHeaders = { Authorization: `Bearer ${buyerToken}` };
  const r = await (
    await request.post(`${base}/requests`, {
      headers: buyerHeaders,
      data: {
        productId: "ceramic-mug",
        quantity: 2,
        targetPrice: 550,
        note: "I can collect today.",
      },
    })
  ).json();
  const bidResponse = await request.post(`${base}/bids`, {
    headers,
    data: {
      requestId: r.id,
      shopId: shop.id,
      price: 540,
      note: "Ready for pickup.",
    },
  });
  expect(bidResponse.ok()).toBeTruthy();
  const bid = await bidResponse.json();
  const order = await request.post(`${base}/transactions`, {
    headers: buyerHeaders,
    data: { listingId: listing.id, quantity: 2, bidId: bid.id },
  });
  expect(order.ok()).toBeTruthy();
  expect((await order.json()).total).toBe(1080);
  expect(
    (
      await request.post(`${base}/transactions`, {
        headers: buyerHeaders,
        data: { listingId: listing.id, quantity: 2, bidId: bid.id },
      })
    ).status(),
  ).toBe(400);
});
test("seller can edit stock and prices through the dashboard", async ({
  page,
}) => {
  await page.goto("/login");
  await page.getByLabel("Email address").fill("seller@aroundly.local");
  await page.getByLabel("Password", { exact: true }).fill("DemoPass123!");
  await page.getByRole("button", { name: "Sign in", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: /Great finds/ }),
  ).toBeVisible();
  await page.goto("/seller/listings");
  await expect(
    page.getByRole("heading", { name: "Your shelf, online." }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Edit", exact: true }).first().click();
  await page.getByLabel("Price (₹)").fill("24500");
  await page.getByLabel("Stock quantity").fill("20");
  await page.getByRole("button", { name: "Save listing" }).click();
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await expect(page.locator("tbody tr").first()).toContainText("24,500");
  await page.goto("/seller");
  await expect(
    page.getByRole("heading", { name: "Good things are growing." }),
  ).toBeVisible();
  await page.screenshot({
    path: "test-results/seller-desktop.png",
    fullPage: true,
  });
  await page.goto("/shops/nearby");
  await expect(page.locator(".map-list-item").first()).toBeVisible();
  await page.locator(".map-list-item").first().click();
  await expect(page.locator(".map-note")).toContainText("Visit storefront");
});
test("account recovery uses one-time tokens and hides unknown accounts", async ({
  request,
}) => {
  const base = "http://127.0.0.1:4010/api/v1";
  const email = `recovery-${Date.now()}@example.test`;
  await request.post(`${base}/auth/register`, {
    data: {
      name: "Recovery Tester",
      email,
      password: "OriginalPass123!",
      seller: false,
    },
  });
  const known = await (
    await request.post(`${base}/auth/forgot-password`, { data: { email } })
  ).json();
  const unknown = await (
    await request.post(`${base}/auth/forgot-password`, {
      data: { email: "unknown@example.test" },
    })
  ).json();
  expect(known.message).toBe(unknown.message);
  expect(
    (
      await request.post(`${base}/auth/reset-password`, {
        data: { token: known.demoToken, password: "ChangedPass123!" },
      })
    ).ok(),
  ).toBeTruthy();
  expect(
    (
      await request.post(`${base}/auth/reset-password`, {
        data: { token: known.demoToken, password: "ChangedAgain123!" },
      })
    ).status(),
  ).toBe(400);
  expect(
    (
      await request.post(`${base}/auth/login`, {
        data: { email, password: "OriginalPass123!" },
      })
    ).status(),
  ).toBe(401);
  expect(
    (
      await request.post(`${base}/auth/login`, {
        data: { email, password: "ChangedPass123!" },
      })
    ).ok(),
  ).toBeTruthy();
});
