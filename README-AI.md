# Light System Starter

## Responsibility

This repository is a pure frontend starter for AI-generated Light Systems. It owns browser source and a deterministic build that writes `dist/index.html`. It has no server entrypoint, database, runtime process, Worker binding, or platform credential.

## Structure

- `src/client/main.tsx`: thin React mount.
- `src/client/app.tsx`: page state and product UI.
- `src/client/components/ui/*`: local component primitives.
- `src/client/styles.css`: Tailwind CSS v4 entry and semantic tokens.
- `scripts/build-static.ts`: bundles React/CSS and emits one self-contained `dist/index.html`.
- `scripts/verify-static.ts`: verifies the browser-only build output.
- `dist/`: ignored local build output; the platform rebuilds it from the synchronized source commit.

## Commands

```bash
bun run typecheck
bun run build
```

Commit source changes only, call `light_systems_artifacts_sync`, then call `light_systems_deploy_static` with the returned full commit SHA. Deployment clones that exact commit into a disposable builder, runs `bun run build`, validates `dist/`, and stores the static files in object storage.

## Runtime boundary

- Generated code runs in an iframe with `sandbox="allow-scripts"` and without `allow-same-origin`.
- The platform does not inject a bearer, database handle, main-site fetch wrapper, cookies, secrets, or backend API.
- The trusted shell injects `window.NoumiBridge` before the application bundle runs. It exposes the app name, creator, current signed-in member, and an asynchronous app-scoped `localStorage` API.
- `NoumiBridge.localStorage` is backed by the trusted shell's dedicated IndexedDB database and partitioned by Light System ID. It never reads, writes, or clears the main frontend's `window.localStorage`.
- Browser-local storage is capped at 4 KiB per key, 1 MiB per value, and 5 MiB per Light System.
- `/api/*` is not a Light System backend and must not be used.
- Direct requests to external APIs are allowed, but browser CORS rules determine whether JavaScript may read the response.
- Native browser persistence APIs remain unavailable in the opaque-origin iframe. Use `window.NoumiBridge.localStorage` for small browser-local state; it is not a shared database or server-side persistence layer.
- Keep the output self-contained. Same-app JS/CSS/image assets should be bundled or inlined by the build.

## Contract

The source repository must remain buildable with `bun run build` and must not commit `dist/`. The build must emit `dist/index.html`; the starter intentionally keeps it self-contained. The platform validates all output paths, MIME types, file counts, and byte limits before storing immutable files and atomically promoting the manifest pointer.
