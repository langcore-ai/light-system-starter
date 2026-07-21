# Light System Starter

## Module Responsibility

- This directory is a standalone starter repo for AI-generated light systems deployed through Cloudflare Dynamic Workers.
- The starter owns clearly separated frontend source, backend Worker source, Tailwind/shadcn-style UI primitives, and the build script that creates `deploy-source-payload.generated.json`.
- The main Neo Noumi Worker only receives the generated deploy-source payload; it should not infer project structure or build the browser app from loose files.
- `CLAUDE.md` is the in-repo coding guide for AI agents working inside this starter or copied light-system repos.

## Project Structure

- `src/client/main.tsx` is the thin browser React mount entry.
- `src/client/app.tsx` owns page state orchestration and wires API calls to record components.
- `src/client/api/*` contains browser-only API clients.
- `src/client/styles.css` is the Tailwind CSS entry imported by the React app.
- `src/client/env.d.ts` contains browser-only global declarations.
- `src/client/components/records/*` contains record workflow UI.
- `src/client/components/ui/*` contains shadcn-style local primitives that can be extended or replaced by component-library output.
- `src/client/lib/*` contains frontend-only helpers such as `cn()`.
- `components.json` and `tsconfig.json` keep shadcn-style generation and `@/` imports scoped to `src/client`.
- `src/shared/*` contains pure contracts shared by client and server. Do not import React, Hono, or Cloudflare runtime APIs there.
- `src/server/worker.ts` exports `App extends DurableObject` and should stay as a thin Durable Object lifecycle wrapper.
- `src/server/app.ts` wires Hono route modules together.
- `src/server/routes/*` owns HTTP route registration.
- `src/server/routes/http-binding-probe.ts` demonstrates the custom `HTTP.fetch()` binding that proxies allowed outbound requests through the main Worker.
- `src/server/db/*` owns SQLite schema and repository operations.
- `src/server/lib/*` owns server-only HTML, HTTP, and validation helpers; the HTML shell inlines the client bundle because generated documents use an opaque origin.
- `scripts/build-deploy-source.ts` builds client JS/CSS, injects them into the worker source, and writes `deploy-source-payload.generated.json`.
- `scripts/verify-deploy-source.ts` verifies the generated payload before deployment.

## Entry Points

- Build payload: `bun run build:deploy-source`.
- Verify existing payload: `bun run verify:deploy-source`.
- Deploy payload: call the main service `light_systems_deploy_source` MCP tool with the generated `deploy-source-payload.generated.json` path; the legacy HTTP deploy-source endpoint is disabled.
- App runtime: `/light-systems/:slug`.
- Required API for every generated app: `/api/health`.
- Starter example APIs: `/api/records`, `/api/stats`, `/api/http-binding-probe`.

## Constraints

- Keep `src/server/worker.ts`, `src/client/main.tsx`, `scripts/build-deploy-source.ts`, and `deploy-source-payload.generated.json` paths stable.
- Keep component-library generated files inside this repo. Do not write shadcn, Hero UI, Radix, or local UI primitives into the main app.
- Browser code must be bundled before deployment and emitted as self-contained HTML; `src/server/worker.ts` should serve embedded assets, not import React at runtime or require same-app browser asset requests.
- Structured data must use `this.ctx.storage.sql` inside the Durable Object Facet.
- Public network access must use the injected `this.env.HTTP.fetch()` binding. Do not rely on global `fetch()` for outbound requests.
- Browser code should call its own APIs with string path references such as `/api/records`; the platform-wrapped global `fetch()` resolves them from the current light-system virtual root, independent of deep SPA routes.
- Generated HTML runs without `allow-same-origin`: browser storage/Cookie APIs and main-app credentials are unavailable. The platform-wrapped global `fetch()` maps string path references into the current `/light-systems/:slug/*` mount and attaches the app capability there; explicit absolute strings, `URL`, and `Request` inputs remain explicit, while external domains remain governed by their own CORS responses.
- Keep `src/shared/*` side-effect free and runtime neutral so both frontend and backend can import it safely.
- Keep generated deploy payload verification green before submitting to the main service.
