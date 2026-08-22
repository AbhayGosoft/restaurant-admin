# Backend PMS

Enterprise Stay PMS backend for property owners, stay/property management, rooms, bookings, rate plans, services, and partner adapter integration.

This project is a Node.js + Express + TypeScript backend using Prisma ORM with MySQL/MariaDB.

## Tech Stack

- Node.js
- Express 5
- TypeScript
- Prisma 7
- MySQL / MariaDB
- Redis
- Socket.IO
- BullMQ
- JWT authentication
- Zod validation
- Prisma MariaDB adapter

## Main Features

- Admin and owner authentication
- Owner onboarding setup wizard
- Multi-property support
- Property categories such as `Rooms`, `Halls`, `Dormitories`
- Room types such as `Standard`, `Luxury`, `RameshHall 30`
- Physical rooms with room numbers, capacity, bookability, and availability
- Amenities
- Services and extra services
- Rate plans with room type and service mappings
- Booking lifecycle
- Live pending-booking confirmation with five-minute auto-cancel
- Socket.IO rooms by property with Redis adapter support
- BullMQ queues for booking expiration, adapter sync retries, and notifications
- Partner adapter APIs under `/api/partner`
- Backward-compatible partner aliases under `/api/integrations`
- HMAC-secured adapter APIs under `/api/adapter`

## Project Structure

```text
src/
  app.ts
  server.ts
  config/
  adapters/
  lib/
  middleware/
  modules/
  prisma/
  queues/
  redis/
  repositories/
  routes/
  services/
  socket/
  types/
  utils/
  workers/

prisma/
  schema.prisma
  create-admin.ts
  migrations/

docs/
  openapi.yaml
  postman_collection.json
```

## Requirements

- Node.js 22.x (LTS) — same version CI and the production server use. Check with `node -v`.
- npm 10+ (comes bundled with Node 22). Check with `npm -v`.
- MySQL or MariaDB
- Redis 6.2+ (older 5.x/6.0 works but logs a version warning on startup)

## Environment Variables

Create a `.env` file in the project root.

```env
DATABASE_URL="mysql://USER:PASSWORD@localhost:3306/staypms"
PORT=4000
NODE_ENV=development
JWT_SECRET="change-this-long-random-secret-before-production"
JWT_EXPIRES_IN="7d"
FRONTEND_ORIGIN="http://localhost:3000,https://localhost,capacitor://localhost"
REDIS_URL="redis://127.0.0.1:6379"
LOG_LEVEL="info"
ADMIN_EMAIL="admin@example.com"
ADMIN_PASSWORD="change-this-password"
SAAS_ADAPTER_API_KEY="change-this-adapter-key"
SAAS_ADAPTER_HMAC_SECRET="change-this-hmac-secret"
SAAS_ADAPTER_CALLBACK_URL="https://adapter.example.com/webhooks/pms-bookings"
FIREBASE_PROJECT_ID=""
FIREBASE_CLIENT_EMAIL=""
FIREBASE_PRIVATE_KEY=""
# Or use FIREBASE_SERVICE_ACCOUNT_JSON instead of the three Firebase fields above.
FIREBASE_SERVICE_ACCOUNT_JSON=""
APP_CLIENT_KEY="change-this-client-key"
```

## Running Locally (development machine)

On Windows PowerShell, if script execution blocks `npm` or `npx`, use `npm.cmd` /
`npx.cmd` instead everywhere below.

### First time only

```bash
cp .env.example .env      # fill in DATABASE_URL, JWT_SECRET, APP_CLIENT_KEY, etc.
npm install
```

Create the database (name must match the one in your `DATABASE_URL`):

```sql
CREATE DATABASE staypms;
```

Create and apply migrations, and generate the Prisma Client, in one step:

```bash
npm run prisma:migrate
```

Create the admin account from `ADMIN_EMAIL`/`ADMIN_PASSWORD` in `.env`
(there is no separate seed script in this repo — this is the bootstrap step):

```bash
npm run create-admin
```

### Every time after (regular local dev)

Make sure MySQL/MariaDB and Redis are running, then:

```bash
npm run dev
```

This uses `tsx watch`, so the server restarts automatically on file changes.
Default URL: `http://localhost:4000` — health check at `GET /api/health`.

If you change `prisma/schema.prisma` later, re-run `npm run prisma:migrate`
(creates a new migration file) before `npm run dev` again. `npm run prisma:push`
is available for quick, throwaway schema experiments that you don't want to
turn into a migration file yet — don't use it once real data matters, since it
can't be replayed on the server the way a migration can.

## Running on a Server (production)

