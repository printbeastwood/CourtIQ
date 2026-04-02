#!/bin/bash
set -e

APP_NAME="courtiq-api"
REGION="sin"

echo "=============================="
echo "  CourtIQ — Staging Deploy"
echo "=============================="
echo ""

# Check flyctl is installed
if ! command -v fly &> /dev/null; then
  echo "ERROR: flyctl is not installed."
  echo "  → https://fly.io/docs/flyctl/install/"
  exit 1
fi

# Check if logged in
if ! fly auth whoami &> /dev/null 2>&1; then
  echo "ERROR: Not logged in to Fly.io. Run: fly auth login"
  exit 1
fi

# Check if app exists
if ! fly apps list | grep -q "$APP_NAME"; then
  echo "Creating Fly.io app: $APP_NAME in $REGION..."
  fly apps create "$APP_NAME"
  echo "✓ App created"
else
  echo "✓ App $APP_NAME already exists"
fi

# Provision Postgres (with pgvector) if not attached
if ! fly postgres list | grep -q "courtiq-db"; then
  echo ""
  echo "Provisioning Fly Postgres (with pgvector)..."
  fly postgres create \
    --name courtiq-db \
    --region "$REGION" \
    --vm-size shared-cpu-1x \
    --initial-cluster-size 1 \
    --volume-size 1
  echo "✓ Postgres cluster created"

  echo "Attaching Postgres to app..."
  fly postgres attach courtiq-db --app "$APP_NAME"
  echo "✓ DATABASE_URL set automatically"
else
  echo "✓ Postgres cluster courtiq-db already exists"
fi

# Provision Redis (Upstash) if not attached
if ! fly redis list 2>/dev/null | grep -q "courtiq-redis"; then
  echo ""
  echo "Provisioning Upstash Redis..."
  fly redis create \
    --name courtiq-redis \
    --region "$REGION" \
    --disable-eviction
  echo "✓ Redis created"
  echo ""
  echo "NOTE: Manually set REDIS_URL secret after creation:"
  echo "  fly secrets set REDIS_URL=<redis-url> --app $APP_NAME"
else
  echo "✓ Redis courtiq-redis already exists"
fi

# Remind about required secrets
echo ""
echo "=============================="
echo "  Required Secrets"
echo "=============================="
echo ""
echo "Set these before deploying (skip any already set):"
echo ""
echo "  fly secrets set \\"
echo "    ANTHROPIC_API_KEY=sk-ant-... \\"
echo "    VOYAGE_API_KEY=pa-... \\"
echo "    FIREBASE_PROJECT_ID=courtiq-xxx \\"
echo "    FIREBASE_CLIENT_EMAIL=firebase-adminsdk-xxx@courtiq-xxx.iam.gserviceaccount.com \\"
echo '    FIREBASE_PRIVATE_KEY="-----BEGIN RSA PRIVATE KEY-----\n...\n-----END RSA PRIVATE KEY-----" \'
echo "    --app $APP_NAME"
echo ""
echo "To check current secrets: fly secrets list --app $APP_NAME"

# Deploy
echo ""
echo "=============================="
echo "  Deploying..."
echo "=============================="
echo ""
fly deploy --app "$APP_NAME"

echo ""
echo "=============================="
echo "  Deploy Complete"
echo "=============================="
echo ""
echo "Staging URL: https://$APP_NAME.fly.dev"
echo "Health check: https://$APP_NAME.fly.dev/health"
echo ""
echo "To seed the database:"
echo "  fly ssh console --app $APP_NAME -C 'node packages/db/dist/seed.js'"
echo ""
echo "To view logs:"
echo "  fly logs --app $APP_NAME"
