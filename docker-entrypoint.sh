#!/bin/sh
set -e

if [ ! -d "node_modules" ] || [ -z "$(ls -A node_modules)" ]; then
    echo "Installing dependencies..."
    pnpm install --frozen-lockfile
fi

echo "Running database migrations..."
pnpm drizzle-kit push

echo "Running database seed..."
pnpm tsx test/db/seed.ts

echo "Starting development server..."
exec pnpm dev