Production deploys run automatically via GitHub Actions
(`.github/workflows/backend-deploy.yml`) on every push to `main`: it SSHes into
the VPS, pulls the code, and runs the steps below itself. Use the same steps by
hand only if you're setting up a brand-new server or need to intervene manually.

### First time on a new server

```bash
git clone <repo> && cd backend
cp .env.production.example .env   # fill in real production values
chmod 600 .env
npm ci
npm run prisma:generate
npx prisma migrate deploy         # applies existing migration files, never creates new ones
npm run build
pm2 start dist/src/server.js --name connector --cwd .
pm2 save
```

### Every time after (redeploy)

Normally you just `git push` to `main` and CI/CD does this for you. The manual
equivalent, if you ever need it:

```bash
git pull
npm ci
npm run prisma:generate
npx prisma migrate deploy
npm run build
pm2 restart connector --update-env
```

### Local vs. server — what's different

| | Local (development) | Server (production) |
|---|---|---|
| Env file | `.env` copied from `.env.example` | `.env` copied from `.env.production.example` |
| Install | `npm install` | `npm ci` (exact versions from the lockfile) |
| Schema sync | `npm run prisma:migrate` (or `prisma:push` for quick experiments) | `npx prisma migrate deploy` only — never `migrate dev` or `db push` |
| Run | `npm run dev` (tsx watch, auto-restarts) | `npm run build` then PM2 keeps `dist/src/server.js` running |
| `NODE_ENV` | `development` | `production` |

Start Redis before running the API either way. The server connects Redis, starts
Socket.IO, and starts BullMQ workers in the same process. In production, run
multiple API/worker replicas against the same `REDIS_URL`; Socket.IO uses the
Redis adapter and BullMQ guarantees delayed expiration jobs are coordinated.

## Useful Scripts

```bash
npm run dev              # start dev server (local only)
npm run build            # compile TypeScript
npm start                # run compiled server (node dist/src/server.js, no PM2)
npm run prisma:generate  # generate Prisma Client
npm run prisma:migrate   # create/apply a Prisma migration (local only)
npm run prisma:push      # push schema to database without a migration file (local only)
npm run create-admin     # create/update the admin user from ADMIN_EMAIL/ADMIN_PASSWORD
npm test                 # currently runs build
```

## Authentication

Login:

```text
POST /api/auth/login
```

Use the returned JWT as:

```text
Authorization: Bearer YOUR_TOKEN
```

## Core API Groups

```text
/api/auth
/api/owners
/api/amenities
/api/stays
/api/setup
/api/categories
/api/room-types
/api/rooms
/api/rate-plans
/api/services
/api/bookings
/api/payments
/api/settlements
/api/notifications
/api/uploads
/api/room-blocks
/api/inventory
/api/partner
```

## Owner Setup Flow

Owners complete a progressive setup flow before they can create bookings:

```text
CATEGORY -> ROOM_TYPE -> ROOM -> RATE_PLAN -> SERVICE -> COMPLETED
```

Setup endpoints:

```text
GET  /api/setup/progress
POST /api/setup/finish
```

## App Client Key

Every route except `/`, `/api/health`, `/api/partner/*`, `/api/integrations/*`, and
`/api/adapter/*` requires the web/app frontend's shared secret on each request:

```text
x-client-key: YOUR_APP_CLIENT_KEY
```

This blocks other apps/sites from calling the API directly; it does not replace the
per-user JWT (`Authorization: Bearer`) auth used on protected routes.

## GoAdapter PMS Contract

The GoAdapter-facing PMS contract is implemented under `/api/partner` and
mirrored under `/api/integrations` for existing clients. Configure the
GoAdapter `PMSInstance.base_url` to one of those base paths.

Partner routes use the static API key:

```text
x-api-key: YOUR_SAAS_ADAPTER_API_KEY
```

Primary partner base path:

```text
/api/partner
```

Backward-compatible alias:

```text
/api/integrations
```

Contract endpoints:

```text
GET  /api/partner/catalog
GET  /api/partner/property?propertyId=PROPERTY_ID
GET  /api/partner/property?property_id=PROPERTY_ID
GET  /api/partner/categories?propertyId=PROPERTY_ID
GET  /api/partner/categories?property_id=PROPERTY_ID
GET  /api/partner/room-types?propertyId=PROPERTY_ID
GET  /api/partner/room-types?property_id=PROPERTY_ID
GET  /api/partner/rate-plans?propertyId=PROPERTY_ID
GET  /api/partner/rate-plans?property_id=PROPERTY_ID
GET  /api/partner/extra-services?propertyId=PROPERTY_ID
GET  /api/partner/extra-services?property_id=PROPERTY_ID
GET  /api/partner/availability?property_id=PROPERTY_ID&date_from=2026-08-01&date_to=2026-08-03
POST /api/partner/bookings
GET  /api/partner/bookings/:pms_booking_id
POST /api/partner/bookings/:pms_booking_id/cancel
```

