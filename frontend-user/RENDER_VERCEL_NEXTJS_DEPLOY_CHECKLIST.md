# Render + Vercel Next.js Migration Checklist

Use this after switching from React SPA to Next.js so deploys keep working after push.

## 1) Repository structure and root directory

- Keep frontend deploy target pointed to `frontend` (not repo root).
- Keep backend deploy target pointed to `backend`.
- Confirm both platforms use the same default branch.

## 2) Build and runtime commands

### Vercel (frontend)

- Framework Preset: `Next.js`.
- Root Directory: `frontend`.
- Install Command: `npm install` (or default).
- Build Command: `npm run build`.
- Output Directory: leave empty for Next.js.

### Render (frontend as Web Service)

- Service type: `Web Service`.
- Root Directory: `frontend`.
- Build Command: `npm install; npm run build`.
- Start Command: `npm run start`.
- Environment: `Node`.

## 3) Node version alignment

- Set Node version consistently across local, Vercel, and Render.
- Recommended: Node 20 LTS.
- Add this to `frontend/package.json` if not already set:

```json
{
  "engines": {
    "node": ">=20"
  }
}
```

## 4) Environment variables

Set the same values in both Vercel and Render frontend services:

- `NEXT_PUBLIC_API_URL` = public URL of backend API.

If backend URL changes between staging and production, use environment-specific values.

## 5) Next.js routing behavior changes

Because this is no longer a SPA bundle, check these after deploy:

- Deep links load directly (`/main/kenya/nairobi`, `/user?country=Kenya&county=Nairobi`).
- Metadata is rendered server-side (view page source, not just DevTools DOM).
- `robots.txt` and `sitemap.xml` resolve correctly.

## 6) CORS and API contract

- Backend must allow frontend origins from both Vercel and Render domains.
- Confirm cookies/auth headers still work from new frontend origin(s).
- Validate key dashboard endpoints from live frontend:
  - `/api/login`
  - `/api/admin/plots`
  - `/api/admin/users`
  - `/api/admin/payments`

## 7) Prevent accidental mis-deploy

- Vercel project should map to `frontend` only.
- Render backend should map to `backend` only.
- Avoid one service trying to build the monorepo root.

## 8) Post-deploy smoke test

- Homepage loads and search submits to `/user` with filters.
- County page opens and links into filtered user results.
- Admin login works on `/admin`.
- Superadmin login works on `/superadmin`.
- Mobile layout remains usable for homepage and dashboard tables.
