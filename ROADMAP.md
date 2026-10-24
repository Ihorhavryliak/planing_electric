# DrawMyPlace — Roadmap and Current Status

> This is the working implementation roadmap for DrawMyPlace.
>
> **Status rule:** Only mark a task `[x]` after checking the repository and verifying the implementation. Do not infer implementation status from the specification alone.
>
> **Last updated:** 2026-10-24

## 1. Where we are now

### Confirmed from project planning
- [x] Product concept and MVP requirements drafted.
- [x] Technical stack selected: React, TypeScript, Tailwind CSS, shadcn/ui, NestJS, Zod, PostgreSQL, Drizzle ORM, PGlite for suitable tests, pnpm workspaces, Turborepo.
- [x] Initial architecture and module boundaries documented.
- [x] Editor workflows specified: blank plan creation and JPG/PNG/PDF underlay upload.
- [x] Core editor steps specified: calibration, room/wall drawing, electrical points, cable routes, calculations, materials, exports.
- [x] Accounts, organizations, roles, project sharing, and API authorization requirements documented.
- [x] Main specification file prepared: `SPEC.md` (original generated filename: `DRAW_MY_PLACE_SPEC.md`; rename to `SPEC.md` if using the instructions in `CLAUDE.md`).

### Verified from the repository audit (2026-10-24)
- [x] Repository inspected: before this session it contained only `CLAUDE.md`, `SPEC.md`, `ROADMAP.md`, and `text.txt`; it was not a git repository and had no application code.
- [x] Git initialized and pnpm/Turborepo workspace created.
- [x] Stack configured: React, TypeScript, Tailwind CSS, Vite, NestJS, Zod, PostgreSQL, Drizzle ORM, PGlite, pnpm, and Turborepo.
- [x] Database schema and initial migration exist (16 tables); the migration is applied by a PGlite test.
- [ ] Authentication and project CRUD are not implemented.
- [ ] Editor, calculations, materials, and exports are not implemented.
- [x] Baseline install, build, typecheck, lint, and tests run; results are recorded in the session log.

**Current project stage:** Phase 1 foundation implemented and verified. Phase 2 (authentication and project management) is next.

**Known blocker:** applying the migration to a live PostgreSQL server is unverified because no Docker daemon or local PostgreSQL is available in the current environment.

## 2. Roadmap overview

| Phase | Goal | Priority | Exit criteria |
|---|---|---|---|
| 0. Repository audit | Establish a truthful baseline | P0 | Existing code, scripts, tests, and missing features documented |
| 1. Project foundation | Reliable monorepo, database, API and frontend | P0 | Install, migration, typecheck and build work |
| 2. Accounts and projects | Authentication, personal workspace, project CRUD | P0 | User can sign in, create a project, reopen it, and only access authorized data |
| 3. Editor foundation | Canvas, blank plan, uploaded underlay, save/reload | P0 | Both plan-start workflows work and persist |
| 4. Drawing tools | Walls/rooms, calibration, electrical points, routes | P0 | User can create and edit a complete basic drawing |
| 5. Calculations | Cable lengths, drops, waste allowance, material takeoff | P0 | Results match tested examples and avoid double counting |
| 6. Estimates and export | Materials, prices, CSV/PDF | P1 | User can generate and export a specification |
| 7. Teams and sharing | Organizations, invitations, roles, project access | P1 | Members can collaborate within enforced permissions |
| 8. Reliability and UX | Undo/redo, conflicts, history, accessibility, edge cases | P1 | Core workflows survive errors and concurrent edits safely |
| 9. Real-time collaboration | Live updates and participant presence | P2 | Concurrent users see updates without unsafe overwrites |
| 10. Release preparation | Security, deployment, backups, monitoring, documentation | P0 before production | Release checklist passes |

P0 = required for the first usable MVP. P1 = important follow-up. P2 = advanced feature after the core workflow is stable.

## 3. Detailed task checklist

### Phase 0 — Repository audit (do this first)

- [x] Inspect the root directory and workspace configuration.
- [x] Read root and app `package.json` files.
- [x] Inspect `pnpm-workspace.yaml` and `turbo.json`.
- [x] Identify frontend entry points, routes, layouts, UI library, and state/data-fetching conventions.
- [x] Identify NestJS modules, controllers, services, guards, and validation conventions.
- [x] Inspect Drizzle schema, migrations, database connection, and PGlite setup.
- [x] Inspect `.env.example`; never print or commit secrets.
- [x] Find existing tests and available scripts.
- [x] Run baseline install/typecheck/lint/tests/build as supported by the repository.
- [x] Compare findings with `SPEC.md`.
- [x] Update this file's **Current status** and add a short list of blockers.

