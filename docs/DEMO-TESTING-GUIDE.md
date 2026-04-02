# CourtIQ Demo Testing Guide

A step-by-step guide to deploy and demo all CourtIQ MVP features. Designed for the CEO/founder to follow on their own machine.

**Time estimate:** ~30 minutes (excluding account creation wait times)

**Prerequisites:**
- macOS or Linux machine
- Node.js 22+ installed (`node --version`)
- [Fly.io CLI](https://fly.io/docs/flyctl/install/) installed (`brew install flyctl`)
- A Fly.io account (`fly auth signup`)
- Git access to the CourtIQ repo

---

## Table of Contents

1. [Deploy the API to Fly.io](#1-deploy-the-api-to-flyio)
2. [Firebase Auth Setup](#2-firebase-auth-setup)
3. [AI Concierge Setup (Groq + Voyage AI)](#3-ai-concierge-setup)
4. [Stripe Payments Setup](#4-stripe-payments-setup)
5. [Preference Store & pgvector](#5-preference-store--pgvector)
6. [Seed the Database](#6-seed-the-database)
7. [Venue Dashboard](#7-venue-dashboard)
8. [Mobile App Setup](#8-mobile-app-setup)
9. [End-to-End Demo Walkthrough](#9-end-to-end-demo-walkthrough)
10. [Troubleshooting](#10-troubleshooting)

---

## 1. Deploy the API to Fly.io

The deploy script handles app creation, Postgres provisioning, and deployment in one go.

### 1.1 Login to Fly.io

```bash
fly auth login
```

**Expected:** Browser opens for Fly.io login. After login you see:
```
successfully logged in as you@email.com
```

### 1.2 Run the deploy script

From the repo root:

```bash
bash scripts/deploy-staging.sh
```

**What this does:**
- Creates the `courtiq-api` app in Singapore (`sin` region, ~30ms to Bangkok)
- Provisions Fly Postgres (`courtiq-db`) with pgvector support
- Provisions Upstash Redis (`courtiq-redis`) for push notifications
- Builds and deploys the Docker image
- Runs database migrations automatically on deploy

**Expected output (first run):**
```
==============================
  CourtIQ — Staging Deploy
==============================

Creating Fly.io app: courtiq-api in sin...
✓ App created
Provisioning Fly Postgres (with pgvector)...
✓ Postgres cluster created
Attaching Postgres to app...
✓ DATABASE_URL set automatically
...
==============================
  Deploy Complete
==============================

Staging URL: https://courtiq-api.fly.dev
Health check: https://courtiq-api.fly.dev/health
```

### 1.3 Verify deployment

```bash
curl https://courtiq-api.fly.dev/health
```

**Expected:**
```json
{"status":"ok"}
```

> **Note:** The first deploy may take 2-3 minutes. If the health check fails, wait 30 seconds and retry. Check logs with `fly logs --app courtiq-api`.

---

## 2. Firebase Auth Setup

Firebase handles phone-based OTP authentication. This requires manual setup in the Firebase Console.

### 2.1 Create a Firebase project

1. Go to [Firebase Console](https://console.firebase.google.com/)
2. Click **"Add project"**
3. Name it `courtiq` (or any name you prefer)
4. Disable Google Analytics (not needed for MVP)
5. Click **"Create project"**

### 2.2 Enable Phone Authentication

1. In the Firebase Console, go to **Authentication** (left sidebar)
2. Click **"Get started"**
3. Go to the **"Sign-in method"** tab
4. Click **"Phone"** and toggle it **ON**
5. Click **"Save"**

### 2.3 Add test phone numbers

For demo purposes, add test phone numbers that bypass real SMS:

1. Still in **Authentication > Sign-in method > Phone**
2. Scroll down to **"Phone numbers for testing"**
3. Add these test numbers:

| Phone Number   | Verification Code |
|---------------|------------------|
| +66800000001  | 123456           |
| +66800000002  | 123456           |
| +66899999999  | 123456           |

4. Click **"Save"**

> **Why test numbers?** Firebase test phone numbers don't send real SMS and don't count toward your quota. The verification code is always what you configure above.

### 2.4 Generate a service account key

1. In Firebase Console, click the **gear icon** (top left) > **Project settings**
2. Go to the **"Service accounts"** tab
3. Click **"Generate new private key"**
4. Click **"Generate key"** — a JSON file downloads

Open the downloaded JSON file. You'll need three values:
- `project_id` (e.g., `courtiq-abc123`)
- `client_email` (e.g., `firebase-adminsdk-xxxxx@courtiq-abc123.iam.gserviceaccount.com`)
- `private_key` (the long string starting with `-----BEGIN PRIVATE KEY-----`)

### 2.5 Set Firebase secrets on Fly.io

```bash
fly secrets set \
  FIREBASE_PROJECT_ID="courtiq-abc123" \
  FIREBASE_CLIENT_EMAIL="firebase-adminsdk-xxxxx@courtiq-abc123.iam.gserviceaccount.com" \
  FIREBASE_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\nMIIE...\n-----END PRIVATE KEY-----\n" \
  --app courtiq-api
```

> **Important:** The `FIREBASE_PRIVATE_KEY` must have literal `\n` characters (not actual newlines). Copy the `private_key` value from the JSON file exactly as-is — it already contains `\n` escape sequences.

**Expected:**
```
Secrets are staged for the first deployment
```

### 2.6 Verify Firebase is active

After setting secrets, redeploy:

```bash
fly deploy --app courtiq-api
```

Then check logs:

```bash
fly logs --app courtiq-api | head -20
```

**Expected:** You should NOT see `"Firebase not configured — running in dev mode"`. Instead you should see the server starting normally without Firebase warnings.

---

## 3. AI Concierge Setup

The AI Concierge uses **Groq** (Llama 3.3 70B) for conversation and **Voyage AI** for preference embeddings. Groq provides fast inference at low cost — ideal for MVP testing.

### 3.1 Get a Groq API key

1. Go to [console.groq.com](https://console.groq.com/)
2. Sign up or log in
3. Go to **API Keys**
4. Click **"Create API Key"**
5. Copy the key (starts with `gsk_`)

### 3.2 Get a Voyage AI API key

1. Go to [dash.voyageai.com](https://dash.voyageai.com/)
2. Sign up or log in
3. Go to **API Keys**
4. Create a new key
5. Copy the key (starts with `pa-`)

### 3.3 Set AI secrets on Fly.io

```bash
fly secrets set \
  LLM_PROVIDER="groq" \
  GROQ_API_KEY="gsk_your-key-here" \
  VOYAGE_API_KEY="pa-your-key-here" \
  --app courtiq-api
```

Then redeploy:

```bash
fly deploy --app courtiq-api
```

### 3.4 Verify the concierge is active

Check logs after deploy:

```bash
fly logs --app courtiq-api | grep -i concierge
```

**Expected:**
```
AI Concierge enabled
```

**Verify the endpoint responds** (requires a valid auth token — see section 9 for full flow):

```bash
curl https://courtiq-api.fly.dev/api/v1/concierge/conversations \
  -H "Authorization: Bearer <firebase-id-token>" \
  -H "Content-Type: application/json" \
  -X POST
```

**Expected:** `201` with a conversation object containing `id`.

### 3.5 Example concierge conversation starters

Once authenticated, try these messages with the concierge:

| Message | Expected Behavior |
|---------|------------------|
| "Find me an indoor court this Saturday morning" | Searches available courts, returns options near Bangkok |
| "I prefer glass courts and hate playing in the heat" | Stores preference, confirms it was saved |
| "What courts are available at Baan Padel tomorrow?" | Searches specific venue availability |
| "Book the cheapest option" | Initiates booking flow for the lowest-price slot |

---

## 4. Stripe Payments Setup

Stripe handles court booking payments with a 5% commission model (0% promotional for first 90 days).

### 4.1 Create a Stripe test account

1. Go to [dashboard.stripe.com](https://dashboard.stripe.com/)
2. Sign up or log in
3. You'll be in **test mode** by default (toggle in top-right shows "Test mode")

### 4.2 Get your test API key

1. In Stripe Dashboard, go to **Developers > API keys**
2. Copy your **Secret key** (starts with `sk_test_`)

> **Important:** Make sure you're copying the **test** key, not a live key. Test keys start with `sk_test_`.

### 4.3 Set up the webhook endpoint

1. In Stripe Dashboard, go to **Developers > Webhooks**
2. Click **"Add endpoint"**
3. Set the endpoint URL: `https://courtiq-api.fly.dev/api/v1/webhooks/stripe`
4. Select these events to listen to:
   - `payment_intent.succeeded`
   - `payment_intent.payment_failed`
   - `charge.refunded`
5. Click **"Add endpoint"**
6. On the endpoint detail page, click **"Reveal"** under **Signing secret** to copy the webhook secret (starts with `whsec_`)

### 4.4 Set Stripe secrets on Fly.io

```bash
fly secrets set \
  STRIPE_SECRET_KEY="sk_test_your-key-here" \
  STRIPE_WEBHOOK_SECRET="whsec_your-secret-here" \
  --app courtiq-api
```

Then redeploy:

```bash
fly deploy --app courtiq-api
```

### 4.5 Verify Stripe is active

```bash
fly logs --app courtiq-api | grep -i stripe
```

**Expected:**
```
Stripe payment service enabled
```

### 4.6 Test card numbers

When testing payments, use these Stripe test card numbers:

| Card Number          | Scenario              |
|---------------------|-----------------------|
| `4242 4242 4242 4242` | Successful payment    |
| `4000 0000 0000 0002` | Card declined         |
| `4000 0000 0000 3220` | 3D Secure required    |

- **Expiry:** Any future date (e.g., `12/34`)
- **CVC:** Any 3 digits (e.g., `123`)
- **ZIP:** Any 5 digits (e.g., `10110`)

---

## 5. Preference Store & pgvector

The Preference Store uses **pgvector** (PostgreSQL vector extension) for semantic similarity search on user preferences.

### 5.1 pgvector on Fly Postgres

Fly Postgres images **do include pgvector**. The migration script automatically enables it:

```sql
CREATE EXTENSION IF NOT EXISTS vector;
```

To verify it's working, SSH into the Fly machine:

```bash
fly ssh console --app courtiq-api -C 'node -e "
const pg = require(\"postgres\");
const sql = pg(process.env.DATABASE_URL);
sql\`SELECT extname FROM pg_extension WHERE extname = 'vector'\`.then(r => {
  console.log(r.length ? \"pgvector is ENABLED\" : \"pgvector NOT available\");
  sql.end();
});
"'
```

**Expected:**
```
pgvector is ENABLED
```

### 5.2 If pgvector is NOT available

If the extension fails to load (you'll see `"pgvector extension not available"` in deploy logs), the following features are **degraded**:

| Feature | Without pgvector |
|---------|-----------------|
| Preference semantic search | Falls back to keyword/category matching |
| Concierge context retrieval | Only uses category-based lookup |
| Preference storage | Text + category stored, but no vector embedding |

**Everything else works normally** — bookings, search, ratings, payments are unaffected.

### 5.3 Verify preference store is active

Check deploy logs:

```bash
fly logs --app courtiq-api | grep -i preference
```

**Expected (with both AI keys set):**
```
Preference store enabled (pgvector + Voyage AI embeddings)
```

---

## 6. Seed the Database

The seed script creates demo venues (real Bangkok padel venues), courts, availability slots, and test users.

### 6.1 Run the seed

```bash
fly ssh console --app courtiq-api -C 'node packages/db/dist/seed.js'
```

**Expected:**
```
Seeding CourtIQ database...

Created 6 venues
Created 22 courts
Created 1078 availability slots
Created 2 demo users

Seed complete!
```

### 6.2 Verify seeded data via API

```bash
curl -s https://courtiq-api.fly.dev/api/v1/search/courts | python3 -m json.tool | head -20
```

**Expected:** JSON response with court/slot data from seeded Bangkok venues:
- Baan Padel (7 courts)
- No Drama Padel (5 courts)
- The Padel Co. (2 courts)
- Kross Padel Indoor / Rama IV (3 courts)
- Pad Thai Padel (3 courts)
- Bangkok Padel (2 courts)

> **Note:** If the search route requires authentication, you'll get a 401. That's expected — the full flow requires a Firebase token (see section 9).

---

## 7. Venue Dashboard

The venue dashboard is a React (Vite) web app deployed separately on **Vercel**.

### 7.1 Deploy to Vercel

1. Go to [vercel.com](https://vercel.com/) and sign up / log in
2. Click **"Add New Project"**
3. Import the CourtIQ GitHub repo
4. Configure the project:
   - **Root Directory:** `apps/venue-dashboard`
   - **Framework Preset:** Vite
   - **Build Command:** `cd ../.. && npx turbo run build --filter=@courtiq/venue-dashboard`
   - **Output Directory:** `dist`
5. Set environment variable:
   - `VITE_API_BASE_URL` = `https://courtiq-api.fly.dev/api/v1`
6. Click **"Deploy"**

**Expected:** Vercel builds and deploys. You get a URL like `courtiq-venue-dashboard.vercel.app`.

### 7.2 Verify the dashboard

Open the Vercel URL in your browser. You should see the venue dashboard login page.

> **Note:** The venue dashboard uses the same Firebase auth backend. Venue operators authenticate via phone number, same as players.

---

## 8. Mobile App Setup

The mobile app uses **Expo (React Native)** and requires Firebase native configuration.

### 8.1 Install dependencies

From the repo root:

```bash
cd apps/mobile
npm install
```

### 8.2 Configure Firebase for the mobile app

#### iOS (GoogleService-Info.plist)

1. In Firebase Console, go to **Project settings**
2. Click **"Add app"** > **iOS**
3. Bundle ID: `com.courtiq.app`
4. Download `GoogleService-Info.plist`
5. Place it in `apps/mobile/ios/` (this directory is created after first Expo prebuild)

#### Android (google-services.json)

1. In Firebase Console, click **"Add app"** > **Android**
2. Package name: `com.courtiq.app`
3. Download `google-services.json`
4. Place it in `apps/mobile/android/app/`

### 8.3 API configuration

The mobile app is already configured to point to the deployed API:

- **API URL:** `https://courtiq-api.fly.dev/api/v1`
- **WebSocket URL:** `wss://courtiq-api.fly.dev/api/v1/concierge/ws`

These are set in `apps/mobile/app.json` under `expo.extra`. No changes needed if using the default `courtiq-api` Fly app name.

### 8.4 Run on a device/simulator

```bash
# For iOS simulator
npx expo run:ios

# For Android emulator
npx expo run:android
```

> **Note:** Phone auth with `@react-native-firebase/auth` requires a native build (not Expo Go). Use `npx expo run:ios` or `npx expo run:android` which triggers a development build.

---

## 9. End-to-End Demo Walkthrough

Follow these steps to demo the complete user journey.

### Step 1: Sign in (Mobile App)

1. Open the CourtIQ mobile app
2. Enter a test phone number: `+66800000001`
3. Tap **"Send OTP"**
4. Enter the verification code: `123456`
5. You're signed in as "Demo Player"

**Expected:** You land on the home screen with court search available.

### Step 2: Search courts

1. On the home screen, browse available courts
2. Filter by:
   - **Date:** Today or tomorrow
   - **Indoor/Outdoor:** Try filtering for indoor
   - **Venue:** Select "Baan Padel"

**Expected:** You see available time slots with prices (600 THB off-peak, 1000 THB peak hours 17:00-21:00).

### Step 3: Talk to the AI Concierge

1. Navigate to the **Concierge** tab
2. Start a new conversation
3. Type: `"Find me a cheap indoor court tomorrow morning"`

**Expected:** The concierge:
- Searches available courts matching your criteria
- Returns 2-3 indoor options with prices and times
- Asks if you'd like to book one

4. Try: `"I prefer glass courts over panoramic ones"`

**Expected:** The concierge confirms it saved your preference.

5. Try: `"What about Saturday evening with friends?"`

**Expected:** The concierge searches for slots, noting your glass court preference.

### Step 4: Book a court

1. From search results (or concierge suggestion), tap a slot to book
2. Confirm the booking details (venue, court, time, price)
3. Enter payment:
   - Card: `4242 4242 4242 4242`
   - Expiry: `12/34`
   - CVC: `123`
4. Confirm payment

**Expected:**
- Payment succeeds
- Booking is confirmed with a confirmation screen
- You receive a booking ID

### Step 5: Check the Venue Dashboard

1. Open the venue dashboard in your browser
2. Log in with a test phone number (you may need to use the same auth flow)
3. Navigate to **Bookings**

**Expected:** You see the booking you just made, with:
- Player name
- Court and time
- Payment status (succeeded)
- Commission breakdown (5% or 0% promo)

### Step 6: Verify the booking via API

```bash
# Replace <token> with your Firebase ID token
curl -s https://courtiq-api.fly.dev/api/v1/bookings \
  -H "Authorization: Bearer <token>" | python3 -m json.tool
```

**Expected:** JSON response showing your booking with status `confirmed`.

---

## 10. Troubleshooting

### API won't start / health check fails

```bash
fly logs --app courtiq-api
```

Common causes:
- **Missing `DATABASE_URL`:** Postgres not attached. Run `fly postgres attach courtiq-db --app courtiq-api`
- **Migration failed:** Check for SQL errors in logs. Run migrations manually: `fly ssh console --app courtiq-api -C 'node packages/db/dist/migrate.js'`

### Firebase auth returns 401

- Verify secrets are set: `fly secrets list --app courtiq-api`
- Check the `FIREBASE_PRIVATE_KEY` has `\n` newlines, not literal line breaks
- Ensure the Firebase project has phone auth enabled
- Ensure test phone numbers are configured in Firebase Console

### Concierge not responding

- Check `LLM_PROVIDER` is set to `groq`, `GROQ_API_KEY` and `VOYAGE_API_KEY` are set
- Look for `"AI Concierge enabled"` in deploy logs
- If you see `"Concierge disabled"` — one or both keys are missing

### Stripe payments failing

- Ensure `STRIPE_SECRET_KEY` starts with `sk_test_` (not `sk_live_`)
- Verify webhook secret matches the one in Stripe Dashboard
- Check webhook events are configured for the correct URL

### pgvector not available

If deploy logs show `"pgvector extension not available"`:
1. Connect to the Fly Postgres cluster directly:
   ```bash
   fly postgres connect --app courtiq-db
   ```
2. Try enabling it manually:
   ```sql
   CREATE EXTENSION IF NOT EXISTS vector;
   ```
3. If it fails, the Fly Postgres image may not include pgvector. The app will still work — preference embeddings will be skipped, but all other features function normally.

### Seed fails with duplicate key errors

The seed script does not check for existing data. If you've already seeded:

```bash
fly ssh console --app courtiq-api -C 'node -e "
const pg = require(\"postgres\");
const sql = pg(process.env.DATABASE_URL);
sql\`TRUNCATE venues, courts, availability_slots, users CASCADE\`.then(() => {
  console.log(\"Tables cleared\");
  sql.end();
});
"'
```

Then re-run the seed.

### Venue dashboard shows blank page

- Check browser console for CORS errors
- Verify `VITE_API_BASE_URL` is set correctly on Vercel
- Ensure the API is running and accessible

---

## Environment Variables Summary

| Variable | Required | Where to Set | Description |
|----------|----------|-------------|-------------|
| `DATABASE_URL` | Yes | Auto (Fly Postgres attach) | PostgreSQL connection string |
| `FIREBASE_PROJECT_ID` | Yes | `fly secrets set` | Firebase project ID |
| `FIREBASE_CLIENT_EMAIL` | Yes | `fly secrets set` | Firebase service account email |
| `FIREBASE_PRIVATE_KEY` | Yes | `fly secrets set` | Firebase service account private key |
| `LLM_PROVIDER` | For AI features | `fly secrets set` | LLM provider (`groq` for MVP) |
| `GROQ_API_KEY` | For AI features | `fly secrets set` | Groq API key |
| `VOYAGE_API_KEY` | For AI features | `fly secrets set` | Voyage AI embedding API key |
| `STRIPE_SECRET_KEY` | For payments | `fly secrets set` | Stripe test secret key |
| `STRIPE_WEBHOOK_SECRET` | For payments | `fly secrets set` | Stripe webhook signing secret |
| `REDIS_URL` | For notifications | `fly secrets set` | Upstash Redis URL |
| `PORT` | No | Auto (fly.toml) | Server port (default: 3000) |
| `HOST` | No | Auto (fly.toml) | Server host (default: 0.0.0.0) |
| `NODE_ENV` | No | Auto (fly.toml) | Environment (default: production) |

---

## Quick Reference: All URLs

| Service | URL |
|---------|-----|
| API (Production) | `https://courtiq-api.fly.dev` |
| API Health Check | `https://courtiq-api.fly.dev/health` |
| Venue Dashboard | Deployed on Vercel (see section 7) |
| Firebase Console | `https://console.firebase.google.com/` |
| Stripe Dashboard | `https://dashboard.stripe.com/` |
| Groq Console | `https://console.groq.com/` |
| Voyage AI Dashboard | `https://dash.voyageai.com/` |
| Fly.io Dashboard | `https://fly.io/dashboard` |
