# Implementation notes

The supplied document was used as a product/architecture reference. Its embedded role and agent-workflow instructions were not treated as additional user messages. The delivered application focuses on local discovery, authenticated buyer/seller flows, comparisons, reservations, and seller bidding.

## Before public deployment

1. Provision PostgreSQL with PostGIS and Redis. Apply migrations in staging and exercise radius queries, concurrent reservations, cancellation rollback, and session rotation against the actual database.
2. Normalize the pilot JSONB collections into relational tables with targeted writes, constraints, and database-backed integration tests.
3. Configure HTTPS, exact frontend origins, random secrets, Redis access control, and a verified email sender. Exercise email delivery, retries, and link expiry.
4. Replace illustrative catalog content with verified merchant data. Add controlled object-storage uploads before accepting merchant media at scale.
5. Configure a production tile/geocoding provider. The application requests coordinates only after a user action and does not persist buyer location history.
6. Add shared rate limits across API replicas, comprehensive structured logging, monitoring, backups, and recovery procedures.
7. Add reservation expiry, merchant verification, reporting/moderation, and cancellation/dispute rules appropriate to the business.

## Design and security

The original Aroundly UI uses emerald accents, cream backgrounds, clear typography, photography-led cards, and separate seller navigation. Mobile filters expand inline, comparison tables scroll horizontally, and Radix dialogs trap focus and support keyboard dismissal. Destructive changes require confirmation.

Access tokens stay in memory. Refresh tokens are random opaque values stored as SHA-256 hashes, rotated on use, and transported in HttpOnly SameSite=Strict cookies (Secure in production). Mutations reject mismatched browser origins. Guards authenticate protected operations, and seller mutations validate ownership independently. Zod validates input; reservation prices and review eligibility are computed server-side.

The disk adapter serializes mutations and atomically replaces its file. The PostgreSQL adapter uses database transactions and an advisory lock. Do not run multiple demo processes against one data file. Production seed passwords are random; public registration cannot assign administrator roles.

## API

Swagger at `/api/docs` lists REST routes. Validation schemas in the source specify detailed field constraints; fully annotated request/response OpenAPI schemas remain a documentation improvement.

- `GET /api/v1/health`: liveness and operating mode.
- `GET /api/v1/health/ready`: database read readiness.
- `GET /api/v1/products/search`: bounded results and applied filters.
- `GET /api/v1/products/:id/compare`: seller comparison and eligible loyalty discount.
- `GET /api/v1/shops/nearby`: coordinate/radius discovery.
- `GET /api/v1/seller`: authenticated owner dashboard.
- `POST /api/v1/requests`, `POST /api/v1/bids`: negotiated prices.
- `POST /api/v1/transactions`: standard or bid-backed reservations.
