#!/bin/sh
set -e

echo "Running database migrations..."
pnpm drizzle-kit push

echo "Running database seed..."
pnpm tsx test/db/seed.ts

echo "Starting development server..."
exec pnpm dev