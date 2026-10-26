# DrawMyPlace

Browser-based electrical installation planning: start from a blank plan or an uploaded drawing, place electrical points, route cable, calculate lengths and materials, and export an estimate.

The product specification lives in [`SPEC.md`](./SPEC.md). Implementation status lives in [`ROADMAP.md`](./ROADMAP.md). For a detailed Ukrainian setup guide, see [`RUN.md`](./RUN.md), and for production operations see [`DEPLOYMENT.md`](./DEPLOYMENT.md).

## Current status

The MVP core is implemented: authentication (including password reset), projects, floors, blank/uploaded plans, calibration, walls/rooms/dimensions, electrical points, circuits, cable routes, calculations, materials, estimates, CSV/PDF export, organizations, email invitations, project sharing, notifications, activity log, revision conflict checks, and real-time plan notifications via SSE.

Verified in this repository:

- pnpm workspace with Turborepo, shared TypeScript baseline, and ESLint.
- NestJS API with `/api/v1` prefix, Zod-validated environment configuration, normalized errors, `helmet` headers, CORS, and liveness/readiness endpoints.
- Shared Zod request-validation pipe with field-level error messages.
- Registration, login, logout, and current-user endpoints with Argon2id password hashing, hashed server-side sessions, and in-memory rate limiting.
- Project CRUD with owner-scoped queries: create, list, open, rename, archive, and restore.
- React + Vite + Tailwind web app with login and registration pages, a protected project workspace, project detail pages, and a router.
- PostgreSQL schema defined with Drizzle ORM: 17 tables, enums, foreign keys, indexes, and two tracked migrations (`users`, `sessions`).
- Shared Zod contracts package.
- Tests using Vitest and PGlite, including auth and project integration tests against the real migrations.

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

- Web: <http://localhost:3004>
- API liveness: <http://localhost:5004/api/v1/health>
- API readiness: <http://localhost:5004/api/v1/health/ready>

Ports come from the root `.env`: `API_PORT`, `WEB_PORT`, and `WEB_ORIGIN`. Defaults are `5004`, `3004`, and `http://localhost:3004`. If you change the web port, update `WEB_ORIGIN` too.

The API starts without PostgreSQL. In that case liveness returns `200`, while readiness returns `503` with an actionable error. The web page reports both states.

Open <http://localhost:3004/register> to create the first account. Registration, login, and logout require a working database and applied migrations.

## Authentication

Authentication uses server-side cookie sessions, not JWTs and not `localStorage`.

| Endpoint | Purpose |
|---|---|
| `POST /api/v1/auth/register` | Create an account and set the session cookie (`201`). |
| `POST /api/v1/auth/login` | Verify credentials and set the session cookie (`200`). |
| `POST /api/v1/auth/logout` | Revoke the current session and clear the cookie (`204`). |
| `GET /api/v1/users/me` | Return the authenticated user (`401` without a valid session). |

- Passwords are hashed with Argon2id via `@node-rs/argon2` (19 MiB memory, 2 iterations, parallelism 1).
- Session tokens are 32 random bytes encoded as base64url. Only the SHA-256 hash of a token is stored in `sessions.token_hash`.
- The cookie is `dmp_session`: `HttpOnly`, `SameSite=Lax`, `Secure` in production, with a 30-day default lifetime.
- Login and registration attempts are limited in memory to 10 per 15 minutes per IP and route by default.
- Web routes: `/login`, `/register`, the protected `/app` workspace, and `/app/projects/:projectId`.

Authentication configuration in the root `.env`:

```env
SESSION_TTL_DAYS=30
AUTH_RATE_LIMIT=10
AUTH_RATE_WINDOW_MINUTES=15
```

In-memory rate limiting is per API instance. A shared store such as Redis is required before running multiple API instances.

## Projects

Every project belongs to the user who created it. List, read, update, archive, and restore queries are filtered by `createdBy`; another user's project returns `404` instead of revealing that it exists.

| Endpoint | Purpose |
|---|---|
| `GET /api/v1/projects?status=active\|archived\|all` | List the current user's projects; defaults to `active`. |
| `POST /api/v1/projects` | Create a project (`201`). |
| `GET /api/v1/projects/:id` | Read one owned project. |
| `PATCH /api/v1/projects/:id` | Rename or update the description. |
| `POST /api/v1/projects/:id/archive` | Move a project to `archived` (reversible). |
| `POST /api/v1/projects/:id/restore` | Move an archived project back to `active`. |

- The workspace lists active and archived projects separately and supports create, rename, archive, and restore.
- Archiving is the deletion policy for now: it is reversible and no hard-delete endpoint exists.
- Project names are required, trimmed, and limited to 120 characters; descriptions are optional and limited to 2000 characters.
- Organization and project sharing tables exist in the schema, but team access is not implemented until Phase 7.

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
| `pnpm browser:check` | Run the Playwright browser smoke check (API and web must be running). |

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
RUN.md                  Detailed Ukrainian setup and troubleshooting guide
```

## Observability

- The API logs each request with a request id, duration, status, and route. The id is returned as `X-Request-Id`.
- Set `SENTRY_DSN` to send API exceptions (HTTP 500s) to Sentry; without it, reporting is a no-op.
- Set `VITE_SENTRY_DSN` to enable browser error and performance reporting; the React tree is wrapped in a Sentry error boundary.
- Health endpoints: `GET /api/v1/health` (liveness) and `GET /api/v1/health/ready` (database readiness).

## Database

- Schema: `packages/database/src/schema`
- Migrations: `packages/database/migrations`
- Client: `packages/database/src/index.ts`
- Drizzle config: `packages/database/drizzle.config.ts`

After changing the schema, run `pnpm db:generate` and commit the generated migration. Apply it with `pnpm db:migrate`. Tests use PGlite and apply the committed migrations, so migration files must stay in sync with the schema.

## Verification baseline — 2026-10-26

- `pnpm install` — passed.
- `pnpm build` — passed (API, web, contracts, database).
- `pnpm typecheck` — passed.
- `pnpm lint` — passed.
- `pnpm test` — 64 API tests and 79 web tests passed.
- Live PostgreSQL — migrations `0000`–`0009` applied to a clean `drawmyplace_qa` database created in the Docker container; 24 public tables and the `estimates.warnings` JSONB column verified.
- Browser smoke check on a clean database (`node scripts/browser-check.mjs`) — registration, theme persistence, Ukrainian/English locale persistence, project/floor creation, PNG and PDF underlays, wall/doors/windows, calibration, circuits (create/assign), points (place/rotate/duplicate), cable routes (draw, pan, bend drag, delete + undo), rooms, dimensions, 3D view and GLB download, variants, and local-first create/draw/reload/export/import/sync.
- Health endpoints — `/api/v1/health` and `/api/v1/health/ready` return `200` with PostgreSQL available.
- Optional Sentry reporting is wired for API (HTTP 500s) and web (global handlers + error boundary); it stays disabled until `SENTRY_DSN` / `VITE_SENTRY_DSN` are set.

## Security notes

- Never commit `.env`; only `.env.example` is tracked.
- The API validates its environment at startup.
- Passwords are hashed with Argon2id; session tokens are stored only as SHA-256 hashes.
- Project-level authorization is implemented for personal projects: all project queries are owner-scoped and cross-user access returns `404`. Organization and shared-project permissions are not implemented yet, so do not expose this build publicly for multi-tenant use.
- In-memory rate limiting does not survive restarts and is not shared between API instances.
