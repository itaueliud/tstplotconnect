# Next.js Live Go-Live Checklist

This runbook is for taking the migrated Next.js frontend live safely.

## 1) Preflight (Local)

Run from `frontend/`:

```bash
npm ci
npm run build
npm run start
```

Expected:
- Build succeeds with no TypeScript errors.
- App serves correctly on production mode port.

Manual checks:
- `/`
- `/main`
- `/main/kenya`
- `/main/kenya/nairobi` (or any valid county slug)
- `/user?country=Kenya&county=Nairobi`
- `/user?country=Kenya&county=Machakos&town=Machakos`

## 2) Environment Variables

Set in production hosting (frontend):
- `NEXT_PUBLIC_API_URL` = your live backend URL

Code paths that depend on this:
- `src/lib/api.ts`
- `src/lib/locations.ts`

Also verify backend allows your frontend origin in CORS.

## 3) Staging Deploy (Required Before Live)

Deploy to a preview/staging URL first.

Validate these pages on staging:
- `/`
- `/main`
- `/main/kenya`
- `/main/kenya/nairobi`
- `/about`
- `/contact`
- `/privacy`
- `/user`
- `/admin`
- `/superadmin`

Functional tests:
- User login/register works.
- County page metadata renders.
- Town links from county page open `/user` with active filters.
- Listings load from live API.
- Payment flow starts and status updates.

## 4) SEO Validation Before Cutover

Validate metadata + canonical:
- `src/app/layout.tsx`
- `src/app/main/[country]/[county]/page.tsx`
- `src/app/user/page.tsx`

Validate sitemap:
- `src/app/sitemap.ts`

Check robots:
- Ensure `public/robots.txt` is present and correct.

If old React/static URLs changed, add 301 redirects in:
- `next.config.mjs`
- `vercel.json` (if needed by your host)

## 5) Production Cutover

- Freeze content/deploys briefly.
- Promote the staging-validated build to production.
- Update DNS/alias to point to Next.js deployment.
- Purge CDN cache after cutover.

## 6) Smoke Test Immediately After Go-Live

Critical route checks:
- Home loads fast and without console errors.
- Country page and county page return `200`.
- County page -> town link -> user page with filters works.
- Auth and payments still work.

API checks:
- No CORS errors.
- No 401/403 spikes for valid user sessions.

## 7) Search Console and Indexing

- Submit live sitemap URL in Google Search Console.
- Request indexing for:
  - `/`
  - `/main`
  - 2-3 high-priority county pages
- Monitor crawl/index errors daily for first week.

## 8) Monitoring (First 72 Hours)

Track:
- 404 count
- 500 count
- API latency and failure rate
- Login failures
- Payment failures
- Traffic drop on top SEO landing pages

If issues appear:
- Roll back to previous stable deployment immediately.

## 9) Rollback Plan (Must Be Ready)

Before cutover, ensure you can:
- Re-point production alias to previous deployment in one action.
- Restore previous env vars quickly.
- Verify old site health with a 5-minute smoke test.

## 10) Quick Command Set

From `frontend/`:

```bash
npm ci
npm run build
npm run start
```

Optional clean build:

```bash
rm -rf .next
npm run build
```

PowerShell equivalent:

```powershell
Remove-Item -Recurse -Force .next
npm run build
```
