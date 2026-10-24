# Claude Code Instructions

## 1. Project Documentation

Before making any changes, read:

- `SPEC.md` — primary product and architecture specification.
- `ROADMAP.md` — implementation phases, task priorities, and current project status.

Treat `SPEC.md` as the source of truth for product requirements and architecture. Treat `ROADMAP.md` as the working progress tracker.

If documentation conflicts with the existing implementation, inspect the code, explain the discrepancy, and propose a solution before making significant architectural changes.

## 2. Mandatory Workflow

Before implementing any task:

1. Inspect the existing repository, folder structure, dependencies, and relevant code.
2. Identify what is implemented, partially implemented, missing, or broken.
3. Compare the current implementation against `SPEC.md` and `ROADMAP.md`.
4. Present a short implementation plan with the files and modules likely to change.
5. Implement incrementally, preserving working functionality and avoiding unnecessary rewrites.
6. Run relevant tests, type checks, lint, and build commands where available.
7. Fix regressions introduced by your changes.
8. Report changed files, verified results, remaining issues, and the next recommended task.
9. Update `ROADMAP.md` after completing or verifying work. Never mark tasks complete without evidence.

For a simple, low-risk task, keep the plan concise. Do not perform a large rewrite without explaining why it is necessary.

## 3. Technology Stack

Follow the specified stack:

- Frontend: React, TypeScript, Tailwind CSS, shadcn/ui.
- Backend: NestJS, TypeScript.
- Validation and shared contracts: Zod.
- Database: PostgreSQL.
- ORM and migrations: Drizzle ORM.
- Monorepo: pnpm workspaces and Turborepo.
- Development and tests: PGlite where appropriate.

Before adding a dependency, check whether the existing stack already provides the required functionality. Avoid unnecessary dependencies and duplicate implementations.

Do not replace the specified technologies without explaining the reason and obtaining approval.

## 4. Architecture and Code Quality

- Follow the Controller → Service → Model/data-access separation described in `SPEC.md`.
- Controllers handle HTTP requests and responses; services contain business logic; database access belongs in the appropriate data-access layer.
- Keep modules focused, reusable, and independently testable.
- Reuse shared Zod schemas and types where appropriate.
- Validate all untrusted input on the server.
- Avoid `any`, duplicated business logic, oversized components, and unnecessary abstractions.
- Follow the repository's existing naming conventions and coding style.
- Keep secrets and credentials out of source code. Use environment variables and maintain an appropriate `.env.example`.
- Do not introduce breaking API or database changes without identifying their impact.

## 5. Database and Data Integrity

- Use Drizzle ORM and tracked database migrations.
- Do not modify production data or run destructive database commands without explicit approval.
- Never silently drop tables, columns, or existing data.
- Consider foreign keys, indexes, unique constraints, transactions, and deletion behavior where appropriate.
- Ensure project data is isolated between users and organizations.
- Test important database operations and migration behavior.
- Do not assume that a schema change is applied merely because the schema file was modified.

## 6. Authentication, Authorization, and Security

- Enforce authentication and authorization on the backend.
- Never treat hidden buttons, disabled UI elements, or frontend route guards as sufficient access control.
- Verify permissions for every protected project, drawing, file, export, and collaboration operation.
- Prevent insecure direct object reference (IDOR) vulnerabilities.
- Validate file types, file sizes, and upload handling on the server.
- Do not expose sensitive information, secrets, or unauthorized project data in API responses or logs.
- Follow the roles and permissions defined in `SPEC.md`.

## 7. DrawMyPlace Editor Requirements

The editor must support both workflows:

1. Create a new plan from a blank canvas.
2. Upload an existing floor plan as JPG, PNG, or PDF, subject to the supported rendering workflow.

Preserve and implement the editor workflow defined in `SPEC.md`, including:

- Plan creation and editing.
- Scale calibration using two selected points and a known real-world distance.
- Drawing and editing walls, rooms, and geometry where specified.
- Adding, moving, and editing sockets, switches, lights, electrical panels, and other supported objects.
- Drawing cable routes as editable polylines.
- Calculating horizontal route lengths, configured vertical drops, and the specified waste allowance.
- Generating a material specification and supported exports.
- Saving, reopening, and updating projects without losing data.

Keep drawing coordinates, zoom, pan, scale, and object positions consistent. Do not mix screen pixels with real-world measurements without an explicit coordinate transformation.

Test important editor operations after changes. Do not replace working editor functionality with static mockups or placeholder controls while claiming the feature is implemented.

## 8. Testing and Verification

Use the testing tools and commands already configured in the repository.

Where relevant, verify:

- Unit tests for business logic and calculations.
- API and integration tests.
- Authentication and authorization boundaries.
- Database operations and migrations.
- Frontend rendering and user interactions.
- Type checking, lint, and production builds.
- End-to-end workflows for critical features.

For electrical route calculations, test known dimensions, scale conversion, vertical drops, waste allowance, rounding, and edge cases.

If a command cannot run, report the exact reason. Clearly distinguish passed, failed, skipped, and unverified checks.

Never claim a test, build, feature, or security property has passed unless it has actually been verified.

## 9. Roadmap and Task Priorities

Use `ROADMAP.md` to determine the next task.

- Prioritize incomplete foundational tasks before dependent features.
- Prefer small, verifiable milestones over large batches of unrelated changes.
- Avoid implementing future-phase functionality prematurely unless it is required by the current task.
- After each task, update the status, verification notes, blockers, and next steps in `ROADMAP.md`.
- If the roadmap no longer matches the repository, reconcile it with the actual implementation and explain the changes.
- Keep completed, partially completed, blocked, and not-started tasks clearly separated.

Do not assume that previously documented progress reflects the current codebase. Verify it.

## 10. Communication and Completion Report

Before implementation, briefly state:

- What already exists.
- What is missing or broken.
- What you plan to change.

After implementation, report:

1. **Implemented** — what actually changed.
2. **Files changed** — the main files and their purpose.
3. **Verification** — commands executed and their actual results.
4. **Remaining issues** — failures, limitations, and unverified behavior.
5. **Roadmap** — updated task status.
6. **Next step** — the single most useful next task.

Be concise, technically accurate, and explicit about uncertainty.

## Core Rule

Inspect first. Plan second. Implement incrementally. Verify with evidence. Update the documentation. Never invent functionality or progress.