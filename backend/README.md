# Restaurant Backend API

A standalone Restaurant reservation backend — Firebase phone-auth customers, Razorpay
booking-advance payments, Restaurant/Menu/Slot management, and Admin/SuperAdmin
management APIs. Built with Node.js + Express 5 + TypeScript + Prisma 7 + MySQL/MariaDB.

This backend was transformed from a Hotel/PMS template. It has **no dependency on
GoAdapter, hotel/property/room domain models, or any hotel partner APIs** — it owns its
own authentication, database, and business logic end to end.

## Tech Stack

- Node.js 22, Express 5, TypeScript
- Prisma 7 + MySQL/MariaDB (via `@prisma/adapter-mariadb`)
- Redis 6.2+, BullMQ (booking reminder jobs), Socket.IO (Redis adapter)
- Firebase Admin SDK — verifies customer phone-auth ID tokens server-side
- Razorpay — booking advance payment (order + signature verification)
- OneSignal REST API — customer push notifications
- Zod validation, Pino logging

## Project Structure

```text
src/
  app.ts                Express app + route registration
  server.ts              HTTP server, Redis/socket/worker lifecycle
  config/                env.ts, policy.ts (modification cutoff, refund policy)
  lib/                   prisma, firebaseAdmin, razorpay, oneSignal clients
  middleware/auth.ts      Admin JWT, Customer JWT, requireRestaurantAccess, requireClientKey
  constants/               table preference / cancellation reason label maps
  services/               business logic (one file per domain area)
  routes/                  customer-facing routes + routes/admin/* admin routes
  socket/                  Socket.IO server + restaurant:* event names
  queues/, workers/        BullMQ booking-reminder queue/worker
  utils/                   geo, dates, slot time formatting, human booking id, http envelope
prisma/
  schema.prisma            Restaurant domain schema
  seed.ts                  2 restaurants, SuperAdmin, Admin, menu, slots
  create-admin.ts          Bootstraps a SuperAdmin from env vars
tests/
  unit/                    Pure logic (geo, date/time, refund policy, booking id)
  integration/             Mocked-Prisma service + route tests (auth boundaries, IDOR,
                            booking capacity/cutoff/refund, payment verification, refresh rotation)
```

## Domain Model

`RestaurantUser` (customer, Firebase-authenticated) · `AdminUser` (ADMIN/SUPERADMIN,
scoped to restaurants via `AdminRestaurant`) · `Restaurant` · `RestaurantCategory` /
`RestaurantCategoryLink` (admin-manageable taxonomy, e.g. `pure_veg`, `north_indian`) ·
`MenuCategory` → `MenuItem` · `SlotConfiguration` (Lunch/Dinner time slots, admin
configurable) · `RestaurantBooking` (snapshots restaurant name/image/rating/cuisine/
distance at booking time so history renders correctly even if the restaurant changes
later) · `Payment` (Razorpay order/signature verification, independent of whether a
booking is ever created from it) · `RefreshSession` (rotating customer refresh tokens) ·
`Notification`.

## Authentication

**Customer** — Firebase Phone OTP on the client → `POST /api/auth/authenticate/` with
the Firebase ID token. The backend verifies the token server-side via Firebase Admin
(`firebase-admin/auth`), extracting the trusted UID + phone number — the client's
`firebase_token` is the only identity input trusted; a client can never assert its own
phone number, uid, id, or role. A `RestaurantUser` is created or updated (name/email/
`player_id`) and short-lived (`CUSTOMER_ACCESS_TOKEN_TTL`, default 15m) access + rotating
refresh tokens are issued. Refresh tokens are opaque random values, stored only as a
SHA-256 hash in `RefreshSession`, and rotate on every `/api/auth/refresh/` call; reuse of
an already-rotated token revokes every active session for that user (theft detection).
`POST /api/auth/logout/` revokes the current refresh session.

**Admin / SuperAdmin** — classic email + bcrypt password login at
`POST /api/admin/auth/login`, issuing a JWT signed with a **separate secret**
(`JWT_SECRET`) from the customer token secret (`CUSTOMER_JWT_SECRET`) — an admin token
and a customer token can never be swapped between APIs even if someone tried, because
each middleware can only verify tokens signed with its own secret. SuperAdmin manages
everything; a plain Admin is scoped to specific restaurants via the `AdminRestaurant`
join table, enforced by `requireRestaurantAccess()` middleware on every restaurant-scoped
admin route.

