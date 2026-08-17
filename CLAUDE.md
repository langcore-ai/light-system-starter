# Light System Coding Guide

## Product model

Build a standalone React application that runs entirely in the browser. Do not create app-owned server routes, Durable Objects, Node/Bun services, SQLite files, or calls to the Neo Noumi main API. Choose among the platform-injected `window.NoumiBridge.localStorage`, `appStorage`, `workspaceFiles`, `db`, and `outsideDb` according to the data boundary below. None exposes credentials, provider handles, or main-site authority.

## Required workflow

1. Choose the persistence boundary first. Read `noumi.db.json` and all existing migrations before changing platform SQLite data; external PostgreSQL has no Light System migration and requires only an approved connection slug.
2. Implement the requested UI and browser behavior under `src/client/`.
3. For schema changes, add a new forward migration and run `bun run db:schema:write`; never edit an applied migration.
4. Run `bun run db:validate`, `bun run typecheck`, and `bun run build`.
5. Commit source changes only. `dist/` and SQLite files must not be committed.
6. Call `light_systems_artifacts_sync`.
7. Call `light_systems_deploy_static` with the exact returned commit SHA.

## Browser constraints

- The document runs in an opaque-origin iframe: scripts work, but native `localStorage`, `sessionStorage`, IndexedDB, cookies, Service Workers, and main-site ambient authority are unavailable.
- The platform initializes `window.NoumiBridge` before the business bundle runs. Use its read-only `app`, `createByMember`, and `currentMember` context instead of inventing identity state.
- Use the asynchronous `window.NoumiBridge.localStorage` API for small browser-local state. It is partitioned by Light System ID, isolated from the main frontend's localStorage, and capped at 5 MiB per Light System; it is not a shared database.
- Use `window.NoumiBridge.appStorage` for app-owned uploads, attachments, and generated files that must survive deployments. It is isolated by immutable Light System ID and currently allows 32 MiB per file, 1 GiB total, and 10,000 objects per Light System.
- Use `window.NoumiBridge.workspaceFiles` only when the file belongs in the current Project's collaborative Workspace. It is not private app storage. Check capability flags for UI availability, but rely on each request's authorization result.
- Use `window.NoumiBridge.db.from(table)` for normal shared CRUD. Check `result.ok` before reading data, and require a filter or explicit `.all()` for update/delete.
- Use `window.NoumiBridge.db.sql` only when fluent CRUD cannot express the query, and first check `db.capabilities.sqlQuery` or `sqlExecute`. Capability flags describe provider availability, not user permission.
- Use `window.NoumiBridge.outsideDb(slug).sql(sql, bindings, options)` for native PostgreSQL only. Check `outsideDb.capabilities.available`, use bindings instead of interpolation, inspect the `{ ok: true | false }` envelope, and separately catch transport errors.
- Keep every PostgreSQL transaction inside one `.sql()` call. Calls do not share a transaction or connection. Timeout, abort and transport failure can report an unknown write outcome, so never retry non-idempotent SQL automatically.
- External PostgreSQL source must not contain a connection URL, password, certificate, connection/grant ID, Project/user/Light-System ID or Executor address. Republishing creates a new immutable deployment and invalidates the prior grant.
- Do not execute DDL at runtime. `noumi.db.json` and append-only `db/migrations/*.sql` are applied only by the trusted publication state machine.
- Keep the generated `-- noumi:migration-risk {...}` first line in every new migration. Use `data-change` for inserts and `destructive` for updates, deletes, rename/drop, constraint changes or public policy tightening; replace the summary with the actual data impact.
- Keep `noumi.db.json.schemaVersion` as `platform`; the local CLI is a syntax preflight, while the publication service is the only schema-hash authority.
- Treat a mutation transport error with `outcome: "unknown"` as possibly committed. Keep its operation ID and call `db.operations.get(operationId)`; do not construct a new mutation as a retry.
- You may call explicit external HTTPS APIs. Their CORS policy must allow browser access.
- Never call relative `/api/*`, `/.noumi/db/*` or `/.noumi/outside-db/*` directly. The SDK and trusted Bridge own authentication, deployment/grant fences, request limits, cancellation and error validation.
- Never request or embed main-site tokens, cookies, project IDs as authorization, database URLs, or object-storage credentials.
- Bundle or inline same-app JS, CSS, fonts, and images so `index.html` remains self-contained.

## Foreground long-running work

- Treat multi-page document processing, batch import/conversion, and any work likely to outlive one page visit as an interruptible job, not one monolithic Promise.
- Require a signed-in Project member for shared durable jobs. Persist the input file before processing: keep app-owned files in `appStorage` or collaborative files in `workspaceFiles`, and keep only their stable path, etag, and metadata in `db`. A browser `File` object alone cannot survive reload; if upload is refused or over quota, disclose that resumption requires reselecting and verifying the same file.
- Create a database job before processing. Store its input etag, algorithm/rule version, total units, status, completed count, recent activity, and displayable error summary.
- Split work into stable units such as PDF page numbers. Persist each unit result or file reference immediately and advance progress only after that write succeeds. Enforce a unique `(job_id, unit_key)` key; if progress cannot be updated atomically with the result, derive progress from persisted unit rows.
- On reload, list incomplete jobs and offer Continue. Revalidate the input etag and algorithm version, skip persisted units, and retry only failed or missing units. Use a short database-time lease/conditional claim plus the unique unit key to prevent two tabs from corrupting the same job.
- Do not rely on `beforeunload`, `pagehide`, or `visibilitychange` to save the only checkpoint. They are best effort. Stop scheduling work when the page is not foregrounded and never promise execution after close, refresh, sleep, or browser termination.
- While running, show durable progress, current unit, failures, pause/continue/cancel controls, and a clear “keep this page in the foreground” notice. Warn on navigation when possible, but recovery must still work when no warning runs.
- Use a Web Worker or yield between units for CPU-heavy parsing, process bounded data at a time, and release page/Blob/canvas resources. Workers improve responsiveness but do not make work durable after the page closes.

## Frontend rules

- Keep `main.tsx` thin and product logic in `app.tsx` or focused components.
- Use semantic Tailwind tokens and preserve dark-mode behavior.
- Keep component-library files inside this repository; do not import Neo Noumi application components.
- Make layouts bounded and responsive, and give growing content an explicit overflow policy.

## Completion checklist

- `bun run typecheck` passes.
- `bun run db:validate` passes when the Light System has a database manifest.
- `bun run build` passes.
- The generated `dist/index.html` contains no app-owned backend/runtime code.
- The page works without `/api/*`.
- Long-running workflows survive a forced interruption: reopening shows the incomplete job and resumes from persisted successful units without duplicate results.
- Only source/configuration files are committed before sync and deployment.
