# Aroundly

A local marketplace for discovering neighbourhood shops, comparing prices, reserving products, and receiving competing seller offers. Built with an original responsive UI, Next.js, NestJS, TypeScript, and PostgreSQL/PostGIS support.

## Start the application

Requires Node.js 22 or newer. The default **local demo** works without Docker, a database, or API credentials. Demo data is saved on disk between restarts, and the UI labels it as sample data.

```bash
corepack enable
pnpm install --frozen-lockfile
pnpm db:generate
pnpm dev
```

Open **http://localhost:3000**. The API runs at **http://localhost:4000/api/v1** and Swagger is at **http://localhost:4000/api/docs**.

If Corepack is unavailable, install pnpm with `npm install --global pnpm@10`. An npm fallback is supported: `npm install`, `npm run db:generate`, then `npm run dev`.

Demo sign-in buttons are available on the login screen:

| Account             | Email                 | Password     |
| ------------------- | --------------------- | ------------ |
| Buyer               | buyer@aroundly.local  | DemoPass123! |
| Seller / Tech Haven | seller@aroundly.local | DemoPass123! |

These accounts exist only in the local demo. Production startup refuses demo mode and the built-in development JWT secret.

## What works

- Responsive storefront, categories, URL-based search/filtering/sorting, loading/error/empty states, and bundled imagery.
- Product details and seller comparisons: price, stock, distance, rating, opening status, active offers, and estimated final price.
- Nearby shops, manual location selection, opt-in browser geolocation, MapLibre map markers, storefronts, and directions.
- Registration, Argon2 passwords, in-memory JWT access tokens, rotating HttpOnly refresh cookies, logout, profile editing, password changes, email verification, and password reset.
- Product/shop favourites, reservation history, in-app notifications, and reviews restricted to completed purchases.
- Seller shop/product/listing management, stock/price updates, scheduled offers, and reservation management.
- Buyer price requests, seller bids, and transactional acceptance with reserved stock.
- Protected administrator account inspection, activation/deactivation, and audit history.

Purchases are **reserved online and paid at the physical shop**. There is no online payment collection or delivery service.

## Try the full flow

1. Sign in as the buyer, search for Sony, compare sellers, and reserve at Tech Haven.
2. Sign in as the seller. Open **Seller dashboard → Reservations**, confirm the reservation, then mark it picked up and paid.
3. Sign back in as the buyer and submit a verified review from **Your reservations**.
4. On a product page, choose **Request a better price**. A seller with that product in stock can respond under **Buyer requests**. Accept their offer from **Your price requests**.
5. Register a new seller account to create your own shop, listings, and offers.

## PostgreSQL / PostGIS mode

Install Docker Desktop with Compose, then copy the examples:

```powershell
Copy-Item .env.example .env
Copy-Item apps/api/.env.example apps/api/.env
Copy-Item apps/web/.env.example apps/web/.env.local
docker compose up -d
```

Set `DATABASE_MODE=postgres` in `apps/api/.env`. Use the same database URL in the root `.env` and `apps/api/.env`, and set a unique `JWT_SECRET`. Then:

```bash
pnpm db:generate
pnpm db:migrate
pnpm db:seed
pnpm dev
```

Seeding refuses a non-empty database. PostgreSQL seed users have random, undisclosed passwords; register your own account. Use demo mode to sign in as a sample shop owner. Sample aggregate ratings and offers are illustrative, not actual customer reviews.

Migrations enable `postgis` and `pg_trgm`. Shop locations use `geography(Point,4326)` with a GiST index; parameterized `ST_DWithin` and `ST_Distance` queries implement radius search. PostgreSQL product matching uses full-text search, trigram similarity, and parameterized substring matching. Demo mode uses local distance calculations and substring matching.

## Email and jobs

For PostgreSQL email verification and password recovery, configure `REDIS_URL`, `RESEND_API_KEY`, and `MAIL_FROM` in `apps/api/.env`. The sender domain must be verified with the provider. BullMQ processes queued email with retry/backoff and removes successfully delivered jobs. The delivery provider is separated from controllers.

Demo mode exposes a one-time recovery/verification link instead of sending email. Production never returns these links in API responses. Tokens are stored hashed and expire after one hour. Password changes/reset revoke refresh sessions; existing access tokens expire after 15 minutes.