## API Endpoints

```
POST   /api/auth/authenticate/           Firebase login/register (issues tokens)
POST   /api/auth/refresh/                Rotate refresh token
POST   /api/auth/logout/                 Revoke refresh session

GET    /api/restaurants/                 ?city&category&q&latitude&longitude&page&limit
GET    /api/restaurants/:id/             ?latitude&longitude (for distanceKm)
GET    /api/restaurants/:id/menu/
GET    /api/restaurants/:id/slots/       ?date=YYYY-MM-DD&people=N
POST   /api/restaurants/:id/bookings/    [customer auth] verified-payment required

POST   /api/payments/initiate/           [customer auth] server decides the ₹ amount
POST   /api/payments/verify/             [customer auth] verifies Razorpay HMAC signature

GET    /api/my-restaurant-bookings/      [customer auth] ?filter=upcoming|past
GET    /api/restaurant-bookings/:id/     [customer auth, ownership enforced]
PATCH  /api/restaurant-bookings/:id/     [customer auth] date/time/people only
POST   /api/restaurant-bookings/:id/cancel/  [customer auth]

POST   /api/admin/auth/login
GET    /api/admin/auth/me
PATCH  /api/admin/auth/change-password

GET/POST/PATCH/DELETE  /api/admin/restaurants/[:id]      [SuperAdmin: all; Admin: assigned only]
PATCH  /api/admin/restaurants/:id/rating                 [SuperAdmin only]
GET/POST/PATCH/DELETE  /api/admin/restaurants/:id/menu/categories[/:categoryId]
POST/PATCH/DELETE       /api/admin/restaurants/:id/menu/categories/:categoryId/items[/:itemId]
GET/POST/PATCH/DELETE  /api/admin/restaurants/:id/slots[/:slotId]
GET/PATCH/DELETE        /api/admin/bookings[/:id][/cancel]
GET/POST/PATCH/DELETE  /api/admin/admins[/:id]           [SuperAdmin only]
GET/POST/PATCH/DELETE  /api/admin/categories[/:id]        (global category taxonomy; SuperAdmin writes)
POST                    /api/uploads/images                [admin auth] banner/gallery/menu images
```

All responses use `{ "status": boolean, "message": string, "data"?: ... }`. Every
`/api/*` route also requires the shared `x-client-key` header when `APP_CLIENT_KEY` is
configured (defense-in-depth in front of JWT auth, mirrors the original project's
convention).

## Payment & Booking Flow

`POST /payments/initiate/` creates a Razorpay order for a **server-decided** amount
(`RESTAURANT_BOOKING_ADVANCE_INR`, default ₹99) — the client cannot influence the amount.
`POST /payments/verify/` verifies the Razorpay HMAC-SHA256 signature server-side and
marks the `Payment` row `VERIFIED`; a signature mismatch marks it `FAILED` and a second
verify attempt on an already-verified/failed order is rejected. Only then does
`POST /restaurants/:id/bookings/` accept the booking — it re-validates the payment
belongs to the caller and hasn't already funded a different booking, then, **inside a
transaction that row-locks the restaurant (`SELECT ... FOR UPDATE`)**, re-checks slot
capacity before inserting — closing the race window between the `/slots/` read and the
booking write so two concurrent bookers can't both claim the last seats.

## Reminders & Notifications

