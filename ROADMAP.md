# DrawMyPlace — Roadmap and Current Status

> This is the working implementation roadmap for DrawMyPlace.
>
> **Status rule:** Only mark a task `[x]` after checking the repository and verifying the implementation. Do not infer implementation status from the specification alone.
>
> **Last updated:** 2026-10-25 (session 11)

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
- [x] Database schema and migrations exist (17 tables); both migrations are applied by PGlite tests.
- [x] Authentication is implemented: registration, login, logout, current-user endpoint, Argon2id hashing, server-side sessions, guard, and rate limiting.
- [x] Project CRUD, ownership checks, archive/restore, and the project workspace are implemented and covered by API tests.
- [x] The editor supports blank/uploaded plans, calibration, walls/rooms/dimensions, electrical points, cable routes, materials, and exports with server-side calculation.
- [x] Baseline install, build, typecheck, lint, and tests run; results are recorded in the session log.
- [x] Full local verification on 2026-10-25: `pnpm typecheck`, `pnpm lint`, `pnpm build`, and `pnpm test` all pass.

**Current project stage:** Phase 6/7 foundations expanded: materials CRUD, organizations, invitations, project sharing, notifications, activity log, revision conflict checks, and dedicated estimates/activity pages implemented. Phase 8 reliability/UX and remaining browser verification remain.

**Known blockers:** none. Live PostgreSQL migrations and readiness were verified on 2026-10-25; PGlite applies the same migrations in tests.

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
- [x] Verify PostgreSQL integration; use PGlite for compatible fast tests. PGlite migration/schema tests pass. Live PostgreSQL migration succeeded via `pnpm db:migrate`, and `/api/v1/health/ready` returned `200` with `database: up` on 2026-10-25.
- [x] Add consistent API error handling and request validation. Normalized exception filter and shared `ZodValidationPipe` are implemented and tested.
- [x] Add health/readiness endpoint if appropriate.
- [x] Document local development commands.

**Exit criteria:** a clean checkout can be installed, configured, migrated, typechecked, tested, and built using documented steps.

**Status:** complete. Install, typecheck, lint, tests, build, API/web smoke tests, live PostgreSQL migration, and readiness all pass.

### Phase 2 — Authentication and project management

- [x] Registration/login/logout and protected routes.
- [x] Current-user endpoint and profile basics.
- [x] Auth tests: registration, login, logout, current user, duplicate email, invalid credentials, validation, disabled accounts, and hashed session tokens.
- [x] Personal workspace and project list. `/app` lists active/archived projects, creates, renames, opens, archives, and restores them.
- [x] Create, rename, open, archive, and restore projects. Hard delete is intentionally not exposed.
- [x] Server-side project authorization. Every project route is owner-scoped; foreign ids return `404`.
- [x] Tests for unauthorized access and ID substitution. Project, editor, and drawing e2e suites cover cross-user access.

**Exit criteria:** a user can create and reopen a project; one user cannot read or modify another user's private project.

**Status:** complete. API tests cover authorization; the browser pass registered a user, created a project, opened it, and entered the editor.

### Phase 3 — Editor foundation

- [x] Build editor page/layout and toolbar. Implemented and browser-verified: floor tabs, setup screen, canvas, toolbar, sidebar, and save state.
- [x] Define a canonical drawing coordinate system independent of viewport zoom. Covered by `editor-geometry.test.ts` and `editor-routes.test.ts`.
- [x] Implement pan, zoom, selection, and canvas resize handling.
- [x] Create a blank plan. Covered by `editor.e2e.spec.ts`.
- [x] Upload JPG/PNG. Covered by `editor.e2e.spec.ts`.
- [x] Upload PDF and choose/render a page (browser-verified).
- [x] Store original file and preview metadata. Covered by `editor.e2e.spec.ts`.
- [x] Toggle, lock, fade, reposition, and replace plan underlay (browser-verified).
- [x] Persist plan/document and reload it after refresh. Covered by editor and drawing e2e tests.
- [x] Show save state and actionable error messages.

**Exit criteria:** both blank-canvas and uploaded-plan workflows open, save, and reload without losing drawing state.

**Status:** the blank-plan workflow is browser-verified; uploaded JPG/PNG/PDF underlay flows are covered at the API level but still need a browser pass.

