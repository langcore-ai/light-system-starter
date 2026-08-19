# Light System Starter

## Responsibility

This repository is a pure frontend starter for AI-generated Light Systems. It owns browser source and a deterministic build that writes `dist/index.html`. It has no app-owned server entrypoint, runtime process, Worker binding, database handle, or platform credential. The trusted `window.NoumiBridge` separates browser-local state, app-owned files, Project Workspace files, platform-owned SQLite data, and user-authorized external PostgreSQL.

## Structure

- `src/client/main.tsx`: thin React mount.
- `src/client/app.tsx`: page state and product UI.
- `src/client/components/ui/*`: local component primitives.
- `src/client/noumi.d.ts`: the single, self-contained public `window.NoumiBridge` type contract. It must not import or re-export types from `scripts/`; AI and editors must be able to understand the complete API from this file alone. Keep it compact by documenting only non-obvious public semantics, reusing existing named structures, and omitting the redundant `Noumi` prefix from declaration names; the runtime property remains `window.NoumiBridge`.
- `src/client/styles.css`: Tailwind CSS v4 entry and semantic tokens.
- `scripts/build-static.ts`: bundles React/CSS and emits one self-contained `dist/index.html`; the independently minified Browser Runtime and business bundle run in sequential isolated scopes so their short identifiers cannot collide.
- `scripts/noumi-db-sdk.ts`: browser-only fluent/controlled-SQL SDK that produces virtual v1 Requests.
- `scripts/noumi-db-schema.ts`: local migration replay, registry/hash generation and validation CLI.
- `scripts/noumi-app-storage.ts`: browser-only SDK for Light-System-owned files that survive deployments.
- `scripts/noumi-outside-db.ts`: browser-only SDK for user-private external PostgreSQL; it validates slugs, bindings, limits, result envelopes and cancellation without exposing credentials or internal authority.
- `scripts/noumi-workspace-files.ts`: browser-only SDK for files that belong in the current Project's collaborative Workspace.
- `scripts/noumi-browser-runtime-client.ts`: validates the parent Bridge bootstrap and injects `window.NoumiBridge`.
- `scripts/noumi-global-contract.typecheck.ts`: compile-only bidirectional checks that keep the flattened global declarations aligned with the split Runtime SDK source types.
- `scripts/verify-static.ts`: parses and verifies the final inline browser module instead of checking only marker strings.
- `noumi.db.json` and `db/migrations/*.sql`: shared database policy and append-only schema history.
- `dist/`: ignored local build output; the platform rebuilds it from the synchronized source commit.

## Commands

```bash
bun run db:validate
bun run typecheck
bun run build
```

Commit source changes only, call `light_systems_artifacts_sync`, then call `light_systems_deploy_static` with the returned full commit SHA. Deployment clones that exact commit into a disposable builder, runs `bun run build`, validates `dist/`, and stores the static files in object storage.

## Runtime boundary

