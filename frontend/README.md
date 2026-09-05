# Restaurant Admin Frontend

Web + Android admin dashboard for restaurant Admins and SuperAdmins — manage
restaurants, menus, slot availability, and customer bookings. Built with:

- React 19, TypeScript, Vite
- TanStack Query, Zustand
- Socket.IO client (live booking updates)
- Capacitor (packages the same web app as an Android app)

This was transformed from a Hotel PMS admin dashboard. It talks to the
Restaurant backend's `/api/admin/*` and shared endpoints only — there is no
customer-facing UI here (customers use their own Firebase-authenticated app;
see `backend/README.md`).

## Project Structure

```text
src/
  app/App.tsx              Route tree (login gate -> restaurant picker -> workspace)
  components/layout/        WorkspaceShell (sidebar/topbar nav)
  components/resource/       dialog-kit.tsx (generic form/dialog/image-upload toolkit)
  components/ui/            Button, DateInput, PasswordInput, StateView
  features/
    auth/LoginPage.tsx        Admin/SuperAdmin email+password login
    restaurants/               Restaurant picker (enter workspace) + SuperAdmin create/list
    dashboard/                 Stats + recent bookings for the active restaurant
    bookings/                  Booking list/filter/detail/cancel
    settings/                  General (restaurant profile), Menu, Slots,
                                Categories (SuperAdmin-only global taxonomy)
    admins/                    SuperAdmin: manage AdminUsers + restaurant assignment
    profile/                   Own account + change password
  providers/                  SocketProvider, BackButtonProvider (Capacitor back button)
  lib/api-client.ts            Unwraps the backend's {status,message,data} envelope
  store/app-store.ts            adminToken/admin/activeRestaurant session (persisted)
  socket/                      restaurant:booking:* / restaurant:notification:new events
```

## Environment

```bash
cp .env.example .env
```

```env
VITE_API_URL=http://localhost:4000/api
VITE_API_PROXY_TARGET=http://localhost:4000
VITE_CLIENT_KEY=change-this-client-key   # must match backend APP_CLIENT_KEY
```

## Running Locally

Start the backend first (see `backend/README.md`), then:

```bash
npm install
npm run dev      # http://localhost:3000
```

## Auth & Session

Login (`POST /admin/auth/login`) stores `{ adminToken, admin }` in
`localStorage` under `restaurant-admin-session`. A plain `Admin` sees only
restaurants they're assigned to (`AdminRestaurant`); a `SUPERADMIN` sees and
manages everything, plus the "Admins" section for creating/assigning other
admins. Selecting a restaurant sets `activeRestaurant`, which scopes every
`/admin/restaurants/:id/...` call afterward.

## Live Updates

After login the app opens a Socket.IO connection authenticated with the
admin JWT. These events invalidate the bookings query so the list refreshes
without a manual reload:

```
restaurant:booking:new
restaurant:booking:modified
restaurant:booking:cancelled
```

> The previous Hotel PMS version of this app used Firebase Cloud Messaging
> (Capacitor Push Notifications) for admin-side push alerts. That backend
> endpoint (`PushDevice`/FCM) was removed as part of the Hotel→Restaurant
> transformation — customer push now goes through OneSignal on the backend,
> and admin-side real-time updates rely on the Socket.IO connection above.
> Re-add FCM here only if admin push notifications become a requirement.

## Production Build

```bash
npm run build   # outputs dist/
```

## Android (Capacitor)

Unchanged from the original project — the same web build is packaged as an
Android app:

```bash
npm run build
npx cap sync android
cd android && ./gradlew assembleDebug   # -> android/app/build/outputs/apk/debug/app-debug.apk
```

Requires Java JDK 21 and the Android SDK/Platform Tools/Build Tools;
`android/local.properties` must point `sdk.dir` at your SDK install. Run
`npm run android:open` to open the project in Android Studio instead.

## Deployment

Unchanged: every push to `main` touching `frontend/**` builds and uploads
`dist/` to the VPS via `.github/workflows/frontend-deploy.yml`. No server
restart needed — it's served as static files.

## Common Issues

- **API requests failing** — confirm the backend is running, `VITE_API_URL`
  is correct, and `VITE_CLIENT_KEY` matches the backend's `APP_CLIENT_KEY`.
- **401 on every request** — the admin JWT expired or `adminToken` is stale;
  sign out and back in.