`NODE_ENV=production` requires PostgreSQL, an explicit JWT secret, Redis, and email configuration. Use HTTPS, set `WEB_URL` to the exact frontend origin, and set `API_URL` in the web environment to the backend address. Frontend API requests use same-origin Next.js rewrites.

## Architecture

```text
apps/web/                  Next.js App Router, React, Tailwind, Radix/shadcn-style UI
  src/components/          Storefront, comparison, accounts, and seller screens
  src/lib/api.ts           Typed API transport and coordinated token refresh
  public/images/           Bundled illustrative photos
apps/api/
  src/auth.ts              Authentication, rotating sessions, and guard
  src/marketplace.ts       Validated marketplace business rules
  src/controllers.ts       REST endpoints and ownership checks
  src/store.ts             Serialized demo persistence and Prisma adapter
  src/notifications.ts     BullMQ email worker and provider interface
  prisma/                  Schema, migrations, and seeding
packages/shared/src/       Types, price/hours/trust calculations, seed data
tests/                     Browser and HTTP workflow tests
```

TanStack Query owns server state; React owns local UI state. Authentication forms use React Hook Form and Zod. Images use `next/image`, and maps load on demand.

## Business rules

- A `Product` is the shared identity; a `Listing` is a shop’s price, stock, and availability for that product.
- Money is INR, rounded to two decimal places. The best active offer applies; overlapping offers do not stack. Discounts cannot make prices negative.
- Three completed purchases at a shop unlock a further 3% loyalty discount for an authenticated buyer.
- Reservations snapshot prices and decrement stock atomically. Cancellation releases stock once. Valid transitions are `INITIATED → CONFIRMED → COMPLETED`, or cancellation from either initial state. Only the owner can confirm/complete a reservation.
- Bid acceptance validates buyer, product, shop, quantity, open request, and stock; accepting closes the request atomically.
- One completed purchase permits one verified review. The review contributes to product and shop aggregates.
- Business hours use Asia/Kolkata and support selected weekdays and overnight intervals.
- Trust: verification 25 + completed purchases up to 25 (one point per four) + rating × 8 (up to 40) + complete description/contact 10. Sellers cannot edit derived metrics.

## Checks and builds

```bash
pnpm typecheck
pnpm lint
pnpm test
pnpm test:e2e
pnpm build
pnpm format
```

Browser tests use installed Google Chrome. Alternatively change `channel` in `playwright.config.ts` and install Playwright Chromium. Tests start isolated services on ports **3010 / 4010**, store data under `test-results/data`, and do not alter regular demo data. They cover discovery, mobile navigation, authentication, reservations, ownership, refresh rotation, reviews, shop/listing creation, and bidding. Screenshots are written under `test-results`.

Run services independently with `pnpm --filter @aroundly/web dev` and `pnpm --filter @aroundly/api dev`. After building, use their `start` scripts.

To grant admin access to a registered account, run from `apps/api`:

```bash
pnpm exec tsx src/grant-admin.ts your-email@example.com
```

This local operator action is audited. Public registration cannot grant admin access.

## Current release boundaries

This is a working development application, **not a claim that every production requirement in the supplied document is finished**.

- PostgreSQL/PostGIS and Redis/email require service-backed testing before deployment. Docker was unavailable here; local demo and browser/API flows were exercised instead.
- Users, shops, products, and listings use relational tables. Ancillary collections currently use JSONB records and writes use an advisory lock. This is a small-pilot persistence adapter, not a large-scale design. Normalize ancillary tables and move filtering/pagination fully into SQL before scaling.
- Media selection accepts bundled paths or Unsplash URLs. S3/MinIO uploads, image processing, SMS, geocoding, separate daily time ranges, buyer ratings, review reporting/moderation, and richer category/brand administration remain future work.
- External email and map tiles need internet access. Select a suitable tile provider for public deployment; the default is OpenStreetMap raster tiles.
- No online payments, shipping, refunds, or automatic reservation expiry. Buyers/sellers must cancel unused reservations to release stock.
- Sample locations, prices, ratings, stock, and photos are illustrative. Photography may not show the exact named model. See [image sources](docs/IMAGE-SOURCES.md).

See [implementation notes](docs/IMPLEMENTATION.md) for deployment priorities.

See [validation results](docs/VALIDATION.md) and the [desktop preview](docs/screenshots/home-desktop.png).