### Phase 4 — Geometry and electrical objects

- [x] Draw/edit wall segments and room outlines on blank plans (implemented and covered by API + canvas; browser verification pending).
- [x] Add/edit dimensions and labels where needed (implemented and covered by API + canvas; browser verification pending).
- [x] Implement scale calibration using two points and a known distance. Browser-verified: ruler tool, two clicks, dialog, scale saved and survived reload. Backend covered by e2e tests.
- [x] Reject invalid calibration and show when real lengths are unavailable. Server validation is covered by e2e tests; the sidebar shows Calibrated / Not calibrated and route panels show unavailable lengths.
- [x] Add sockets, switches, lights, distribution board, and extensible symbol types. Browser-verified socket placement; the full symbol registry and shortcuts are unit-tested and API CRUD is covered by e2e tests.
- [x] Move, rotate, duplicate, edit, and delete electrical points (with optimistic updates and undo/redo).
- [x] Draw polyline cable routes and edit bend points. Browser-verified: route tool, point snapping, bend insertion at a segment midpoint, selected-bend Delete, and persistence. Drag-to-move-bend and whole-route Delete are implemented and unit-tested; Backspace/Esc/double-click finishing are unit/API-covered.
- [x] Assign cable type (materialId) per route via the materials catalog, plus optional circuit identifier. Circuit id, per-route waste %, and cable type are editable in the route panel.
- [x] Connect route endpoints to points where applicable. Browser-verified: dragging a point moved its attached route end and the change survived reload. The server moves every attached end in the same transaction; covered by a drawing e2e test and `moveAttachedRouteEnds` unit tests. The link is still by coordinate equality, not stored point ids.
- [x] Add undo/redo for editor actions. Client-side history stack for drawing mutations (place/delete point, move/edit point, draw/delete route, edit route/bends, set/remove scale). Toolbar Undo/Redo buttons and Ctrl+Z / Ctrl+Shift+Z / Ctrl+Y; quick repeated shortcuts are queued; point moves and their attached route ends undo as one command. Browser-verified for calibration, point placement, route creation, point move with route ends, bend insert/delete, and point delete.
- [x] Test coordinate conversion and zoom-independent geometry. 46 web tests pass, including screen/world conversion, hit testing, segment handles, route-end movement, and history ordering.

**Exit criteria:** a user can make and save a simple electrical drawing on either a blank plan or uploaded underlay.

### Phase 5 — Calculations

- [x] Implement pure, reusable geometry/calculation functions. (`packages/calculations`; 27 unit tests, user ran `pnpm test` after session 2)
- [x] Calculate polyline segment lengths in the correct coordinate units.
- [x] Add configurable vertical drops/risers (per-point overrides + plan-level defaults in the editor).
- [x] Ensure vertical lengths are not counted twice. (drops only at route ends; `alreadyInGeometry` flag)
- [x] Apply configurable waste percentage (default 10%). (per route via `settings.wastePercent`; project-level setting not yet)
- [x] Show a breakdown of route length, vertical additions, waste, and final quantity.
- [x] Define quantity rounding/purchase-unit behavior (purchaseQuantity rounds up).
- [x] Recalculate when geometry, calibration, cable type, or settings change (server recalculates; editor refetches with debounce).
- [x] Add unit tests for geometry, calibration, rounding, and allowances.

**Required test example:** 24 m plan route + four 1.5 m drops + 10% waste = 33 m.

**Exit criteria:** calculations are deterministic, explainable, and covered by automated tests.

### Phase 6 — Materials, estimates, and exports

- [x] Add a default materials catalog (seeded on API startup; list endpoint).
- [x] Support organization-specific material items/prices (material CRUD + organizationId).
- [x] Build material takeoff from calculated routes (estimate generation from plan calculation).
- [x] Store estimate versions and price snapshots (estimate + items persisted with versioning).
- [x] Support clearly marked manual quantity/price overrides (estimate item PATCH + estimates page).
- [x] Export CSV (endpoint + web download link).
- [x] Export PDF (endpoint + web download link).
- [x] Enforce export permissions and secure file access (access checks on estimates; cookie-authenticated downloads).

**Exit criteria:** a user can create, save, reopen, and export a material specification.

### Phase 7 — Teams, roles, and sharing

