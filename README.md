# Darshan Connector (Stay PMS)

Enterprise Property Management System for stay/property owners — rooms, halls,
dormitories, bookings, rate plans, services, and live partner adapter (GoAdapter)
integration. The system is a two-package monorepo: an Express/TypeScript API and
a mobile-first React/Capacitor client that ships as an Android app.

## Repository Layout

```text
backend/   Node.js + Express + Prisma API — see backend/README.md
frontend/  React + Vite + Capacitor Android app — see frontend/README.md
.github/workflows/
  backend-deploy.yml   CI/CD: validate + deploy backend to the VPS on push to main
  frontend-deploy.yml  CI/CD: build + upload frontend dist/ to the VPS on push to main
```

Each package has its own dependencies, `.env` files, and lifecycle — always `cd`
into `backend/` or `frontend/` before running its scripts.

## Tech Stack

| | Backend | Frontend |
|---|---|---|
| Language | TypeScript (Node.js 22) | TypeScript |
| Framework | Express 5 | React 19 + Vite |
| Data | Prisma 7 + MySQL/MariaDB | TanStack Query, Zustand |
| Realtime | Socket.IO (Redis adapter), BullMQ | Socket.IO client |
| Mobile | — | Capacitor (Android) |
| Auth | JWT + shared client key | — |
| Push | Firebase Cloud Messaging (admin SDK) | Capacitor Push Notifications |

## Getting Started

Start the backend first, then the frontend — the frontend proxies API calls to it.

```bash
# Backend
cd backend
cp .env.example .env      # fill in DATABASE_URL, JWT_SECRET, APP_CLIENT_KEY, etc.
npm install
npm run prisma:migrate
npm run create-admin
npm run dev                # http://localhost:4000

# Frontend (in a second terminal)
cd frontend
cp .env.example .env       # VITE_CLIENT_KEY must match backend APP_CLIENT_KEY
npm install
npm run dev                # http://localhost:5173
```

Full setup, environment variables, database/Redis requirements, Android build
steps, and API details live in the package READMEs:

- [backend/README.md](backend/README.md)
- [frontend/README.md](frontend/README.md)

## Core Concepts

- One owner can have many properties; each property owns its categories, room
  types, rooms, rate plans, services, amenities, and availability.
- Owners complete a progressive setup flow — `CATEGORY -> ROOM_TYPE -> ROOM ->
  RATE_PLAN -> SERVICE -> COMPLETED` — before they can take bookings.
- New adapter bookings are held `PENDING` for five minutes before auto-cancel,
  with live updates pushed over Socket.IO and processed through BullMQ queues.
- The partner-facing GoAdapter contract is exposed under `/api/partner`
  (aliased at `/api/integrations`) for external booking systems, separate from
  the JWT+client-key auth used by the owner-facing app.

## Deployment

Both packages deploy independently via GitHub Actions on push to `main`:

- **Backend** (`backend-deploy.yml`): builds, applies Prisma migrations, then
  restarts the API under PM2 on the VPS.
- **Frontend** (`frontend-deploy.yml`): builds static assets and uploads
  `dist/` to the VPS; no server restart needed since it's served as static
  files.

Both workflows only trigger on changes to their respective package path.

## Requirements

- Node.js 22.x LTS and npm 10+ for both packages
- MySQL or MariaDB, and Redis 6.2+ for the backend
- Java JDK 21 and the Android SDK for building the frontend's Android app
