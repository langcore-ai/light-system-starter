# Light System Coding Guide

## What This App Is

This repository is a standalone light-system app deployed through Neo Noumi's Dynamic Workers pipeline.

The app is not part of the main Neo Noumi frontend or backend. It owns its own React client, Hono backend, Durable Object Facet SQLite data, build script, and deploy-source payload.

## Required Runtime Model

- Runtime is Cloudflare Workers, not Node.js or a local Linux process.
- Backend entry must export `class App extends DurableObject`.
- App data lives in this app's Durable Object Facet SQLite storage.
- Browser code must be bundled before deployment and embedded into the Worker source.
- The HTML shell must be self-contained: inline the built client JS and CSS instead of loading same-app script or stylesheet URLs.
- The main service only receives `deploy-source-payload.generated.json`; it should not infer structure from loose source files.

## Directory Boundaries

Keep these boundaries clear:

- `src/client/`: browser React code only.
- `src/client/main.tsx`: thin mount entry; do not put page logic here.
- `src/client/app.tsx`: page state orchestration.
- `src/client/api/`: browser API clients.
- `src/client/components/`: React UI components.
- `src/client/components/ui/`: local shadcn-style primitives.
- `src/client/lib/`: frontend-only helpers.
- `src/server/`: Worker backend code only.
- `src/server/worker.ts`: thin Durable Object lifecycle wrapper.
- `src/server/app.ts`: Hono route module assembly.
- `src/server/routes/`: HTTP route registration.
- `src/server/db/`: SQLite schema and repository operations.
- `src/server/lib/`: server-only helpers.
- `src/shared/`: pure constants and types shared by client and server.

Do not import React, Hono, Cloudflare runtime APIs, or side-effect modules from `src/shared/`.

## Required APIs

Every generated app must provide:

- `GET /api/health`: returns app name, version, and status.
- `GET /*`: returns the React HTML shell.

Business APIs are decided by the actual product requirement. Do not keep `/api/records` just because this starter uses it as an example.

## Data Rules

- Use `this.ctx.storage.sql.exec()` for structured persistent data.
- Initialize schema in `ctx.blockConcurrencyWhile()` with lightweight idempotent SQL.
- Validate user input before SQLite writes.
- Use SQL parameters, not string interpolation, for user-controlled values.
- Do not use local SQLite files, Prisma, Postgres, D1, KV, or R2 as the structured database for this app.

## Network Access

Dynamic Workers cannot rely on global `fetch()` for public internet access.

If backend code needs outbound HTTP, use the injected capability:

```ts
await this.env.HTTP.fetch("https://example.com/path");
```

This binding is controlled by the main service. Host allowlists, credentials, logging, and policy enforcement live outside this dynamic app.

Do not expose main-service cookies, secrets, database URLs, or privileged bindings to client code or dynamic backend code.

## Frontend Rules

- Use React for UI.
- Import global styles from `src/client/styles.css`.
- Keep API URLs compatible with path-mounted apps like `/light-systems/:slug`.
- Do not hardcode browser fetch paths as `/api/...`; use the local API client helper.
- The platform runs generated HTML in a CSP sandbox with scripts enabled but without `allow-same-origin`. Browser `localStorage`, `sessionStorage`, IndexedDB, `document.cookie`, Service Workers, and main-app ambient credentials are unavailable.
- Use the platform-installed global `fetch()` for this app's own `/light-systems/:slug/*` API. Do not capture or replace `fetch` before application startup; the platform attaches and renews the app-scoped capability there.
- Browser requests to other domains are allowed by default, but JavaScript can read their responses only when the target server's CORS policy permits it.
- Main-service `/api/*` routes are not an integration surface for generated code. Use explicit share links/capabilities or the app's backend `HTTP.fetch()` binding instead.
- Keep generated component-library files inside this repository.
- Do not import the main Neo Noumi app's shadcn components.

## Build And Deploy

After code changes, run:

```bash
bun run typecheck
bun run build:deploy-source
```

`build:deploy-source` must generate and verify `deploy-source-payload.generated.json`.

The payload must include:

- `version`
- `compatibilityDate`
- `entryPoint: "src/server/worker.js"`
- `files["src/server/worker.js"]`

The generated Worker source must not contain unresolved placeholders or runtime-only Node capabilities.

## Do Not Do

- Do not write files at runtime.
- Do not run shell commands or child processes at runtime.
- Do not install packages at runtime.
- Do not use remote dynamic imports.
- Do not load browser JS, CSS, fonts, or images from relative same-app asset URLs; bundle or inline them into the HTML shell. External assets remain subject to the external host's CORS/CSP behavior.
- Do not create new Durable Object namespaces.
- Do not depend on the main app's React, routes, database, or private bindings.
- Do not assume requests always hit the same in-memory instance; persistent state must be stored in SQLite.

## Before Finishing

Verify:

- `bun run typecheck` passes.
- `bun run build:deploy-source` passes.
- `/api/health` works after deployment.
- The React page loads from the app entry path.
- Required business API behavior works.
- If structured data is used, SQLite read/write behavior is verified.