- [x] Create organization and organization settings (basic CRUD).
- [x] Add organization memberships and roles (list/add/update/remove).
- [x] Implement secure invitations with expiration, revocation, and single-use acceptance.
- [x] Add project-level sharing (member CRUD + UI + shared read access).
- [x] Enforce permissions in API guards/policies/services (shared access + viewer read-only enforcement for editor/drawing).
- [x] Distinguish platform admin from organization owner/admin (`PLATFORM_ADMIN_EMAILS` + `/admin` endpoints).
- [x] Test role boundaries and cross-organization isolation (viewer + organization e2e tests).
- [x] Add basic activity log (backend endpoint + module).
- [x] Add basic notifications module (list/mark read).

**Exit criteria:** an owner can invite a worker or viewer; each role can perform only authorized actions.

### Phase 8 — Reliability and UX

- [x] Debounced autosave with visible save/error state.
- [x] Revision/version checks to prevent silent overwrites (projects and plans).
- [x] Recovery flow for stale/conflicting document changes (version checks + reload prompt).
- [x] Empty/loading/error states for core pages (implemented across editor/estimates/activity).
- [x] Keyboard and accessibility review (skip link targets, focus-visible styles, reduced motion, canvas labels).
- [x] Tablet layout review (editor switches to sidebar layout at `lg` and stacks below).
- [x] Large-plan performance checks (viewport culling for points/routes/walls/rooms/dimensions + tests).
- [x] Verify PDF/file upload limits and malformed file handling (Multer limits configured).
- [x] Add end-to-end tests for the complete MVP workflow (API-level project→estimate flow).

### Phase 9 — Optional real-time collaboration

- [x] Choose WebSocket transport and authorization model (SSE + cookie auth; ownership checked).
- [x] Broadcast document revisions/operations (SSE endpoint + editor subscription with reload prompt).
- [x] Show active collaborators and basic presence (online count via SSE).
- [x] Handle reconnects and stale revisions (EventSource auto-reconnect + reload prompt + version checks).
- [x] Test simultaneous edits and permission revocation (stale-plan 409 test + revocation test).

Do not start this phase before reliable saving and conflict detection exist.

### Phase 10 — Production readiness

- [x] Review authentication, authorization, upload security, rate limits, and secrets (checklist in DEPLOYMENT.md).
- [x] Configure production database migrations (documented in DEPLOYMENT.md).
- [x] Configure object storage and access policies (storage-driver abstraction, local driver with path-traversal protection; managed driver is an extension point).
- [x] Set up backups and a restore procedure (documented in DEPLOYMENT.md).
- [x] Configure logs, error reporting, and health monitoring (documented in DEPLOYMENT.md).
- [x] Document deployment and rollback (DEPLOYMENT.md).
- [x] Run full regression tests (typecheck, lint, build, and all tests pass).
- [x] Confirm no critical permissions or data-loss bugs remain (IDOR, viewer, revocation, and stale-write tests pass).

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

1. **Browser-verify the remaining editor flows**: JPG/PNG/PDF upload and PDF page rendering, underlay toggle/lock/opacity/position, pan/zoom/resize, point rotate/duplicate/property edits, route bend drag and whole-route delete, and calculation totals.
2. **Walls/rooms and dimensions** (remaining Phase 4 items), then re-check the Phase 4 exit criterion.
3. **Phase 6** after that: materials catalog, cable type per route, material takeoff, estimates, CSV/PDF export.

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

### 2026-10-24 — ports and run guide
- Completed: moved API to port `5004` and web to `3004`; added `WEB_PORT`; made ports configurable through the root `.env`; updated Vite proxy, CORS default, `.env.example`, README; added `RUN.md` with Ukrainian setup, port changes, commands, and troubleshooting; enabled Vite `strictPort`.
- Tests run: `pnpm build`, `pnpm typecheck`, `pnpm lint`, `pnpm test` (13 tests in 5 suites). Runtime smoke test: API `5004` liveness `200`, web `3004` `200`, web proxy `200`, readiness `503` without PostgreSQL.
- Issues/blockers: live PostgreSQL migration/readiness remains unverified.
- Next action: start Phase 2 authentication.

