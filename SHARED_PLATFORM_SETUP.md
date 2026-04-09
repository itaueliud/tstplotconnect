# PlotConnect Shared Platform Setup

This repo now supports a shared-platform direction:

```text
plotconnect/
  backend/
  frontend/
  mobile-app/
  shared/
  scripts/
```

## What lives where

- `backend/`: Express API, auth, payments, plot data, metadata.
- `frontend/`: current web experience.
- `mobile-app/`: Expo React Native scaffold for Android and iOS.
- `shared/`: cross-platform helpers used by both clients.
- `scripts/sync-shared.mjs`: copies shared helpers into the web-served browser module.

## Shared workflow

1. Update reusable helpers in [shared/src/index.js](/c:/Users/SecurityManager/Desktop/plotconnect/shared/src/index.js).
2. Run `npm run sync:shared` from the repo root.
3. The browser copy updates at [frontend/public/features/shared/plotconnect-shared.js](/c:/Users/SecurityManager/Desktop/plotconnect/frontend/public/features/shared/plotconnect-shared.js).

## Running each app

- Backend: `npm run dev:backend`
- Web: `npm run dev:web`
- Mobile: `npm run dev:mobile`

## Recommended next build steps

1. Move more web fetch and auth helpers into `shared/src/index.js`.
2. Add pagination to `/api/plots` so both web and mobile scale.
3. Add mobile screen navigation and secure token storage.
4. Add API contract tests so both clients stay aligned.
