# LICON

A warm, minimal furniture storefront with a separate business dashboard and shared REST API.

**Status:** runnable development implementation, not cleared for production launch. Both frontends build; the pure commerce unit tests pass. The supplied database integration suite could not run in the authoring environment because MongoDB was denied an OS operation. The remote browser also could not reach the local preview. Run the integration and browser checks below before accepting real orders.

## Project structure

```text
LICON/
  frontend/        React customer store (port 5173)
  admin/           React business dashboard (port 5174)
  backend/
    src/models/    Mongoose models
    src/middleware/auth.js
    src/services/  Transactional commerce, storage and payment adapters
    src/server.js  REST routes and validation
    src/seed.js    Opt-in sample catalog and owner setup
    test/          Unit and database integration tests
  shared/          API client, form fields and loading/error states
  docs/            Deployment example and release checklist
  compose.yaml     Local MongoDB replica set
  Dockerfile.api   API container build
```

## Technology

React 19, Vite 6, React Router, Tailwind CSS, Lucide icons and Recharts; Node.js 22+, Express, MongoDB/Mongoose, Zod, bcrypt, JWT in HTTP-only cookies, Helmet and rate limiting. Cloudinary handles optional image uploads. A Razorpay adapter is included, but online payment checkout is deliberately disabled.

## Local setup

Install Node.js 22+ and Docker Desktop. Extract this folder, then run these commands from `LICON`:

```bash
npm ci
cp backend/.env.example backend/.env
cp frontend/.env.example frontend/.env
cp admin/.env.example admin/.env
docker compose up -d
```

On Windows PowerShell, use `Copy-Item` instead of `cp` if needed. Use `docker compose ps` to check that MongoDB is healthy. Alternatively use a MongoDB Atlas replica-set connection string; a standalone MongoDB instance does not support the transactions required by checkout.

Edit `backend/.env`. Generate a JWT secret with:

```bash
node -e "console.log(require('crypto').randomBytes(48).toString('hex'))"
```

Set `SEED_OWNER_EMAIL` and a unique `SEED_OWNER_PASSWORD` of at least 12 characters. Then:

```bash
npm run seed
```

The seed creates the owner only if that email does not already exist. It does not reset an existing owner's password or overwrite the catalog. Remove the seed password from the environment once setup is complete. There is no hardcoded admin password.

Start each application in a separate terminal:

```bash
npm run dev:api
npm run dev:store
npm run dev:admin
```

Open:

- Customer store: http://localhost:5173
- Business dashboard: http://localhost:5174
- API health: http://localhost:5000/api/health

Use `localhost` consistently across all three apps so cookies and origin checks work. Sign in to the admin app using your seeded owner credentials. Register a separate customer account on the storefront. Local sessions share the API cookie, so use separate browser profiles to test customer and owner simultaneously.

Sample serviceable PIN codes are **673001** and **676505**, with a ₹499 delivery fee. These are demo data, not actual delivery promises. The sample catalog uses illustrative Unsplash images and invented product descriptions/prices. Replace it with your actual catalog, photographs, specifications, warranty and delivery zones before launch.

## Environment variables

| File | Variable | Purpose |
| --- | --- | --- |
| backend/.env | MONGODB_URI | Replica-set / Atlas connection URI |
| backend/.env | JWT_SECRET | Random secret, minimum 32 characters |
| backend/.env | CLIENT_URL | Exact allowed storefront origin |
| backend/.env | ADMIN_URL | Exact allowed dashboard origin |
| backend/.env | PORT | API port, default 5000 |
| backend/.env | NODE_ENV | development locally; production on the server |
| backend/.env | CLOUDINARY_CLOUD_NAME / API_KEY / API_SECRET | Optional image upload credentials; prefix each with CLOUDINARY_ |
| backend/.env | RAZORPAY_KEY_ID / RAZORPAY_KEY_SECRET / RAZORPAY_WEBHOOK_SECRET | Reserved for completing online payments |
| backend/.env | SEED_OWNER_EMAIL / SEED_OWNER_PASSWORD | Initial owner creation only |
| frontend/.env | VITE_API_URL | API base including `/api` |
| frontend/.env | VITE_SITE_URL | Public storefront base URL |
| admin/.env | VITE_API_URL | The same API base |

Vite variables are public and embedded at build time. Never put secrets in a `VITE_` variable. The root `.env.example` is a reference copy; the backend reads `backend/.env` when run through the supplied scripts.

## Working flows

