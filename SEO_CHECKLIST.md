# SEO Checklist

## Technical
- Update `frontend/public/sitemap.xml` with new/changed routes and dates.
- Verify `frontend/public/robots.txt` allows crawling of `/plots`, `/contacts`, `/blogs`, `/about`.
- Use clean route redirects for `.html` pages (e.g. `/plots` → `/plots.html`).

## Canonicals
- Set canonical tags to clean routes:
  - `/plots`
  - `/contacts`
  - `/blogs`
  - `/about`
- Ensure internal links use clean routes (avoid `.html` in links).

## Metadata
- Unique `<title>` and `<meta name="description">` per page.
- Open Graph tags set (`og:title`, `og:description`, `og:url`, `og:image`).
- Twitter cards set on shareable pages.

## Structured Data
- `/contacts`: `Organization` schema.
- `/blogs`: `Blog` or `CollectionPage` schema (optional).
- `/blog-post.html`: `Article` schema per post.
- `/plots`: `ItemList` or `Offer` schema (optional).

## Performance
- Compress images and set explicit image sizes where possible.
- Avoid blocking scripts on content pages.

## Internal Linking
- From blog posts, link to `/plots` and `/contacts`.
- From `/plots`, link to `/contacts` and `/about`.

## Verification
- Submit sitemap in Google Search Console and Bing Webmaster Tools.
- Inspect URLs for coverage and canonical correctness.