**Deliverable:** a verified gap analysis, not a rewrite.

### Phase 1 — Project foundation

- [x] Confirm workspace package manager and Node.js version.
- [x] Confirm frontend and backend can run locally.
- [x] Confirm shared TypeScript and lint configuration.
- [x] Configure environment validation and `.env.example`.
- [x] Configure Drizzle database access and migrations.
- [-] Verify PostgreSQL integration; use PGlite for compatible fast tests. PGlite migration/schema tests pass. Live PostgreSQL migration and readiness are **not verified** because no database server is available.
- [x] Add consistent API error handling and request validation. Normalized exception filter and shared `ZodValidationPipe` are implemented and tested.
- [x] Add health/readiness endpoint if appropriate.
- [x] Document local development commands.

**Exit criteria:** a clean checkout can be installed, configured, migrated, typechecked, tested, and built using documented steps.

**Status:** install, typecheck, lint, tests, build, and API/web smoke tests pass. The migration has only been applied through PGlite; live PostgreSQL verification is still required before this exit criterion is fully met.

### Phase 2 — Authentication and project management

- [ ] Registration/login/logout and protected routes.
- [ ] Current-user endpoint and profile basics.
- [ ] Personal workspace and project list.
- [ ] Create, rename, open, archive, and delete/restore projects according to policy.
- [ ] Server-side resource authorization.
- [ ] Tests for unauthorized access and ID substitution.

**Exit criteria:** a user can create and reopen a project; one user cannot read or modify another user's private project.

### Phase 3 — Editor foundation

- [ ] Build editor page/layout and toolbar.
- [ ] Define a canonical drawing coordinate system independent of viewport zoom.
- [ ] Implement pan, zoom, selection, and canvas resize handling.
- [ ] Create a blank plan.
- [ ] Upload JPG/PNG.
- [ ] Upload PDF and choose/render a page.
- [ ] Store original file and preview metadata.
- [ ] Toggle, lock, fade, reposition, and replace plan underlay.
- [ ] Persist plan/document and reload it after refresh.
- [ ] Show save state and actionable error messages.

**Exit criteria:** both blank-canvas and uploaded-plan workflows open, save, and reload without losing drawing state.

### Phase 4 — Geometry and electrical objects

- [ ] Draw/edit wall segments and room outlines on blank plans.
- [ ] Add/edit dimensions and labels where needed.
- [ ] Implement scale calibration using two points and a known distance.
- [ ] Reject invalid calibration and show when real lengths are unavailable.
- [ ] Add sockets, switches, lights, distribution board, and extensible symbol types.
- [ ] Move, rotate, duplicate, edit, and delete electrical points.
- [ ] Draw polyline cable routes and edit bend points.
- [ ] Assign cable type and optional circuit identifier.
- [ ] Connect route endpoints to points where applicable.
- [ ] Add undo/redo for editor actions.
- [ ] Test coordinate conversion and zoom-independent geometry.

**Exit criteria:** a user can make and save a simple electrical drawing on either a blank plan or uploaded underlay.

### Phase 5 — Calculations

- [ ] Implement pure, reusable geometry/calculation functions.
- [ ] Calculate polyline segment lengths in the correct coordinate units.
- [ ] Add configurable vertical drops/risers.
- [ ] Ensure vertical lengths are not counted twice.
- [ ] Apply configurable waste percentage (default 10%).
- [ ] Show a breakdown of route length, vertical additions, waste, and final quantity.
- [ ] Define quantity rounding/purchase-unit behavior.
- [ ] Recalculate when geometry, calibration, cable type, or settings change.
- [ ] Add unit tests for geometry, calibration, rounding, and allowances.

**Required test example:** 24 m plan route + four 1.5 m drops + 10% waste = 33 m.

**Exit criteria:** calculations are deterministic, explainable, and covered by automated tests.

### Phase 6 — Materials, estimates, and exports

- [ ] Add a default materials catalog.
- [ ] Support organization-specific material items/prices when organization support is ready.
- [ ] Build material takeoff from calculated routes.
- [ ] Store estimate versions and price snapshots.
- [ ] Support clearly marked manual quantity/price overrides if needed.
- [ ] Export CSV.
- [ ] Export PDF.
- [ ] Enforce export permissions and secure file access.

**Exit criteria:** a user can create, save, reopen, and export a material specification.

### Phase 7 — Teams, roles, and sharing