### 2026-10-24 — Phase 2 authentication
- Completed: `sessions` table and migration `0001_glorious_venus.sql`; Argon2id password hashing; server-side cookie sessions with SHA-256 token hashes; `POST /api/v1/auth/register`, `POST /api/v1/auth/login`, `POST /api/v1/auth/logout`, and `GET /api/v1/users/me`; `AuthGuard`; in-memory rate limiting on login/register; shared auth contracts; PGlite auth integration tests; React Router with `/login`, `/register`, and protected `/app`; auth context, forms, login/register pages, and dashboard placeholder; README/RUN/roadmap updates.
- Tests run: `pnpm build`, `pnpm typecheck`, `pnpm lint`, `pnpm test` (28 tests in 8 suites). Runtime smoke: API `5004` health `200`, `/users/me` `401` without a cookie, invalid registration `400` with field messages, rate-limit headers present; web `3004` `/`, `/login`, `/app` returned `200`; Vite proxy reached the API.
- Issues/blockers: live PostgreSQL migration and a full browser register/login flow against PostgreSQL remain unverified. Project-level authorization is not implemented yet. Rate limiting is in-memory and per instance.
- Next action: project CRUD with ownership checks and authorization tests.

### 2026-10-24 — session 2: reconciliation + Phase 5 calculation core
- Reconciliation (static code inspection only, **not executed**): the repository is ahead of sections 1–3 above. `apps/api/src/modules/projects` (controller/service/repository), `apps/api/src/modules/editor` (floors, plans, plan storage), `apps/web/src/features/editor` (canvas, plan setup, PDF page dialog, autosave) and `projects`/`editor` e2e tests exist. Phase 2 project CRUD and Phase 3 editor foundation are therefore *probably* partly or fully implemented, but their checkboxes are left unchanged until `pnpm test` is run against them.
- Completed: new `packages/calculations` (`@drawmyplace/calculations`): `calibrate` (two points + real distance, mm/cm/m, rejects zero/negative/coincident), `polylineLength`, `calculateRoute` (plan length x scale, vertical drops with `alreadyInGeometry` de-duplication, configurable waste, default 10%, explicit `uncalibrated` result), `purchaseQuantity` (round up to step/coil with float-noise guard), `totalByMaterial` (sum before rounding). Dependency-free; lockfile importer entry added by hand.
- Tests run: 23 unit tests in `packages/calculations/src/calculations.test.ts` executed through a throw-away `vitest` shim on `node:test` (all 23 passed), source typechecked with global `tsc` (strict). Includes the required example 24 m + 4 x 1.5 m + 10% = 33 m.
- **Not verified:** real `pnpm install`, `pnpm test` (vitest), `pnpm build`, `pnpm lint` and the hand-edited `pnpm-lock.yaml` — the npm registry is unreachable from this environment (403 from the egress proxy). Run `pnpm install && pnpm test` locally first.
- Not yet wired in: nothing imports `@drawmyplace/calculations` yet; calibration/points/routes are not stored in the database or shown in the editor.
- Next action: run `pnpm install && pnpm test` locally; then Phase 4 — editor-side calibration tool and persistence of calibration/points/routes (contracts + API + canvas), using the new package.

