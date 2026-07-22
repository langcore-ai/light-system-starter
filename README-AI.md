# Light System Starter

## Responsibility

This repository is a pure frontend starter for AI-generated Light Systems. It owns browser source and the deterministic build that writes `static-bundle.generated.json`. It has no server entrypoint, database, runtime process, Worker binding, or platform credential.

## Structure

- `src/client/main.tsx`: thin React mount.
- `src/client/app.tsx`: page state and product UI.
- `src/client/components/ui/*`: local component primitives.
- `src/client/styles.css`: Tailwind CSS v4 entry and semantic tokens.
- `scripts/build-static.ts`: bundles React/CSS and emits one self-contained `index.html` inside the static bundle.
- `scripts/verify-static.ts`: verifies the platform publication contract.
- `static-bundle.generated.json`: generated artifact committed with the source change.

## Commands

```bash
bun run typecheck
bun run build:static
```

After committing the generated bundle, call `light_systems_artifacts_sync`, then call `light_systems_deploy_static` with the returned full commit SHA and the absolute `static-bundle.generated.json` path.

## Runtime boundary

- Generated code runs in an iframe with `sandbox="allow-scripts"` and without `allow-same-origin`.
- The platform does not inject a bearer, database handle, main-site fetch wrapper, cookies, secrets, or backend API.
- `/api/*` is not a Light System backend and must not be used.
- Direct requests to external APIs are allowed, but browser CORS rules determine whether JavaScript may read the response.
- Browser persistence APIs are unavailable in the opaque-origin iframe. Treat app state as in-memory until the platform adds an explicit database handle in a later phase.
- Keep the output self-contained. Same-app JS/CSS/image assets should be bundled or inlined by the build.

## Contract

`static-bundle.generated.json` must use schema version 1, entrypoint `index.html`, and a `files` map. The starter intentionally emits only self-contained `index.html`. The backend reads this file from the exact synced Git commit, validates it, stores immutable files in object storage, then atomically promotes the manifest pointer.