- [ ] Create organization and organization settings.
- [ ] Add organization memberships and roles.
- [ ] Implement secure invitations with expiration and revocation.
- [ ] Add project-level sharing.
- [ ] Enforce permissions in API guards/policies/services.
- [ ] Distinguish platform admin from organization owner/admin.
- [ ] Test role boundaries and cross-organization isolation.
- [ ] Add basic activity log and notifications.

**Exit criteria:** an owner can invite a worker or viewer; each role can perform only authorized actions.

### Phase 8 — Reliability and UX

- [ ] Debounced autosave with visible save/error state.
- [ ] Revision/version checks to prevent silent overwrites.
- [ ] Recovery flow for stale/conflicting document changes.
- [ ] Empty/loading/error states for core pages.
- [ ] Keyboard and accessibility review.
- [ ] Tablet layout review.
- [ ] Large-plan performance checks.
- [ ] Verify PDF/file upload limits and malformed file handling.
- [ ] Add end-to-end tests for the complete MVP workflow.

### Phase 9 — Optional real-time collaboration

- [ ] Choose WebSocket transport and authorization model.
- [ ] Broadcast document revisions/operations.
- [ ] Show active collaborators and basic presence.
- [ ] Handle reconnects and stale revisions.
- [ ] Test simultaneous edits and permission revocation.

Do not start this phase before reliable saving and conflict detection exist.

### Phase 10 — Production readiness

- [ ] Review authentication, authorization, upload security, rate limits, and secrets.
- [ ] Configure production database migrations.
- [ ] Configure object storage and access policies.
- [ ] Set up backups and a restore procedure.
- [ ] Configure logs, error reporting, and health monitoring.
- [ ] Document deployment and rollback.
- [ ] Run full regression tests.
- [ ] Confirm no critical permissions or data-loss bugs remain.

## 4. MVP end-to-end acceptance scenario

Use this scenario as the main definition of a working MVP:

1. Register and sign in.
2. Create a project named `Test apartment`.
3. Add a floor named `Floor 1`.
4. Choose **Blank plan** or upload a sample JPG/PNG/PDF.
5. Calibrate the plan using a known distance.
6. Draw a room/wall outline if using a blank plan.
7. Place a distribution board, two sockets, one switch, and one light.
8. Draw a cable route and assign a cable type.
9. Configure vertical drops and 10% waste.
10. Review the calculation breakdown and material list.
11. Save, refresh, and reopen the project.
12. Export CSV and PDF.
13. Invite a second user as a viewer and verify they cannot edit.
14. Attempt to access the project as an unrelated user and verify the API denies access.

The MVP is ready for initial user testing only when this scenario works end to end and relevant tests pass.

## 5. How to keep the status accurate

For each task, use:
- `[ ]` Not started or not yet verified.
- `[-]` In progress.
- `[x]` Implemented and verified.
- `[!]` Blocked; explain why in a note.

After each meaningful development session, update:
1. **Current status** near the top.
2. The relevant task checkboxes.
3. **Next 3 actions** below.
4. Tests run and results.
5. Known bugs and blockers.

Do not mark a feature complete merely because a file or UI component exists. Verify the behavior and persistence.

## 6. Next 3 actions

1. **Verify PostgreSQL against a real server** once a Docker daemon or PostgreSQL instance is available: `pnpm db:up`, `pnpm db:migrate`, then confirm `/api/v1/health/ready` returns `200`.
2. **Implement the first Phase 2 vertical slice**: registration, login, current-user endpoint, and a protected route with tests.
3. **Add project CRUD** with server-side resource authorization and tests for cross-user access denial.

## 7. Session log

Add a short dated entry after each work session:

```text
### YYYY-MM-DD
- Completed:
- Tests run:
- Issues/blockers:
- Next action:
```

### 2026-10-24
- Completed: Phase 0 audit; git and pnpm/Turborepo monorepo; NestJS API with env validation, error filter, security headers, CORS, and health/readiness endpoints; shared Zod request-validation pipe; React/Vite/Tailwind web shell with live stack status; shared Zod contracts; Drizzle schema (16 tables), initial migration, PostgreSQL client; PGlite migration tests; README and roadmap updates.
- Tests run: `pnpm install`, `pnpm build`, `pnpm typecheck`, `pnpm lint`, `pnpm test` (13 tests in 5 suites). API smoke test returned `200` for liveness and `503` with an actionable body for readiness without PostgreSQL. Web returned `200`, and the Vite proxy reached the API successfully.
- Issues/blockers: Docker CLI exists but the daemon is not running, and no local PostgreSQL is available. Live PostgreSQL migration/readiness is unverified.
- Next action: start Phase 2 authentication.