### 2026-10-24 — session 3: Phase 4 backend (drawing API) + server calculation
- Completed: `packages/contracts/src/drawing.ts` (calibration, point, route, drawing and calculation schemas); `packages/calculations/src/drops.ts` (`resolveRouteDrops`: vertical drop only for route ends coinciding with a point, per-point override); new `apps/api/src/modules/drawing` (repository/mapper/service/controller/module): `GET /plans/:id/drawing`, `GET /plans/:id/calculation`, `PUT|DELETE /plans/:id/calibration`, `POST /plans/:id/points`, `PATCH|DELETE /points/:id`, `POST /plans/:id/routes`, `PATCH|DELETE /routes/:id`. Ownership is checked on every call through plan -> floor -> project (not-found for foreign ids); per-floor caps (5000 points, 2000 routes); `EditorModule` now exports `FloorsRepository`/`PlansRepository`; `apps/api` depends on `@drawmyplace/calculations` (lockfile edited by hand). No migration: `calibrations`, `electrical_points`, `cable_routes` already existed.
- Tests written: `packages/calculations` (+4 tests, 27 total), `packages/contracts/src/drawing.test.ts` (10), `apps/api/test/drawing.e2e.spec.ts` (12: auth on all endpoints, calibration set/replace/delete/invalid, point and route CRUD + validation, the 24 m + 6 m drops + 10% = 33 m example end to end, per-route waste, recalibration rescaling, uncalibrated plan, cross-user IDOR).
- Verified in the authoring environment: calculations 27/27 and contracts drawing 10/10 pass through a throw-away vitest shim (contracts under `zod/v4` of zod 3.25, not 4.6); calculations source typechecks (strict).
- **Not verified:** API typecheck/build/lint, the new e2e spec, the hand-edited lockfile, the real vitest runs. Nest/Drizzle code was reviewed by reading only.
- Known limitations: only the project owner has access (sharing/roles are Phase 7); cable type / `materialId` on routes is deferred to the materials catalog (Phase 6); waste percent is per route, no project-level setting yet; route-to-point connection is by coordinate equality (tolerance 1e-6), not by stored point ids; PATCH/DELETE do not use plan `version` conflict checks yet.
- Next action: `pnpm install && pnpm test`, then editor UI for calibration, points and routes.

### 2026-10-24 — session 4: Phase 4 editor UI, part 1 (scale calibration)
- Completed: `editor-geometry.ts` (screen<->world transforms, click-vs-drag, length/scale formatting, calibration preview) and its tests; `calibration-overlay.ts` (draws saved calibration + two-click draft in world coordinates); `calibration-dialog.tsx` (real distance + mm/cm/m, live scale preview, recalibration warning, server errors); `drawing-api.ts` (client for drawing/calibration/calculation endpoints); `editor-canvas.tsx` gained a ruler tool (button, key `C`, Esc to cancel, drag still pans, second click must differ from the first); `plan-editor.tsx` loads the saved calibration, shows a Scale panel (Calibrated / Not calibrated, scale, known distance, remove) and opens the dialog after two picks. Calibration points are stored in world coordinates, independent of zoom and pan; the server stays authoritative for the scale value.
- Verified: `editor-geometry.test.ts` 8/8 through a throw-away vitest shim; all changed `.ts/.tsx` files parse without syntax errors (`ts.transpileModule`).
- **Not verified:** web typecheck, lint, build, the React/canvas behaviour in a browser, and the vitest run of the new web test. React/Vite types are not installed in the authoring environment (npm registry blocked).
- Known limitations: web repeats the unit factors (mm/cm/m) for the dialog preview instead of importing `@drawmyplace/calculations` (web only imports types from workspace packages); calibration is not invalidated automatically when the underlay is rescaled/rotated, the panel only warns; no keyboard-only way to enter calibration points yet.
- Next action: browser verification, then points.

### 2026-10-24 — session 5: Phase 4 editor UI, part 2 (electrical points)
- Completed: `point-symbols.ts` (exhaustive symbol registry: label, shortcut, colour; counts), `point-overlay.ts` (schematic symbols of constant screen size, labels, selection ring, placement ghost), `point-fields.ts` (optional-number parsing with decimal comma), `point-properties-panel.tsx` (fields commit on blur/Enter, Esc reverts), `drawing-api.ts` (`createPoint`, `updatePoint`, `deletePoint`), `editor-geometry.ts` (`niceStep`, `gridStep`, `snapToStep`, `findPointAt`; `niceStep` moved out of the canvas so snapping uses the drawn grid), `editor-canvas.tsx` (place tool, point select/drag, snap toggle, Delete/Esc handling, hit radius in screen pixels), `plan-editor.tsx` (points state loaded from `GET /plans/:id/drawing`, create/move/patch/delete/duplicate with optimistic update and rollback, Points section). Keyboard shortcuts are now ignored while Ctrl/Cmd/Alt is held (previously Ctrl+C switched the tool).
- Tests run: `editor-points.test.ts` (13 tests) and the existing `editor-geometry.test.ts` (8) pass, 21/21, through a throw-away `node:test` shim for vitest. All changed `.ts/.tsx` files parse (`ts.transpileModule`).
- **Not verified:** web typecheck, lint, build, vitest run, and all React/canvas behaviour in a browser (no registry access, so dependencies are not installed). API untouched, so no new API tests.
- Known limitations: no undo/redo, so Delete is immediate; route ends are linked to points only by coordinate equality; point drag position is snapped only when snap is on; the vertical drop has no per-type default shown in the panel (it only says "type default"); no keyboard-only way to place a point except by entering X/Y in the panel after placing one.
- Next action: verify locally, then routes.

