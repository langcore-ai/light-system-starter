# Light System Coding Guide

## Product model

Build a standalone React application that runs entirely in the browser. There is no application backend or database in this phase. Do not create server routes, Durable Objects, Node/Bun services, SQLite files, or calls to the Neo Noumi main API.

## Required workflow

1. Implement the requested UI and browser behavior under `src/client/`.
2. Run `bun run typecheck`.
3. Run `bun run build`.
4. Commit source changes only. `dist/` is ignored and must not be committed.
5. Call `light_systems_artifacts_sync`.
6. Call `light_systems_deploy_static` with the exact returned commit SHA.

## Browser constraints

- The document runs in an opaque-origin iframe: scripts work, but native `localStorage`, `sessionStorage`, IndexedDB, cookies, Service Workers, and main-site ambient authority are unavailable.
- The platform initializes `window.NoumiBridge` before the business bundle runs. Use its read-only `app`, `createByMember`, and `currentMember` context instead of inventing identity state.
- Use the asynchronous `window.NoumiBridge.localStorage` API for small browser-local state. It is partitioned by Light System ID, isolated from the main frontend's localStorage, and capped at 5 MiB per Light System; it is not a shared database.
- You may call explicit external HTTPS APIs. Their CORS policy must allow browser access.
- Never call relative `/api/*`; Neo Noumi does not provide a Light System backend in this phase.
- Never request or embed main-site tokens, cookies, project IDs as authorization, database URLs, or object-storage credentials.
- Bundle or inline same-app JS, CSS, fonts, and images so `index.html` remains self-contained.

## Frontend rules

- Keep `main.tsx` thin and product logic in `app.tsx` or focused components.
- Use semantic Tailwind tokens and preserve dark-mode behavior.
- Keep component-library files inside this repository; do not import Neo Noumi application components.
- Make layouts bounded and responsive, and give growing content an explicit overflow policy.

## Completion checklist

- `bun run typecheck` passes.
- `bun run build` passes.
- The generated `dist/index.html` contains no backend/runtime code.
- The page works without `/api/*`.
- Only source/configuration files are committed before sync and deployment.