Responses follow the documented GoAdapter PMS integration contract:

- Property sends PMS-owned descriptive data only.
- Room types send PMS-owned inventory/catalog fields.
- Rate plans return one flat row per `(rate_plan_id, room_type_id)`.
- Extra services return numeric `price` and `tax_rate`.
- Availability returns one row per room type per date with numeric `price`.
- Booking responses return `pms_booking_id`, `status`, and `price`.

Booking status mapping for GoAdapter polling:

```text
PENDING -> pending
CONFIRMED -> confirmed
CANCELLED / REJECTED / AUTO_CANCELLED / EXPIRED -> cancelled
COMPLETED -> checked_out
```

`POST /api/partner/bookings/:pms_booking_id/cancel` is treated as a
GoAdapter-requested cancellation, so it updates this PMS but does not send a
webhook back to GoAdapter for the same cancellation.

The optional internal adapter-control API is HMAC protected:

```text
POST /api/adapter/bookings
POST /api/adapter/bookings/:id/confirm
POST /api/adapter/bookings/:id/cancel
```

For each request, send:

```text
x-timestamp: 1785400000000
x-signature: sha256=HEX_HMAC_SHA256
```

The signature payload is `timestamp + "." + rawJsonBody`, signed with
`SAAS_ADAPTER_HMAC_SECRET`. Timestamps are accepted within a five-minute window.
This API is not required by `pms-integration-api.yaml`; it is available for
trusted internal adapter automation.

## Live Booking Workflow

New adapter bookings are stored as `PENDING` with `expiresAt = createdAt + 5 minutes`.
Pending metadata is stored in Redis and a delayed `booking-expiration` job is queued.

When a booking is confirmed, rejected, cancelled, or auto-cancelled:

- The change runs in a Prisma transaction.
- The `version` field is checked and incremented for optimistic locking.
- A `BookingEvent` audit record is written.
- Pending Redis metadata is removed.
- Socket.IO emits `booking:confirmed`, `booking:cancelled`, or `booking:expired`.
- BullMQ enqueues adapter webhook sync and notification work with exponential retry.

Socket.IO authenticates with the same JWT used by REST. Owners are joined to
`property:{propertyId}` rooms and admins also join `admin`.

When `SAAS_ADAPTER_CALLBACK_URL` is configured, set it to GoAdapter's
`POST /webhooks/{webhook_code}/` URL. Outbound payloads use the documented
shape: `pms_booking_id`, `event_type`, and `occurred_at`.

## Android Push Notifications

Closed-app Android notifications use Firebase Cloud Messaging. Configure one
of these backend credential styles:

```env
FIREBASE_SERVICE_ACCOUNT_JSON='{"project_id":"...","client_email":"...","private_key":"..."}'
```

or:

```env
FIREBASE_PROJECT_ID="your-project-id"
FIREBASE_CLIENT_EMAIL="firebase-adminsdk-..."
FIREBASE_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\n...\n-----END PRIVATE KEY-----\n"
```

Mobile devices register FCM tokens at:

```text
POST /api/notifications/devices
DELETE /api/notifications/devices/:token
```

If Firebase credentials are missing, realtime Socket.IO notifications continue
to work while the app is open, and the backend logs that push delivery was
skipped.

## Data Model Notes

- One owner can have many properties.
- Each property owns its categories, room types, rooms, rate plans, services, amenities, and availability.
- Room types are sellable inventory groups.
- Rooms are physical bookable units.
- Halls are modeled as room types with larger capacity and physical room records underneath.
- Rate plans can map to many room types.
- Services can map to room types and rate plans.
- Availability is calculated live from active/bookable rooms and date-level room availability records.

## Verification

Recommended checks before committing changes:

```bash
npx prisma validate
npm run build
```

On Windows PowerShell:

```bash
npx.cmd prisma validate
npm.cmd run build
```

## Production Checklist

- Change `JWT_SECRET` before production.
- Change `ADMIN_EMAIL`/`ADMIN_PASSWORD` before production.
- Keep `SAAS_ADAPTER_API_KEY` and `SAAS_ADAPTER_HMAC_SECRET` private.
- Configure CORS using `FRONTEND_ORIGIN`.
- Set `APP_CLIENT_KEY` and keep the frontend's `VITE_CLIENT_KEY` in sync with it —
  a mismatch here makes every frontend request fail with "Invalid client key".
