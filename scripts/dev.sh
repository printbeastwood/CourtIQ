#!/bin/bash
set -e

# Ensure Docker is running
if ! docker compose ps --status running 2>/dev/null | grep -q courtiq-db; then
  echo "Starting PostgreSQL..."
  docker compose up -d --wait
fi

echo "Starting CourtIQ dev servers..."
echo "  API:       http://localhost:3000"
echo "  Dashboard: http://localhost:5174"
echo ""

npx turbo dev --filter=@courtiq/api --filter=venue-dashboard
