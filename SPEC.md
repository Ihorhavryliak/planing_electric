# DrawMyPlace — Project Specification for Claude Code

> **Purpose:** This document is the primary product and architecture specification for building DrawMyPlace, a browser-based electrical installation planning tool inspired by the workflow of DrawMyPlace.
>
> **Status:** MVP in active development.
>
> **Rule for Claude Code:** Before implementing a feature, inspect the existing repository and this document. Preserve existing conventions where possible. Do not replace working code or introduce a new library/framework without a clear reason. If implementation details conflict with this specification, explain the conflict and propose a minimal resolution before making a broad architectural change.

## 1. Product vision

DrawMyPlace helps electricians, interior designers, contractors, and home renovators create or import a room/floor plan, place electrical symbols, draw cable routes, calculate material quantities, and export a bill of materials/estimate.

The product must support:
- Personal accounts and personal projects.
- Organizations/teams with members and role-based permissions.
- Projects shared with selected users.
- A plan editor with both **blank-canvas creation** and **uploaded-plan underlay** workflows.
- Persistent saving, version/conflict handling, and an activity history.
- Automatic cable-length calculations and configurable allowances.
- CSV and PDF exports.

The MVP should prioritize a reliable end-to-end workflow over advanced collaboration features.

## 2. MVP acceptance criteria

A release is not considered MVP-complete until the following can be demonstrated:

1. Register, sign in, sign out, and access a protected workspace.
2. Create a personal project and, optionally, a project inside an organization.
3. Start a floor plan from a blank canvas OR upload JPG, PNG, or PDF.
4. For uploaded plans, select two points and enter the real-world distance to calibrate scale.
5. Pan and zoom the canvas; select, move, rotate, duplicate, and delete supported objects.
6. Add electrical points: sockets/outlets, switches, lights, electrical panel, and extensible custom types.
7. Draw polyline cable routes, connect route endpoints to electrical points when applicable, and assign cable type.
8. Calculate route length from calibrated geometry, include configurable vertical drops/risers, and apply a configurable waste allowance (default 10%).
9. Display a material takeoff and optional cost estimate with editable catalog prices.
10. Export a material specification to CSV and PDF.
11. Save the project and reopen it with geometry, settings, plan, routes, and points intact.
12. Invite a teammate, assign a role, and enforce permissions on the API.
13. Prevent unauthorized access to other users' projects by guessing or changing IDs.
14. Validate critical flows with automated tests.

## 3. Technology and repository architecture

### Required stack
- Frontend: React + TypeScript, Tailwind CSS, shadcn/ui.
- Backend: NestJS + TypeScript.
- Validation/contracts: Zod.
- Database: PostgreSQL + Drizzle ORM.
- Development/testing database: PGlite where compatible; run integration checks against PostgreSQL for database-specific behavior.
- Monorepo: pnpm workspaces + Turborepo.
- File storage: object storage abstraction for uploaded plans and generated exports; local storage adapter is acceptable for development.

### Suggested repository layout

```text
drawmyplace/
├── apps/
│   ├── web/
│   │   └── src/
│   │       ├── app/
│   │       ├── components/
│   │       │   ├── ui/
│   │       │   ├── layout/
│   │       │   └── shared/
│   │       ├── modules/
│   │       │   ├── auth/
│   │       │   ├── dashboard/
│   │       │   ├── organizations/
│   │       │   ├── projects/
│   │       │   ├── editor/
│   │       │   ├── materials/
│   │       │   ├── estimates/
│   │       │   ├── team/
│   │       │   └── settings/
│   │       ├── hooks/
│   │       ├── lib/
│   │       └── main.tsx
│   └── api/
│       └── src/
│           ├── main.ts
│           ├── app.module.ts
│           ├── common/
│           │   ├── decorators/
│           │   ├── guards/
│           │   ├── filters/
│           │   ├── interceptors/
│           │   └── pipes/
│           ├── database/
│           └── modules/
│               ├── auth/
│               ├── users/
│               ├── organizations/
│               ├── memberships/
│               ├── invitations/
│               ├── projects/
│               ├── floors/
│               ├── plans/
│               ├── calibration/
│               ├── electrical-points/
│               ├── cable-routes/
│               ├── calculations/
│               ├── materials/
│               ├── estimates/
│               ├── exports/
│               ├── project-sharing/
│               ├── activity-log/
│               ├── notifications/
│               └── admin/
├── packages/
│   ├── contracts/
│   ├── database/
│   ├── permissions/
│   ├── calculations/
│   ├── editor-core/
│   ├── config/
│   └── utils/
├── tests/
│   ├── integration/
│   └── e2e/
├── infra/
├── pnpm-workspace.yaml
├── turbo.json
├── package.json
└── .env.example
```

