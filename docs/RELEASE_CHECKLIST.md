# Verification and remaining launch work

## Verified in the authoring environment

- Customer and admin production bundles compile.
- Pure unit tests cover duplicate-line aggregation, capped/category-scoped discounts, usage limits and payment signature rejection.
- Production dependency audit reported zero known advisories at the time of the run. This is not a security certification.
- Source syntax checks pass.

## Blocked here — must run locally

- MongoDB integration tests: MongoDB 7.0.24 downloaded, but the execution environment denied an OS operation during database startup (`open: Operation not permitted`). The database tests therefore failed at setup; no passing end-to-end database result is claimed.
- Browser visual and interaction testing: the remote browser blocked the local preview URL. No screenshot or responsive QA result is claimed.

## Not enabled / remaining implementation

- Online Razorpay checkout, webhook processing, payment reconciliation, expiring payment reservations and refunds. The included adapter/signature helper is not a full payment integration. COD is the only enabled checkout method.
- Email/WhatsApp/SMS delivery, email verification, password reset and two-factor authentication. Contact and newsletter forms currently persist records only.
- Configurable granular permissions; roles are currently fixed. Staff cannot create/update products or collect COD payments even if they can see related controls; the API rejects those actions.
- Full content/article/banner editor, customer spend aggregation, CSV export, revenue by category/top product and event/conversion/abandoned-cart analytics. Current analytics show order value over time.
- Server cart synchronization and wishlist price-change history; the cart is device-local and wishlist displays current prices.
- Per-variant stock/SKUs; inventory is currently pooled per product. Add variant inventory models before selling options with independent availability.
- Review photo uploads and quality/comfort/value summaries; rating/text moderation and purchase verification are implemented.
- Product secondary hover images, dedicated dimension/packaging labels and a complete style-based recommendation engine. Quiz currently filters by room, budget and material.
- Full production SEO: server rendering/prerendering, sitemap generation and social image metadata per product. Existing metadata is a base starting point.
- Accessibility and mobile acceptance testing, including zoom focus trapping/return, all prescribed widths and assistive technology checks.
- Admin collection assignment/recommendation editing and SEO fields need dedicated form controls (supported fields are available in the API).
- Pagination for all admin datasets, shared production rate-limiter store and external notification workers.
- A confirmed-refund workflow and inspected-return restocking. The API does not execute refunds or claim that a paid order was refunded automatically.

## Required business configuration

- Real products, imagery, exact dimensions, tax/accounting rules, delivery/cash-on-delivery zones and installation terms.
- Published business identity, support channels, privacy, returns and warranty terms.
- Production MongoDB and Cloudinary credentials, TLS/domains, monitoring and tested backups.

The code is a functional development baseline. Do not describe it as a completed or audited production system until the blocked tests and remaining launch work are resolved.
