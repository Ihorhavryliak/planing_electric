# DrawMyPlace — Deployment and Operations

This is a practical guide for running DrawMyPlace in a production-like environment.

## 1. Requirements

- Node.js 20+
- pnpm 9+
- PostgreSQL 15+ (or a compatible managed service)
- A reverse proxy (nginx, Caddy, or a platform load balancer) terminating TLS
- Persistent volume or object storage for uploaded plan files and generated previews

## 2. Environment

Copy `.env.example` to `.env` and set:

| Variable | Purpose |
|---|---|
| `DATABASE_URL` | PostgreSQL connection string |
| `API_PORT` / `WEB_PORT` | Internal ports |
| `WEB_ORIGIN` | Public web origin used for CORS |
| `SESSION_TTL_DAYS` | Session lifetime |
| `AUTH_RATE_LIMIT` / `AUTH_RATE_WINDOW_MINUTES` | Login/register rate limiting |
| `STORAGE_DIR` | Directory for uploaded files and previews |
| `MAX_UPLOAD_MB` | Max plan upload size |
| `PLATFORM_ADMIN_EMAILS` | Comma-separated platform administrator emails |

Never commit `.env`. Keep secrets in the deployment platform's secret store.

## 3. Build and migrate

```bash
pnpm install --frozen-lockfile
pnpm db:migrate
pnpm build
```

Run migrations before starting the new API version. Migrations are additive;
review any destructive change before applying it to production.

## 4. Start

```bash
pnpm --filter @drawmyplace/api start:prod
pnpm --filter @drawmyplace/web preview
```

Use a process manager (systemd, PM2, Docker, or a platform runtime) so the API
restarts after failures.

## 5. Health checks

- `GET /api/v1/health` — liveness.
- `GET /api/v1/health/ready` — readiness, includes database status.

Configure the load balancer to use readiness for routing and liveness for
restart decisions.

## 6. Backups

- Take daily PostgreSQL logical backups (`pg_dump`) and keep at least 14 days.
- Back up `STORAGE_DIR` (or object storage bucket) on the same schedule.
- Store backups in a separate account/region.
- Restore procedure:
  1. Create an empty database.
  2. Restore the latest dump.
  3. Restore the storage directory/bucket.
  4. Point `DATABASE_URL` and `STORAGE_DIR` at the restored data.
  5. Start the API and verify `/health/ready` and a sample project.

## 7. Rollback

1. Keep the previous application build artifact.
2. If a release fails, redeploy the previous artifact.
3. If a migration must be reverted, restore the pre-release backup rather than
   running ad-hoc SQL.
4. Verify login, project list, editor load, and estimate export after rollback.

## 8. Logging and monitoring

- Emit structured logs from the API and ship them to the platform log sink.
- Alert on:
  - `/health/ready` failures
  - sustained 5xx rate
  - database connection errors
  - disk usage for `STORAGE_DIR`
- Do not log passwords, session cookies, invitation tokens, or file contents.

## 9. Security checklist

- [ ] HTTPS enforced at the proxy.
- [ ] Secure, `HttpOnly`, `SameSite` session cookies in production.
- [ ] Rate limiting enabled for auth endpoints.
- [ ] Upload size and MIME type validated server-side.
- [ ] Platform administrator emails configured explicitly.
- [ ] Database and storage backups tested with a restore drill.
- [ ] Dependencies audited (`pnpm audit`) and updated.
