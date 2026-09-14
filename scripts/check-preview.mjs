import { chromium } from "@playwright/test";
import assert from "node:assert/strict";
import { mkdir } from "node:fs/promises";
const browser = await chromium.launch({ channel: "chrome", headless: true });
try {
  const page = await browser.newPage({
    viewport: { width: 1440, height: 1000 },
  });
  const errors = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.goto("http://localhost:3000/shops/nearby");
  await page.locator(".map-list-item").first().waitFor();
  await page.locator(".map-list-item").first().click();
  await page.locator(".map-note a").waitFor();
  assert.equal(await page.locator(".map-marker").count(), 4);
  await page.goto("http://localhost:3000");
  await page.locator(".product-card").first().waitFor();
  await page.evaluate(async () => {
    for (const img of document.images) img.loading = "eager";
    await Promise.all(
      Array.from(document.images).map((img) => img.decode().catch(() => {})),
    );
  });
  const broken = await page.evaluate(() =>
    Array.from(document.images)
      .filter((img) => !img.naturalWidth)
      .map((img) => img.alt),
  );
  assert.deepEqual(broken, []);
  await mkdir("docs/screenshots", { recursive: true });
  await page.screenshot({
    path: "docs/screenshots/home-desktop.png",
    fullPage: true,
  });
  await page.setViewportSize({ width: 390, height: 844 });
  await page.screenshot({
    path: "docs/screenshots/home-mobile.png",
    fullPage: true,
  });
  assert.equal(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
    true,
  );
  assert.deepEqual(errors, []);
  console.log(
    "Preview verified: 4 map markers, all bundled images loaded, no browser errors, no mobile overflow.",
  );
} finally {
  await browser.close();
}