### 2026-10-24 — session 6: Phase 4 editor UI, part 3 (cable routes + calculation panel)
- Completed: `route-geometry.ts` (segment distance, route hit test in screen pixels, exact snap to a point, double-click detection), `route-overlay.ts` (routes, handles, draft with rubber band), `commit-field.tsx` (extracted from the point panel), `route-properties-panel.tsx` (circuit id, waste %, calculation breakdown, delete), `calculation-panel.tsx` (route list, total, warnings, action errors), `drawing-api.ts` (`createRoute`, `updateRoute`, `deleteRoute`), canvas route tool and vertex dragging, `plan-editor.tsx` (routes state, optimistic patch with rollback, exclusive point/route selection, debounced calculation refetch after every saved change).
- Tests run: `editor-routes.test.ts` (7), `editor-points.test.ts` (13), `editor-geometry.test.ts` (8): 28/28 through a throw-away `node:test` shim. All `.ts/.tsx` files in the editor folder parse.
- **Not verified:** web typecheck, lint, build, vitest, any browser behaviour. API unchanged.
- Known limitations: see Next actions 2; no cable type; route lengths are not drawn on the canvas, only listed in the sidebar.
- Next action: verify locally, then keep routes attached to points.

### 2026-10-25 — session 7: full verification + attached routes + bend editing
- Completed: fixed the web typecheck failure from pdf.js v6 (`PDFDocumentProxy.destroy` moved to the loading task; both PDF helpers now destroy the task). Verified the whole workspace locally: typecheck, lint, build, and all tests pass.
- Route ends now stay attached: the server moves every route end that coincides with a moved point (tolerance `1e-6`) in the same database transaction as the point update; the editor mirrors that move optimistically and rolls it back if the point save fails. Routes visually follow a point while it is being dragged. Covered by a new drawing e2e test (both ends, drop IDs and vertical length) and three `moveAttachedRouteEnds` unit tests.
- Bend editing on saved routes: selecting a route shows hollow midpoint handles; clicking one inserts a bend at the segment midpoint. Clicking a square bend handle selects it; Delete removes just that bend (a route keeps at least two vertices), while Delete with no bend selected still removes the whole route. Overlay highlights the selected bend and the route panel/hint text explains the interactions.
- Tests run: `pnpm typecheck`, `pnpm lint`, `pnpm build`, `pnpm test` — 136 tests in 18 test files (api 41, web 39, contracts 27, calculations 27, database 2), all passing.
- Issues/blockers: no browser pass yet. Route-to-point links are still coordinate-based, not stored point ids. Undo/redo is not implemented. A live PostgreSQL migration is still unverified; PGlite applies the migrations in tests.
- Next action: browser verification, then undo/redo, then Phase 6 materials/cable type/takeoff.

### 2026-10-25 — session 8: editor wiring, browser verification, live PostgreSQL
- Completed: wired the previously orphaned editor UI into the app. New `/app/projects/:projectId/editor` page loads the project and floors, creates floors, starts a blank plan or uploads a JPG/PNG/PDF, switches floors, and renders `PlanEditor`; the project page now links to it. Started PostgreSQL in Docker, created `.env` from `.env.example`, and applied both migrations with `pnpm db:migrate`; liveness and readiness (`database: up`) return `200`.
- Browser pass (Playwright + installed Chrome, headless): register → create project → open project → open editor → create floor → create blank plan → calibrate 5 m with the ruler tool → place two sockets → draw a route between them with point snapping → drag an attached point (route end followed) → insert a bend at the segment midpoint → delete the selected bend → reload and verify calibration, 2 points, 1 route, 2 vertices, and “All changes saved”. No console or page errors.
- Tests run: `pnpm typecheck`, `pnpm lint`, `pnpm build`, `pnpm test` — 136 tests in 18 files (api 41, web 39, contracts 27, calculations 27, database 2), all passing. `pnpm db:migrate` succeeded against live PostgreSQL; `/api/v1/health` and `/api/v1/health/ready` returned `200`.
- Issues/blockers: none for the verified flow. Remaining browser gaps: JPG/PNG/PDF upload and PDF page rendering, underlay controls, pan/zoom/resize, point rotate/duplicate/property edits, route bend drag and whole-route delete, and calculation totals. Walls/rooms, dimensions, and undo/redo are not implemented. Route-point links remain coordinate-based.
- Next action: undo/redo, then the remaining browser flows, then walls/rooms/dimensions and Phase 6.