- Generated code runs in an iframe with `sandbox="allow-scripts"` and without `allow-same-origin`.
- The platform does not inject a bearer, database handle, generic main-site fetch wrapper, cookies, secrets, or provider binding.
- The trusted shell injects `window.NoumiBridge` before the application bundle runs. It exposes the app name, creator, current signed-in member, asynchronous app-scoped `localStorage`, `appStorage`, `workspaceFiles`, and controlled database SDKs.
- `NoumiBridge.localStorage` is backed by the trusted shell's dedicated IndexedDB database and partitioned by Light System ID. It never reads, writes, or clears the main frontend's `window.localStorage`.
- `NoumiBridge.appStorage` owns app-private uploads, attachments, and generated files. It is partitioned by immutable Light System ID, survives deployments, and currently allows 32 MiB per file, 1 GiB total, and 10,000 objects.
- `NoumiBridge.workspaceFiles` reads and mutates the current Project's collaborative file tree on behalf of the current member. It is not an app-private bucket; capability flags are only UI availability hints and every request is authorized independently.
- `NoumiBridge.db.from(table)` provides schema-checked CRUD. `db.sql.query/execute` remain present for complex queries, but generated code must check `db.capabilities.sqlQuery/sqlExecute` because a provider can fail closed until its SQL safety gate passes.
- `NoumiBridge.outsideDb(slug).sql(sql, bindings, options)` executes native PostgreSQL through a current-user, current-deployment grant. Check `outsideDb.capabilities.available`, keep values in bindings, and handle both `{ ok: false }` results and thrown transport errors. A call uses one physical connection, so transactions must fit inside one call; timeout, abort or transport failure can leave a write outcome unknown and must not trigger an automatic retry.
- External PostgreSQL is independent from `NoumiBridge.db`: it has no `noumi.db.json` or Light System migration. Source contains only the approved slug and SQL, never a connection URL, password, connection/grant ID, Project/user/Light-System ID or Executor address. Republishing invalidates the previous deployment grant.
- Create a migration with `bun run db:migration:new -- <snake_case_slug>`, replace the generated first-line `noumi:migration-risk` summary/level with the real impact, then run `bun run db:schema:write`. Existing migration files are append-only and must never be edited after publication.
- The platform has no lifetime migration-count or byte cap. Each migration stays under 256 KiB and one publication's pending SQL under 1 MiB; an 8 MiB bootstrap guard applies only to the first publication before a trusted checkpoint exists. The local CLI does not pretend to know whether that checkpoint exists. DML, rename/drop, constraint changes and public policy tightening produce a user-confirmed impact preview.
- The local schema CLI is only an authoring preflight and writes the `platform` schemaVersion sentinel. Publication independently computes the authoritative hash, replays and authorizes the exact migration source inside the dedicated DO, and then stores a trusted physical checkpoint.
- Database calls are shared server persistence and require a signed-in Project member on every request. PUBLIC/password access only loads static UI; capability flags are not permission grants.
- Database mutation builders require a filter or explicit `.all()`, use operation IDs for idempotency, and return `DbResult` envelopes for HTTP/data errors. Transport failure after a mutation is an unknown outcome; recover it through `db.operations.get(operationId)`.
- Browser-local storage is capped at 4 KiB per key, 1 MiB per value, and 5 MiB per Light System.
- Relative `/api/*` is not a Light System backend and must not be used; only the injected SDKs may call their reserved platform data routes.
- Direct requests to external APIs are allowed, but browser CORS rules determine whether JavaScript may read the response.
- Native browser persistence APIs remain unavailable in the opaque-origin iframe. Use `window.NoumiBridge.localStorage` for small device-local state, `window.NoumiBridge.appStorage` for app-owned files, `window.NoumiBridge.workspaceFiles` for Project files, `window.NoumiBridge.db` for platform-owned structured persistence, and `window.NoumiBridge.outsideDb` only for an explicitly authorized user-owned PostgreSQL connection; all scopes are independent.
- Keep the output self-contained. Same-app JS/CSS/image assets should be bundled or inlined by the build.

## Foreground jobs

The browser is the only execution runtime, so long-running work cannot continue after close, refresh, process termination, or device sleep. Multi-page documents and batch operations must therefore use durable, resumable units:

- Require a signed-in Project member for a shared durable job. Persist the source file first, then create a shared database job containing its stable path/etag and the processing-rule version. A browser `File` object alone is not resumable; if persistence is refused or over quota, continuing requires the user to reselect and verify the same file.
- Give every unit a stable key and persist each successful result immediately. The unit-result rows, protected by a unique job/unit key, are the recovery source of truth; an in-memory percentage is not.
- On entry, surface incomplete jobs and let the user continue after revalidating the source etag and rule version. A short lease evaluated with database time prevents competing tabs, while idempotent unit writes preserve correctness after lease races.
- Only schedule new work while the page is visible. `visibilitychange`, `pagehide`, `beforeunload`, and navigation warnings are best effort and must never own the only checkpoint.
- Keep the UI responsive with bounded per-unit memory and workers/yields where useful. Always show durable progress, current work, recoverable errors, pause/continue/cancel actions, and a notice that the page must remain in the foreground.

For PDF parsing, store the PDF in the appropriate file capability and one database result per page. Resume by processing missing or failed page keys; never restart solely because the previous browser session disappeared.

## Contract

The source repository must remain valid with `bun run db:validate` and buildable with `bun run build`; it must not commit `dist/` or a SQLite file. `src/client/noumi.d.ts` must remain one self-contained declaration file with no imports, while `bun run typecheck` proves that its public structures still match the split Runtime SDK implementations. The build must emit `dist/index.html`; the starter intentionally keeps it self-contained. The platform validates static output and database migrations from the exact same source commit before promoting the deployment.
