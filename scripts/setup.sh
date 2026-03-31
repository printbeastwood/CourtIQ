#!/bin/bash
set -e

echo "=============================="
echo "  CourtIQ — Project Setup"
echo "=============================="
echo ""

# Check Docker
if ! command -v docker &> /dev/null; then
  echo "ERROR: Docker is not installed. Install Docker Desktop first."
  echo "  → https://www.docker.com/products/docker-desktop/"
  exit 1
fi

if ! docker info &> /dev/null 2>&1; then
  echo "ERROR: Docker is not running. Please start Docker Desktop."
  exit 1
fi

# Create .env from example if it doesn't exist
if [ ! -f .env ]; then
  cp .env.example .env
  echo "✓ Created .env from .env.example"
else
  echo "✓ .env already exists"
fi

# Start PostgreSQL
echo ""
echo "Starting PostgreSQL with pgvector..."
docker compose up -d --wait
echo "✓ PostgreSQL is running on port 5432"

# Enable pgvector extension
echo "Enabling pgvector extension..."
docker exec courtiq-db psql -U courtiq -c "CREATE EXTENSION IF NOT EXISTS vector;"
echo "✓ pgvector extension enabled"

# Install dependencies
echo ""
echo "Installing npm dependencies..."
npm install
echo "✓ Dependencies installed"

# Build packages (needed before db:push)
echo ""
echo "Building packages..."
npx turbo build
echo "✓ Build complete"

# Push database schema
echo ""
echo "Pushing database schema..."
cd packages/db
npx drizzle-kit push --force
cd ../..
echo "✓ Database schema applied"

# Seed database
echo ""
echo "Seeding database with demo data..."
npx tsx packages/db/src/seed.ts
echo "✓ Database seeded"

echo ""
echo "=============================="
echo "  Setup complete!"
echo "=============================="
echo ""
echo "To start the backend API:"
echo "  npm run dev:api"
echo ""
echo "To start the venue dashboard:"
echo "  npm run dev:dashboard"
echo ""
echo "To start the mobile app:"
echo "  cd apps/mobile && npx expo start"
echo ""
