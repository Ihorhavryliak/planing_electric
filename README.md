# DrawMyPlace

Browser-based electrical installation planning: start from a blank plan or an uploaded drawing, place electrical points, route cable, calculate lengths and materials, and export an estimate.

The product specification lives in [`SPEC.md`](./SPEC.md). Implementation status lives in [`ROADMAP.md`](./ROADMAP.md).

## Current status

**Phase 1 — Project foundation** is implemented. The repository contains a working monorepo, API, database schema, and web shell. Product features (authentication, projects, editor, calculations, exports) are not implemented yet.

Verified in this repository:

- pnpm workspace with Turborepo, shared TypeScript baseline, and ESLint.
- NestJS API with `/api/v1` prefix, Zod-validated environment configuration, normalized errors, `helmet` headers, CORS, and liveness/readiness endpoints.
- Shared Zod request-validation pipe with field-level error messages.
- React + Vite + Tailwind CSS web shell that checks the live API and database readiness.
- PostgreSQL schema defined with Drizzle ORM: 16 tables, enums, foreign keys, indexes, and a tracked initial migration.
- Shared Zod contracts package.
- Tests using Vitest and PGlite.

## Requirements

- Node.js 22.12 or newer.
- pnpm 9.5.
- PostgreSQL 17 for the documented local database flow. Docker Compose is provided, but any PostgreSQL instance works.
- A running Docker daemon is required only for `pnpm db:up`.

## Quick start

```bash
pnpm install
cp .env.example .env
pnpm db:up        # optional if PostgreSQL is already running
pnpm db:migrate
pnpm dev
```

- Web: <http://localhost:5173>
- API liveness: <http://localhost:3000/api/v1/health>
- API readiness: <http://localhost:3000/api/v1/health/ready>

The API starts without PostgreSQL. In that case liveness returns `200`, while readiness returns `503` with an actionable error. The web page reports both states.

## Commands

| Command | Purpose |
|---|---|
| `pnpm dev` | Run the API and web app in watch mode. |
| `pnpm build` | Build shared packages, API, and web app. |
| `pnpm typecheck` | Type-check every package. |
| `pnpm lint` | Lint the repository with ESLint. |
| `pnpm test` | Run all Vitest suites. |
| `pnpm db:generate` | Generate a Drizzle migration after schema changes. |
| `pnpm db:migrate` | Apply tracked migrations to `DATABASE_URL`. |
| `pnpm db:up` / `pnpm db:down` | Start or stop local PostgreSQL with Docker Compose. |

## Repository layout

```text
apps/
  api/                  NestJS API
  web/                  React + Vite + Tailwind web app
packages/
  contracts/            Shared Zod schemas and types
  database/             Drizzle schema, migrations, PostgreSQL client
infra/
  docker-compose.yml    Local PostgreSQL
```

## Database

- Schema: `packages/database/src/schema`
- Migrations: `packages/database/migrations`
- Client: `packages/database/src/index.ts`
- Drizzle config: `packages/database/drizzle.config.ts`

After changing the schema, run `pnpm db:generate` and commit the generated migration. Apply it with `pnpm db:migrate`. Tests use PGlite and apply the committed migrations, so migration files must stay in sync with the schema.

## Verification baseline — 2026-10-24

- `pnpm install` — passed.
- `pnpm build` — passed (API, web, contracts, database).
- `pnpm typecheck` — passed.
- `pnpm lint` — passed.
- `pnpm test` — 13 tests passed across 5 suites.
- API smoke test — `/api/v1/health` returned `200`; `/api/v1/health/ready` returned `503` without PostgreSQL.
- Web smoke test — page returned `200`; the Vite proxy forwarded `/api/v1/health` successfully.
- Live PostgreSQL migration — **not verified**. Docker CLI is installed, but no Docker daemon or local PostgreSQL is available in this environment. PGlite applied the migration successfully.

## Security notes

- Never commit `.env`; only `.env.example` is tracked.
- The API validates its environment at startup.
- Authentication and authorization are not implemented yet. Do not expose this build publicly before Phase 2.
