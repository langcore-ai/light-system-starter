# Light System Starter

## Responsibility

This repository is a pure frontend starter for AI-generated Light Systems. It owns browser source and a deterministic build that writes `dist/index.html`. It has no app-owned server entrypoint, runtime process, Worker binding, database handle, or platform credential. Shared server-side data is available only through the platform-injected `window.NoumiBridge.db` capability.

## Structure

- `src/client/main.tsx`: thin React mount.
- `src/client/app.tsx`: page state and product UI.
- `src/client/components/ui/*`: local component primitives.
- `src/client/styles.css`: Tailwind CSS v4 entry and semantic tokens.
- `scripts/build-static.ts`: bundles React/CSS and emits one self-contained `dist/index.html`; the independently minified Browser Runtime and business bundle run in sequential isolated scopes so their short identifiers cannot collide.
- `scripts/noumi-db-sdk.ts`: browser-only fluent/controlled-SQL SDK that produces virtual v1 Requests.
- `scripts/noumi-db-schema.ts`: local migration replay, registry/hash generation and validation CLI.
- `scripts/noumi-browser-runtime-client.ts`: validates the parent Bridge bootstrap and injects `window.NoumiBridge`.
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
- The trusted shell injects `window.NoumiBridge` before the application bundle runs. It exposes the app name, creator, current signed-in member, asynchronous app-scoped `localStorage`, and the current Light System's controlled database SDK.
- `NoumiBridge.localStorage` is backed by the trusted shell's dedicated IndexedDB database and partitioned by Light System ID. It never reads, writes, or clears the main frontend's `window.localStorage`.
- `NoumiBridge.db.from(table)` provides schema-checked CRUD. `db.sql.query/execute` remain present for complex queries, but generated code must check `db.capabilities.sqlQuery/sqlExecute` because a provider can fail closed until its SQL safety gate passes.
- Create a migration with `bun run db:migration:new -- <snake_case_slug>`, then run `bun run db:schema:write`. Existing migration files are append-only and must never be edited after publication.
- The local schema CLI is a deterministic authoring aid. Publication independently replays and authorizes the exact migration source inside the platform before the dedicated DO applies it.
- Database calls are shared server persistence and require a signed-in Project member on every request. PUBLIC/password access only loads static UI; capability flags are not permission grants.
- Database mutation builders require a filter or explicit `.all()`, use operation IDs for idempotency, and return `NoumiDbResult` envelopes for HTTP/data errors. Transport failure after a mutation is an unknown outcome; recover it through `db.operations.get(operationId)`.
- Browser-local storage is capped at 4 KiB per key, 1 MiB per value, and 5 MiB per Light System.
- Relative `/api/*` is not a Light System backend and must not be used; only the injected database SDK may call the reserved platform data route.
- Direct requests to external APIs are allowed, but browser CORS rules determine whether JavaScript may read the response.
- Native browser persistence APIs remain unavailable in the opaque-origin iframe. Use `window.NoumiBridge.localStorage` for small device-local state and `window.NoumiBridge.db` for authorized shared persistence; their scopes are independent.
- Keep the output self-contained. Same-app JS/CSS/image assets should be bundled or inlined by the build.

## Contract

The source repository must remain valid with `bun run db:validate` and buildable with `bun run build`; it must not commit `dist/` or a SQLite file. The build must emit `dist/index.html`; the starter intentionally keeps it self-contained. The platform validates static output and database migrations from the exact same source commit before promoting the deployment.
