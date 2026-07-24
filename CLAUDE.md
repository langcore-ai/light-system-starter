# Light System Coding Guide

## Product model

Build a standalone React application that runs entirely in the browser. Do not create app-owned server routes, Durable Objects, Node/Bun services, SQLite files, or calls to the Neo Noumi main API. When shared persistence is required, use only the platform-injected `window.NoumiBridge.db`; it describes operations but never exposes the database handle, credentials, or provider.

## Required workflow

1. Read `noumi.db.json` and all existing migrations before changing shared data.
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
- Use `window.NoumiBridge.db.from(table)` for normal shared CRUD. Check `result.ok` before reading data, and require a filter or explicit `.all()` for update/delete.
- Use `window.NoumiBridge.db.sql` only when fluent CRUD cannot express the query, and first check `db.capabilities.sqlQuery` or `sqlExecute`. Capability flags describe provider availability, not user permission.
- Do not execute DDL at runtime. `noumi.db.json` and append-only `db/migrations/*.sql` are applied only by the trusted publication state machine.
- Treat a mutation transport error with `outcome: "unknown"` as possibly committed. Keep its operation ID and call `db.operations.get(operationId)`; do not construct a new mutation as a retry.
- You may call explicit external HTTPS APIs. Their CORS policy must allow browser access.
- Never call relative `/api/*` or the reserved `/.noumi/db/*` route directly. The SDK and trusted Bridge own authentication, version fences, request limits, and error validation.
- Never request or embed main-site tokens, cookies, project IDs as authorization, database URLs, or object-storage credentials.
- Bundle or inline same-app JS, CSS, fonts, and images so `index.html` remains self-contained.

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
- Only source/configuration files are committed before sync and deployment.