Adapt the layout to the existing repository if it already has a coherent structure.

### Backend module conventions

Each business module should follow this pattern when appropriate:

```text
modules/projects/
├── projects.module.ts
├── projects.controller.ts
├── projects.service.ts
├── projects.repository.ts
├── projects.policy.ts
├── projects.schemas.ts
├── projects.types.ts
└── dto/
```

Responsibilities:
- **Controller:** HTTP routes, request parsing, response status.
- **Service:** business rules and orchestration.
- **Repository:** database access through Drizzle.
- **Database schema/model:** Drizzle table definitions in `packages/database`.
- **Zod schemas/contracts:** validate inputs and define shared API contracts.
- **Policy:** resource-specific authorization.
- **DTO:** typed request/response shapes where useful.

Do not create empty modules solely to match the tree. Add modules as their functionality is implemented. Avoid duplicating business logic in controllers or React components.

## 4. Main product areas and modules

- `auth`: registration, login/logout, sessions/tokens, password reset.
- `users`: user profile, preferences, account status.
- `organizations`: companies, crews, organization settings.
- `memberships`: organization membership and roles.
- `invitations`: secure invitations with expiration and one-time acceptance.
- `projects`: project CRUD, ownership, status, archive.
- `floors`: floors/levels and plan canvases inside projects.
- `plans`: source image/PDF metadata, upload, versions, page selection.
- `calibration`: scale calibration and measurement settings.
- `electrical-points`: sockets, switches, lights, panels, custom symbols.
- `cable-routes`: route polylines, segments, endpoints, cable assignment.
- `calculations`: pure calculation functions and calculation results.
- `materials`: material catalog, units, cable types, optional organization-specific prices.
- `estimates`: bill of materials, pricing snapshots, estimate versions.
- `exports`: CSV/PDF generation.
- `project-sharing`: project-specific access grants.
- `activity-log`: security-relevant and project change history.
- `notifications`: invitations and collaboration events.
- `admin`: platform-level administration, separate from organization administration.

## 5. Editor: user experience and workflows

The editor is the core product. It must support two ways to start a drawing:

1. **Create a blank plan** — the user starts with an empty canvas and creates the layout manually.
2. **Use an existing plan** — the user uploads a JPG, PNG, or PDF and draws electrical objects/routes over it.

These workflows must lead to the same internal drawing model so that all editor tools and calculations work in both modes.

### 5.1 Step 1 — Create a plan or upload an existing one

When the user clicks **New project** or **New plan**, show two clear choices:

#### Option A: Blank canvas
- Ask for project name and floor/plan name.
- Create an empty drawing with a configurable canvas/grid.
- Allow the user to draw room outlines/walls and add dimensions.
- Let the user set units and define a known measurement or calibrate scale after drawing a reference length.
- Provide grid visibility, snap-to-grid, and snapping to endpoints/intersections as editor settings.
- Blank canvas must work without an uploaded image.

#### Option B: Upload a plan
- Accept JPG, PNG, and PDF.
- Validate file type and size on both client and server.
- For PDF, allow page selection if the PDF has multiple pages, then render the chosen page as an editor underlay.
- Preserve the original file in storage; store metadata and a reference to the rendered preview.
- Show progress, success, and actionable error states.
- Let the user reposition, scale, rotate if appropriate, fade, lock, hide, or replace the underlay.
- Do not treat the underlay as editable vector geometry.
- After upload, prompt the user to calibrate scale.

#### Shared behavior
- Save project/plan metadata before or during editing so a refresh does not lose the work.
- The drawing must be editable before calibration, but real-world lengths should be marked unavailable until a valid scale exists.
- The user can later switch the underlay on/off without deleting overlay objects.
- Support multiple floors/plans per project.

### 5.2 Step 2 — Calibrate scale

- User selects two points on the plan/canvas.
- User enters the real distance and unit (default meters).
- Calculate `metersPerPixel = realDistance / pixelDistance` in the image/canvas coordinate system.
- Reject zero/negative distances and coincident points.
- Allow recalibration; show a warning that recalibration changes calculated lengths.
- Store calibration points, real distance, unit, and resulting scale.
- For a blank plan, allow scale to be set from a known drawn dimension or by calibration.
- Keep the coordinate model independent of viewport zoom and screen size.

### 5.3 Step 3 — Draw the room layout (blank plan workflow)