- Editorial home, category/product browsing, search, sorting and filters; collections; product gallery, room-fit estimate and delivery checker.
- Guest cart persists on the device; variants and quantities are sent to the API. A server cart endpoint exists, but cross-device synchronization is not connected to the storefront yet.
- Customer registration/login, saved addresses, profile, wishlist, orders, tracking and in-app notifications.
- Checkout requires a server quote. Prices, coupons, delivery and stock are checked again by the server. COD is available only in explicitly enabled zones.
- Transactional order creation, conditional stock reservations, idempotency key and coupon usage accounting. A failed operation rolls back. Duplicate variant lines are aggregated; physical stock is pooled by product.
- Admin accepts an order, then progresses it through processing, packed, shipped, out for delivery and delivered. Invalid transitions are rejected. Cancellation releases reserved stock. Delivery decrements physical and reserved stock once.
- COD payment is explicitly recorded by an owner/admin after delivery. Order value analytics do not imply payment has been received.
- Product creation/editing, publication flags, inventory, image URL ordering and Cloudinary upload; category/collection creation; coupons; delivery zones; review moderation; custom request status/notes; content editing; staff account creation and audit history.
- Custom briefs and contact messages are persisted; newsletter registration is stored. These do not send emails or messages to anyone.

Roles are enforced server-side. Owner has team/audit access, admin has catalog/customer/payment access, and staff has fulfillment/review/custom-request access. The backend reads the user's current role and active status on every authenticated request. Logout invalidates the account's current tokens.

## Database choices

Product holds authoritative physical and reserved inventory; user embeds addresses. Separate Inventory and AdminUser aliases exist for compatibility with the requested model names but are not independent authorities. Avoid writing duplicate inventory values elsewhere. Product `collectionId` and `newArrival` avoid reserved Mongoose field names.

Create indexes during deployment (`Model.init()` or controlled migrations); allow time for the unique email, SKU, slug, order ID and user/idempotency indexes. Back up the database and test restore procedures. Returned goods are not automatically restocked because they require inspection.

## Tests

```bash
npm run build
npm run test:unit -w backend
npm test
npm audit --omit=dev
```

`npm test` starts an isolated temporary MongoDB replica set using mongodb-memory-server. Its first run downloads an official MongoDB binary. It does not connect to your production database. It covers authorization, cross-origin writes, price authority, discount caps, idempotency, concurrent stock contention, cancellation, fulfillment, COD recording, order ownership and session invalidation. Run it on a system that permits MongoDB processes.

Manual browser checks:

1. At 320, 375, 430, 768, 1024, 1440 and 1920 px, verify navigation, filters, galleries, forms and table scrolling.
2. Register a customer, add two pieces, change quantity, save a wishlist item and request a delivery quote.
3. Try an invalid PIN/coupon, unavailable stock and an expired login. Verify useful error states.
4. Place a COD order using sample data in your local database. Use the admin account in another browser profile to accept and fulfill it. Refresh customer tracking after each transition.
5. Create a draft product, upload an image with test Cloudinary credentials, publish it and check the storefront.
6. Navigate by keyboard, check labels/focus, test zoom close/Escape, and run an accessibility audit.
7. Shut down the API and confirm the loading/error states remain usable.

See `docs/RELEASE_CHECKLIST.md` for the exact verification status and remaining features.

## Deployment

1. Provision a private MongoDB Atlas database or authenticated replica set. Create a limited database user and network rules. Do not deploy the unauthenticated local compose database to the internet.
2. Deploy the Express API on a Node host/container. `docker build -f Dockerfile.api -t licon-api .` builds the supplied API image. Inject backend variables through your host's secret manager.
3. Set production URLs to `https://licon.com`, `https://admin.licon.com` and API base `https://api.licon.com/api`. Enable HTTPS for all three; cookie authentication assumes these same-site domains.
4. Build both apps with the correct Vite variables using `npm run build`. Deploy `frontend/dist` to the customer domain and `admin/dist` to the admin domain. Configure SPA fallback to `index.html`; see the Nginx example.
5. Put the API behind HTTPS and configure proxy trust for only your actual trusted proxy. Default rate limiting uses process memory; use a shared limiter store for multiple replicas.
6. Seed the owner once, then remove the seed password. Do not seed the sample catalog into a live trading store.
7. Run tests and complete payment, policy, security and browser acceptance checks before enabling sales. Configure monitoring, backups, retention and incident procedures.

This package does not register domains, publish a live site, connect real payment credentials or charge customers.
