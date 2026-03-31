# CourtIQ — Staging Deployment (Fly.io)

## Prerequisites

- [flyctl](https://fly.io/docs/flyctl/install/) installed and authenticated (`fly auth login`)
- A Fly.io account with billing enabled (Postgres requires a credit card)

## Quick Deploy

```bash
bash scripts/deploy-staging.sh
```

This script will:
1. Create the `courtiq-api` app in Singapore (`sin`) region
2. Provision Fly Postgres (with pgvector) and Upstash Redis
3. Enable the pgvector extension
4. Deploy the app (runs migrations automatically via `release_command`)

## Required Secrets

Set these before the first deploy:

```bash
fly secrets set \
  ANTHROPIC_API_KEY=sk-ant-... \
  VOYAGE_API_KEY=pa-... \
  FIREBASE_PROJECT_ID=courtiq-xxx \
  FIREBASE_CLIENT_EMAIL=firebase-adminsdk-xxx@courtiq-xxx.iam.gserviceaccount.com \
  FIREBASE_PRIVATE_KEY="-----BEGIN RSA PRIVATE KEY-----\n...\n-----END RSA PRIVATE KEY-----" \
  --app courtiq-api
```

`DATABASE_URL` is set automatically when Postgres is attached.

The API starts without `ANTHROPIC_API_KEY` / `VOYAGE_API_KEY` — AI features (concierge, preference embeddings) are disabled until those keys are set.

## Seed the Database

After the first deploy, seed Bangkok venue data:

```bash
fly ssh console --app courtiq-api -C 'node packages/db/dist/seed.js'
```

## Architecture

| Component | Service | Region | Est. Cost |
|-----------|---------|--------|-----------|
| API | `courtiq-api` (shared-cpu-1x, 512MB) | sin | ~$5/mo |
| PostgreSQL | `courtiq-db` (shared-cpu-1x, 1GB disk) | sin | ~$7/mo |
| Redis | `courtiq-redis` (Upstash, free tier) | sin | $0 |

**Total estimated: ~$12–15/mo for staging.**

## How Deploys Work

1. `fly deploy` builds the Docker image
2. Before traffic switches, `release_command` runs migrations (`node packages/db/dist/migrate.js`)
3. If migrations fail, the deploy is rolled back automatically
4. Health check at `/health` confirms the new version is serving

## Adding New Migrations

```bash
cd packages/db
npx drizzle-kit generate   # generates SQL in drizzle/
```

Commit the generated SQL files. They run automatically on next deploy.

## Useful Commands

```bash
fly logs --app courtiq-api           # tail logs
fly status --app courtiq-api         # app status
fly ssh console --app courtiq-api    # SSH into the container
fly postgres connect -a courtiq-db   # psql into the database
fly secrets list --app courtiq-api   # list configured secrets
```

## Staging URL

```
https://courtiq-api.fly.dev
https://courtiq-api.fly.dev/health
```