For a blank canvas, support:
- Draw wall segments and connected polylines.
- Create/edit room outlines.
- Set or edit wall lengths using numeric input.
- Optional grid and snap-to-grid.
- Select, move, rotate where relevant, duplicate, and delete geometry.
- Edit object properties in a side panel.
- Undo/redo for drawing operations.

Do not require automatic architectural CAD recognition in MVP. Manual geometry is enough. Make the data model extensible for doors, windows, room labels, and dimensions later.

### 5.4 Step 4 — Place electrical points

Minimum point types:
- Socket/outlet.
- Switch.
- Light/luminaire.
- Electrical panel/distribution board.
- Generic junction box or custom point type.

Requirements:
- Place by clicking the canvas or by choosing a point and entering coordinates.
- Move, rotate, duplicate, edit, and delete points.
- Configure symbol label/identifier, mounting height, and optional properties.
- Snap points to walls/grid where enabled.
- Use a symbol registry so new point types can be added without rewriting the editor.
- Store coordinates in drawing/world units, not CSS pixels.
- Point-specific vertical cable drop/rise should be configurable, with defaults (example: socket 1.5 m, light 2.5 m) treated as editable project settings rather than universal truths.

### 5.5 Step 5 — Draw cable routes

- Provide a route tool that creates a polyline with one or more segments.
- Click to add bend points; double-click or use a clear finish action to complete.
- Support cancel, undo last point, select, move bend points, insert/remove bend points, and delete route.
- Allow a route to be associated with a cable/material type and optional circuit identifier.
- Allow route endpoints to connect to electrical points, but do not require every intermediate bend to be an electrical point.
- Show length labels when scale is calibrated.
- Distinguish route geometry from vertical drops/risers and other allowances.
- Prevent duplicate counting when a vertical segment is already part of the route geometry.
- Keep route calculation independent of rendering code.

### 5.6 Step 6 — Calculate cable and materials

For each route:
1. Calculate each segment's Euclidean length in world units.
2. Sum horizontal/in-plan segments.
3. Add vertical drops/risers that are configured but not already represented in the route.
4. Apply the configured waste percentage.
5. Round purchase quantities according to material rules (for example, whole meters or standard cable coil lengths); show both calculated and purchase quantities where useful.

Base formula:

`routeLength = sum(segmentLengths) * metersPerPixel`

If segment coordinates are already in world units, do not multiply by `metersPerPixel` again.

`requiredLength = (planLength + additionalVerticalLength) * (1 + wastePercent / 100)`

Example: 24 m of plan route + four 1.5 m drops, with 10% allowance:
`(24 + 4 * 1.5) * 1.10 = 33 m`

Rules:
- Default waste allowance: 10%, configurable by project and optionally by cable type.
- Defaults for vertical drops are editable and must be visible to the user.
- Recalculate after geometry, calibration, point settings, cable type, or calculation settings change.
- Display assumptions and a calculation breakdown; do not present estimates as exact if inputs are incomplete.
- Avoid double counting route segments, vertical drops, and shared cable sections.
- Unit-test geometry, calibration, rounding, and allowances.

### 5.7 Step 7 — Materials catalog and estimate

- Provide a default material catalog for cables and common installation materials.
- Allow organization-specific catalog items and prices.
- Estimate rows include material, unit, calculated quantity, purchase quantity, unit price, subtotal, and notes.
- Snapshot unit prices into each estimate version so later catalog price changes do not silently change a saved estimate.
- Let users adjust price/quantity overrides with a clear distinction between calculated and manually overridden values.
- Mark estimates as draft/final where useful.

### 5.8 Step 8 — Export

- CSV export for spreadsheet use.
- PDF export with project name, plan/floor, export date, estimate version, material lines, quantities, units, prices (if enabled), totals, and calculation assumptions.
- Export must respect permissions.
- Generated files should be stored or delivered through short-lived secure links.
- MVP export may provide a material specification without a full visual drawing print; drawing print/export can be added separately.

### 5.9 Step 9 — Save, reopen, and version changes

- Save project metadata, plans, calibration, room geometry, points, routes, calculation settings, and estimate versions.
- Use debounced autosave plus explicit saved/saving/error state.
- Use a document `version` or revision field to prevent silent overwrite by concurrent editors.
- If the server detects a stale revision, return a conflict response and ask the client to reload/merge rather than overwriting newer data.
- Implement undo/redo in the client for editing sessions; persisted revision history is a separate feature.
- Maintain an activity log for important project actions.

### 5.10 Editor layout

