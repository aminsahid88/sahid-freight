# Sahid Freight

Freight marketplace for East Africa — connecting cargo senders with truck owners and drivers across Ethiopia, Somalia, and Djibouti.

## Repository structure

- `apps/mobile/` — React Native + Expo mobile app (iOS + Android)
- `apps/api/` — Express + Prisma backend (deployed to Railway)
- `apps/web/` — Next.js web dashboard
- `packages/db/` — Shared Prisma schema and database client
- `packages/types/` — Shared TypeScript types

## Getting started

```bash
# Install all workspace dependencies
npm install

# Start the API (from repo root)
npm run dev:api

# Start the mobile app
cd apps/mobile
npx expo start

# Run database migrations
npm run db:migrate
```

## Working directories

Mobile commands run from `apps/mobile/`. Backend from `apps/api/`. Always check the working directory before running build commands.