Booking confirm/modify/cancel notifications are created (and pushed via OneSignal, and
emitted over `restaurant:notification:new` on the customer's socket room) synchronously
within the request. Slot-time reminders are scheduled as a **delayed BullMQ job**
(`BOOKING_REMINDER_MINUTES_BEFORE` before the slot), rescheduled on modify and cancelled
on cancel — not a per-booking `setTimeout`, so reminders survive process restarts.

## Modification / Cancellation Policy

Centralized in `src/config/policy.ts`, not scattered across controllers:

- **Modification window**: `BOOKING_MODIFICATION_CUTOFF_MINUTES` (default 60) before the
  slot time; PATCH is rejected once inside that window.
- **Refund policy**: full refund of the advance if cancelled outside the same cutoff
  window, no refund inside it. This is an explicit initial assumption — change it in one
  place (`decideRefund`) if the real business rule differs.
- **Booking window**: today through `maxBookingLeadDays` (60) days out, validated
  server-side on both slot lookup and booking creation/modification.

`upcoming` → `past` is computed on every read (comparing the booking's date+time against
the current instant), not written by a cron job — so it can never go stale regardless of
when a client last fetched it.

## Environment Variables

See `.env.example`. Notably:

- `JWT_SECRET` / `CUSTOMER_JWT_SECRET` — **must differ** (see Authentication above).
- `FIREBASE_PROJECT_ID`/`FIREBASE_CLIENT_EMAIL`/`FIREBASE_PRIVATE_KEY` (or
  `FIREBASE_SERVICE_ACCOUNT_JSON`) — required for `/auth/authenticate/` to work; without
  them the endpoint fails closed with a 500, it never falls back to trusting the client.
- `RAZORPAY_KEY_ID`/`RAZORPAY_KEY_SECRET` — when unset, payment order creation and
  signature verification run in a **mock mode** (clearly logged) so the full flow stays
  testable end-to-end locally without live Razorpay credentials.
- `ONESIGNAL_APP_ID`/`ONESIGNAL_API_KEY` — when unset, pushes are logged and skipped
  rather than failing the request (same graceful-degradation pattern the original
  codebase used for Firebase Cloud Messaging).

> **Security note:** `backend/.env.production.example` previously contained what appear
> to be **real, live secrets** committed to git (a production DB password, a full
> Firebase service-account private key, and a SAAS adapter API key/HMAC secret) —
> it has been replaced with a placeholder-only template. If you have deploy access to
> those systems, rotate that Firebase service account key, the database password, and
> revoke that adapter API key now; they are exposed in this repo's git history
> regardless of the file's current content. A local `backend/service_account.json` with
> the same private key also exists on disk (now `.gitignore`d) — rotate it too before
> reusing this Firebase project for anything sensitive.

## Running Locally

```bash
cd backend
cp .env.example .env         # fill in DATABASE_URL at minimum; Firebase/Razorpay/OneSignal
                              # can stay blank for local testing (see mock-mode notes above)
npm install
npm run prisma:generate
npm run prisma:migrate        # applies prisma/migrations/20260822000000_init
npm run db:seed               # 2 restaurants, SuperAdmin, Admin, menu, slots
npm run dev                   # http://localhost:4000
```

Requires a reachable MySQL/MariaDB server and Redis 6.2+ (`REDIS_URL`, default
`redis://127.0.0.1:6379`). `npm run create-admin` (env-driven `SUPERADMIN_EMAIL`/
`SUPERADMIN_PASSWORD`) is an alternative to seeding when you only need a SuperAdmin
without sample restaurant data.

Seeded logins (also printed by `npm run db:seed`):

- SuperAdmin: value of `SUPERADMIN_EMAIL`/`SUPERADMIN_PASSWORD` in `.env` (defaults to
  `admin@gmail.com` / `123123` if unset — **change these before any shared deployment**)
- Admin: `manager@restaurant.local` / `Manager@12345` (scoped to "Shree Shyam Restaurant")

## Testing

```bash
npm test          # vitest run — unit + mocked-Prisma integration tests, no live DB needed
npm run test:watch
```

Tests never touch a real database — Prisma is mocked (`tests/helpers/mockPrisma.ts`) so
the suite is hermetic and fast. Coverage includes: cross-audience token rejection (a
customer token can't be replayed on an admin route or vice versa), IDOR protection on
booking access, SuperAdmin-only route enforcement, refresh-token rotation and reuse
detection, booking capacity/date-window/cutoff/refund logic, and Razorpay
signature/duplicate-verification handling.

## Example Requests

**Authenticate**
```http
POST /api/auth/authenticate/
{ "firebase_token": "<Firebase ID token>", "name": "Rahul Sharma", "player_id": "..." }
→ { "status": true, "message": "Login successful",
    "data": { "access_token": "...", "refresh_token": "...", "user": { ... } } }
```

**Create a booking** (after `/payments/initiate/` → checkout → `/payments/verify/`)
```http
POST /api/restaurants/:id/bookings/
Authorization: Bearer <customer access token>
{
  "date": "2026-08-25", "time": "12:00 PM", "people": 4,
  "tablePreference": "Window Seat", "fullName": "Rahul Sharma",
  "mobileNumber": "+919876543210",
  "payment": { "razorpay_order_id": "...", "razorpay_payment_id": "..." }
}
```

## Deployment

Unchanged from the original project's PM2/GitHub Actions setup
(`.github/workflows/backend-deploy.yml`): build → `prisma migrate deploy` → restart under
PM2. No GoAdapter callback/webhook configuration is needed anymore.