Recommended desktop layout:
- **Top bar:** project/floor name, save state, undo/redo, zoom, share, export.
- **Left toolbar:** select, pan, wall/room, electrical point, cable route, dimension, calibration.
- **Center:** canvas with grid and optional plan underlay.
- **Right properties panel:** selected object properties, coordinates, height, cable type, labels.
- **Bottom or collapsible panel:** calculation results, warnings, materials summary.

Keyboard shortcuts should be discoverable and must not interfere with text inputs. Provide accessible controls and a usable tablet layout where practical.

## 6. Drawing data model and coordinate system

Keep drawing data independent from React component state and canvas rendering.

Recommended concepts:
- `PlanDocument`: document metadata, coordinate units, calibration, drawing revision, canvas settings.
- `PlanUnderlay`: original file reference, preview reference, page, opacity, transform, visibility, locked state.
- `Wall`: polyline/segments and optional dimensions.
- `Room`: boundary references, name, optional area.
- `ElectricalPoint`: type, world coordinates, rotation, properties.
- `CableRoute`: polyline, cable type, circuit ID, endpoints, calculation options.
- `Calibration`: two drawing-space points, known real distance, unit, scale.
- `CalculationSettings`: waste percent and default/additional vertical lengths.

Use a consistent coordinate system with positive X to the right and positive Y downward or upward, documented once and used consistently. Prefer a canonical world/drawing coordinate system; viewport pan and zoom must never alter stored geometry. If the implementation stores raw image pixel coordinates for imported plans, define a reliable conversion to world units and test it.

## 7. Accounts, workspaces, roles, and sharing

### Account/workspace model
- A user can own personal projects and belong to multiple organizations.
- An organization contains members and organization-level settings.
- A project can be personal (`organization_id` nullable) or organization-owned.
- A project may have explicit project-level members/permissions.
- Organization membership does not automatically grant access to every personal project.
- Organization administrators should not have platform-wide administrator powers.

### Initial roles
- `owner`: full control over the organization/project within the applicable scope.
- `admin`: manage organization members/settings according to policy.
- `manager`: manage assigned projects and project collaborators if granted.
- `electrician` / `editor`: view and edit assigned drawings.
- `viewer`: read-only access.

### Example permissions
- `project.view`
- `project.edit`
- `project.manage_members`
- `project.export`
- `project.archive`
- `project.delete`
- `plan.edit`
- `points.edit`
- `routes.edit`
- `materials.view`
- `materials.edit`
- `estimate.view`
- `estimate.edit`
- `estimate.export`
- `organization.manage_members`
- `organization.manage_settings`

Always enforce access in the backend. Hiding a frontend button is not authorization. Every resource endpoint must verify user identity, resource membership, and required action. Avoid insecure direct object references (IDOR).

Invitation tokens must be random, stored hashed where practical, expire, and be single-use. Revocation must invalidate outstanding access where appropriate.

## 8. Suggested database entities

Use Drizzle schema definitions and migrations. Exact naming can follow existing project conventions.

- `users`: id, email, password hash/identity provider, name, status, timestamps.
- `organizations`: id, name, owner id, settings, timestamps.
- `organization_members`: organization id, user id, role, status, timestamps.
- `invitations`: organization id, email, role, token hash, expiry, accepted/revoked timestamps.
- `projects`: id, organization id nullable, created_by, name, description, status, revision, timestamps.
- `project_members`: project id, user id, role/permission set, timestamps.
- `floors`: id, project id, name, sort order.
- `plans`: id, floor id, source type (`blank`/`upload`), file key, mime type, page, preview key, version.
- `calibrations`: plan/floor id, point A, point B, known distance, unit, meters-per-pixel.
- `plan_objects` or typed tables: walls, rooms, dimensions, and other geometry as appropriate.
- `electrical_points`: id, floor id, type, x, y, rotation, properties.
- `cable_routes`: id, floor id, cable type id, circuit id, geometry, settings.
- `materials`: id, organization id nullable, code, name, unit, category, price, currency, active.
- `estimates`: id, project id, version, status, created_by, calculation settings snapshot, timestamps.
- `estimate_items`: estimate id, material reference, description snapshot, quantity, unit, unit-price snapshot, subtotal.
- `activity_logs`: id, project id, actor id, action, resource type/id, metadata, timestamp.
- `notifications`: recipient, type, payload, read timestamp.

Choose JSON/JSONB for flexible symbol properties or document payloads only when it is useful; keep fields needed for filtering, constraints, and relationships relational. Add foreign keys, indexes, uniqueness constraints, and deletion policies. Consider soft-delete/archive for projects instead of immediate destructive deletion.

## 9. API conventions

