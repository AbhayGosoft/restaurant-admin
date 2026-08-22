# Darshan PMS Mobile Frontend

Mobile-first Property Management System (PMS) built with:

- React 19
- TypeScript
- Vite
- TanStack Query
- Zustand
- Socket.IO
- Capacitor Android

---

# Requirements

Install the following software before starting:

- Node.js 22.x LTS
- npm 10+
- Java JDK 21
- Android SDK
- Android Platform Tools
- Android Build Tools
- Git

Verify installation:

```bash
node -v
npm -v
java -version
javac -version
```

Java output must be **21.x**.

---

# Clone Repository

```bash
git clone <repository-url>

cd frontend
```

---

# Install Dependencies

```bash
npm install
```

---

# Environment

The repository already contains:

```
.env.production
```

For local development copy:

```bash
cp .env.example .env
```

Update the following values if required:

```env
VITE_API_URL=http://localhost:4000/api
VITE_API_PROXY_TARGET=http://localhost:4000
VITE_CLIENT_KEY=change-this-client-key
```

> **Important**
>
> `VITE_CLIENT_KEY` **must match** the backend `APP_CLIENT_KEY`.
>
> If they do not match, every API request will fail with **Invalid client key**.

---

# Running Local Development

Start the backend first.

Then run:

```bash
npm run dev
```

Application will be available at:

```
http://localhost:5173
```

Vite automatically reloads after every code change.

---

# Production Build

Generate production assets:

```bash
npm run build
```

Output:

```
dist/
```

---

# Android Setup

Whenever frontend code changes:

```bash
npm run build

npx cap sync android
```

This copies the latest React build into the Android project.

---

# Generate Debug APK

```bash
cd android

./gradlew assembleDebug
```

APK Location:

```
android/app/build/outputs/apk/debug/app-debug.apk
```

---

# Generate Release APK

```bash
cd android

./gradlew assembleRelease
```

APK Location:

```
android/app/build/outputs/apk/release/
```

---

# Generate Play Store Bundle (AAB)

```bash
cd android

./gradlew bundleRelease
```

Output:

```
android/app/build/outputs/bundle/release/
```

---

# First Time Android Setup

If Android has never been configured on the machine:

Install:

- Java JDK 21
- Android SDK
- Android Platform Tools
- Android Build Tools

Accept Android SDK licenses:

```bash
sdkmanager --licenses
```

Verify SDK path:

```
frontend/android/local.properties
```

Example:

```
sdk.dir=C:\\Android
```

---

# First Time Project Setup

```bash
git clone <repository>

cd frontend

npm install

npm run build

npx cap sync android

cd android

./gradlew assembleDebug
```

---

# Daily Development Workflow

Start development:

```bash
npm run dev
```

Whenever you want a new APK:

```bash
npm run build

npx cap sync android

cd android

./gradlew assembleDebug
```

---

# Useful Commands

Install packages

```bash
npm install
```

Development

```bash
npm run dev
```

Build

```bash
npm run build
```

Sync Android

```bash
npx cap sync android
```

Open Android Studio (optional)

```bash
npm run android:open
```

Clean Android

```bash
cd android

./gradlew clean
```

Generate APK

```bash
./gradlew assembleDebug
```

Generate Release

```bash
./gradlew assembleRelease
```

Generate AAB

```bash
./gradlew bundleRelease
```

---

# Project Structure

```
frontend
│
├── android/
├── src/
│   ├── app/
│   ├── components/
│   ├── features/
│   ├── hooks/
│   ├── lib/
│   ├── providers/
│   ├── services/
│   ├── socket/
│   ├── store/
│   ├── styles/
│   └── types/
│
├── package.json
├── vite.config.ts
├── capacitor.config.ts
├── .env.example
└── .env.production
```

---

# Architecture

```
React Source

        │

        ▼

npm run build

        │

        ▼

dist/

        │

        ▼

npx cap sync android

        │

        ▼

android/app/src/main/assets/public

        │

        ▼

Gradle Build

        │

        ▼

APK

        │

        ▼

Android Device
```

---

# Live Booking

After login the application opens a Socket.IO connection.

The following events automatically refresh booking data:

```
booking:new

booking:confirmed

booking:cancelled

booking:expired

notification:new

room:update
```

Pending bookings are automatically reloaded:

```
GET /api/bookings?status=PENDING
```

---

# Push Notifications

Android notifications use:

- Firebase Cloud Messaging
- Capacitor Push Notifications

Setup:

1. Create Firebase Android App
2. Download:

```
google-services.json
```

3. Copy to:

```
frontend/android/app/google-services.json
```

4. Configure backend Firebase credentials.

5. Sync Android:

```bash
npm run android:sync
```

---

# Production Deployment

Deployment is fully automated.

Every push to:

```
main
```

automatically:

- Installs dependencies
- Builds React
- Generates production assets
- Uploads `dist/`
- Deploys to VPS

Workflow:

```
.github/workflows/frontend-deploy.yml
```

No server restart is required because production serves static files.

---

# Common Issues

## Java Version Error

Check:

```bash
java -version

javac -version
```

Expected:

```
Java 21
```

---

## Android SDK Not Found

Verify:

```
frontend/android/local.properties
```

Example:

```
sdk.dir=C:\\Android
```

---

## Build Failed

Clean Android build:

```bash
cd android

./gradlew clean
```

Then build again:

```bash
./gradlew assembleDebug
```

---

## API Requests Failing

Verify:

- Backend is running.
- `VITE_API_URL` is correct.
- `VITE_CLIENT_KEY` matches backend `APP_CLIENT_KEY`.

---

# Notes

- Never edit files inside:

```
android/app/src/main/assets/public
```

These files are automatically generated.

- Always run:

```bash
npm run build
```

before:

```bash
npx cap sync android
```

- Rebuild the APK after every frontend change.

---

# Tech Stack

- React
- TypeScript
- Vite
- Capacitor
- Android
- TanStack Query
- Zustand
- Socket.IO
- Firebase Cloud Messaging