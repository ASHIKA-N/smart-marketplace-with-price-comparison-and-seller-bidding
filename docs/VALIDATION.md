# Validation — 14 September 2026

Verified on Windows with Node.js 24 and installed Google Chrome:

| Check                                | Result                                         |
| ------------------------------------ | ---------------------------------------------- |
| Prisma client generation             | Passed                                         |
| TypeScript checks for web and API    | Passed                                         |
| ESLint                               | Passed                                         |
| Shared domain tests                  | 4 passed                                       |
| Playwright browser / API workflows   | 6 passed                                       |
| Next.js and NestJS production builds | Passed                                         |
| Dependency installation audit        | 0 vulnerabilities reported                     |
| Live map and image verification      | 4 markers, no broken images, no browser errors |
| Mobile layout at 390 px              | No horizontal page overflow                    |

The Playwright suite covers discovery, comparison, login, reservations, ownership restrictions, stock limits, session rotation, review eligibility, seller shop/listing creation, bid acceptance, seller edits, and one-time password recovery. Its temporary servers required manual process cleanup under this environment's Windows sandbox; all six tests completed successfully and the test runner exited successfully after cleanup.

The final map initialization change was separately checked against the running app by `node scripts/check-preview.mjs`. That check produced the [desktop](screenshots/home-desktop.png) and [mobile](screenshots/home-mobile.png) screenshots.

PostgreSQL/PostGIS, Redis queue operation, and external email delivery were not exercised against live services. Docker was unavailable. See the README for configuration and remaining production work.