Use a versioned prefix such as `/api/v1`. Keep endpoint names consistent with the existing repository.

Examples:
- `POST /auth/register`
- `POST /auth/login`
- `GET /users/me`
- `POST /organizations`
- `GET /organizations/:id/members`
- `POST /organizations/:id/invitations`
- `GET /projects`
- `POST /projects`
- `GET /projects/:id`
- `PATCH /projects/:id`
- `POST /projects/:id/members`
- `POST /floors/:id/plans`
- `PUT /floors/:id/calibration`
- `POST /floors/:id/electrical-points`
- `POST /floors/:id/cable-routes`
- `POST /projects/:id/calculations`
- `GET /projects/:id/estimates`
- `POST /projects/:id/exports`

Use consistent error responses, request validation, pagination, and authorization. Do not trust client-supplied quantities or prices as authoritative without server validation. Where calculations must be auditable, the server should recalculate or verify submitted results.

## 10. Frontend routes

Public:
- `/`
- `/pricing`
- `/login`
- `/register`
- `/invite/:token`

Application:
- `/app/dashboard`
- `/app/projects`
- `/app/projects/:projectId`
- `/app/projects/:projectId/editor`
- `/app/projects/:projectId/estimates`
- `/app/projects/:projectId/activity`
- `/app/team`
- `/app/materials`
- `/app/estimates`
- `/app/settings`

Platform administration:
- `/admin/users`
- `/admin/organizations`

Use route guards for user experience, but always perform real authorization in the API.

## 11. Security, reliability, and quality

- Hash passwords with a suitable password-hashing algorithm; never store plaintext passwords.
- Use secure session/cookie or token practices appropriate to the chosen authentication implementation.
- Rate-limit login, password reset, and invitation endpoints.
- Validate file content/type and size on the server; do not rely on file extension alone.
- Use short-lived signed URLs for private files.
- Check access to every project, plan, export, and organization resource.
- Keep secrets in environment variables; provide `.env.example` without real credentials.
- Record security-relevant actions without logging secrets or sensitive tokens.
- Use database transactions for related writes.
- Test permission boundaries and cross-organization isolation.
- Keep calculation functions deterministic and unit-tested.
- Add accessible labels, keyboard focus, empty states, loading states, and error states.
- Avoid premature microservices. Start with a modular monolith.

## 12. Implementation sequence

### Phase 1 — Foundation
- Inspect the repository and document existing conventions.
- Set up or validate workspace/build/test commands.
- Establish database schema and migrations.
- Implement authentication, users, project CRUD, and access policies.

### Phase 2 — Basic editor
- Build the editor shell and drawing coordinate model.
- Implement blank canvas and plan underlay upload.
- Add pan/zoom, selection, and calibration.
- Persist/reload the document.

### Phase 3 — Electrical drawing
- Add wall/room geometry for blank plans.
- Add electrical symbols and editable properties.
- Add polyline cable routes and cable type assignment.
- Add undo/redo and safe autosave.

### Phase 4 — Calculation and export
- Implement and test length calculation.
- Add vertical drops, waste allowance, material catalog, and estimate.
- Add CSV/PDF exports.

### Phase 5 — Team collaboration
- Add organizations, memberships, invitations, roles, and project sharing.
- Add activity history and revision conflict handling.
- Add real-time updates only after the basic collaboration model is reliable.

### Phase 6 — Hardening
- Add end-to-end tests for core flows.
- Test unauthorized access and concurrent updates.
- Verify migrations against PostgreSQL.
- Add operational logging, backup guidance, and deployment documentation.

## 13. Definition of done for each feature

A feature is complete only when:
- The UI has loading, success, empty, and error states where relevant.
- Input is validated on the server.
- Permissions are enforced by the API.
- Data persists and reloads correctly.
- Relevant tests pass.
- Existing functionality has not regressed.
- Documentation or environment examples are updated if necessary.

## 14. Instructions for Claude Code

Before making changes:
1. Inspect the repository structure, `package.json` files, current database schema, migrations, and existing tests.
2. Identify which parts of this specification are already implemented.
3. Provide a short implementation plan for the requested task.
4. Make small, cohesive changes; do not rewrite the whole app without explicit instruction.
5. Run the relevant lint, typecheck, unit, integration, and build commands available in the repository.
6. Report files changed, commands run, test results, and any remaining limitations.
7. Never claim tests passed unless they were actually run and passed.
8. If a requirement is ambiguous or could cause data loss, stop and ask before performing destructive changes.

This document defines product intent and architecture, not permission to ignore the actual repository state. Prefer incremental, testable implementation.