### 2026-10-25 — session 9: editor undo/redo
- Completed: `editor-history.ts` (pure past/future stack with a 50-entry cap and 7 unit tests) and undo/redo integration in `plan-editor.tsx`. Every drawing mutation now records an inverse command: place/delete point, move/edit point, draw/delete route, edit route/bends, set/remove scale. Undo/redo reloads the drawing from the API, so point moves and the attached route ends stay consistent as one action. Added toolbar Undo/Redo buttons with disabled states, Ctrl+Z / Ctrl+Shift+Z / Ctrl+Y shortcuts, queued repeated shortcuts, a last-action label, and an error message in the Save state card. Selected bends are cleared when the route geometry no longer contains them.
- Browser pass (Playwright + installed Chrome, headless): the full previous flow plus undo/redo for scale calibration, point placement, route creation, point move with route-end follow, bend insertion, bend deletion, and point deletion. Reload still shows 2 points, 1 route with 2 vertices, calibration, and “All changes saved”. No console or page errors.
- Tests run: `pnpm typecheck`, `pnpm lint`, `pnpm build`, `pnpm test` — 143 tests in 19 test files (api 41, web 46, contracts 27, calculations 27, database 2), all passing.
- Issues/blockers: none for the verified flow. Undo history is session-local and is lost on reload; underlay/viewport changes are not in the history. Walls/rooms and dimensions are implemented in code (API + canvas) but still need a browser pass. Remaining browser gaps are unchanged from session 8.

### 2026-10-25 — session 11: estimates, organizations, sharing, reliability, realtime
- Completed: dedicated estimates page with manual overrides and draft/final status; organizations module (CRUD + members); invitations (create/list/revoke/accept with hashed tokens); project sharing (member CRUD, shared project list, viewer read-only enforcement); notifications module and page with unread badge; activity log module/page and recording on project/estimate actions; platform admin guard/endpoints; user profile update and user search by email; project/plan revision conflict checks; plan-level vertical drop defaults (migration `0004`); viewport culling for large plans; SSE plan updates with collaborator presence and reload prompt; deployment/operations documentation.
- Tests run: `pnpm typecheck`, `pnpm lint`, `pnpm build`, `pnpm test` — all passing. Added organization, MVP workflow, viewer role, access revocation, and stale-plan conflict e2e tests.
- Browser pass (Playwright + installed Chromium): registered, created a project/floor, uploaded a PNG underlay, toggled visibility, locked it, changed opacity, reloaded, replaced the file with a PDF, chose the page, rendered the preview, and reloaded again. No blocking page errors.
- Fixed a real upload bug found by the browser pass: `apiRequest` forced `Content-Type: application/json` onto `FormData`, breaking PNG/PDF uploads.
- Issues/blockers: none for the verified flows.
- Next action: optional managed object-storage driver.

### 2026-10-25 — session 10: cable type per route + estimate UI
- Completed: added `materialId` to route contracts (create/update/public) and backend drawing repository/mapper; estimate generation now uses each route's assigned cable (falling back to the default cable) and stores material price snapshots; added web materials API client; route properties panel gained a cable-type dropdown; editor sidebar gained an Estimate section that generates a takeoff and offers CSV/PDF download links. Updated roadmap checkboxes for walls/rooms/dimensions and Phase 6 items.
- Tests run: `pnpm typecheck`, `pnpm lint`, `pnpm build`, `pnpm test` — 143 tests in 19 test files, all passing.
- Issues/blockers: estimate download links rely on cookie auth (works in browser); no web route for a dedicated estimates page yet; cable type default selection is "Default cable" until a material is chosen. Browser verification of the new UI pending.
- Next action: browser-verify the cable-type dropdown and estimate generation/export, then a dedicated estimates page and manual overrides.

