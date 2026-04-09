# Google Search Console Setup & Verification Guide

**Last Updated:** April 9, 2026

---

## Quick Start (5 minutes)

1. Go to: https://search.google.com/search-console
2. Click **"Add Property"**
3. Select **"URL prefix"** method: `https://www.tst-plotconnect.com`
4. Verify ownership (see options below)
5. Submit sitemap: `https://www.tst-plotconnect.com/sitemap.xml`

---

## Step-by-Step Verification Methods

### Method 1: HTML File (Recommended)
1. Download verification file from GSC
2. Upload to `frontend/public/google[CODE].html`
3. Verify access: `https://www.tst-plotconnect.com/google[CODE].html`
4. Click "Verify" in GSC

### Method 2: Meta Tag
1. Copy meta tag from GSC:
   ```html
   <meta name="google-site-verification" content="[CODE]">
   ```
2. Add to `frontend/public/index.html` `<head>`
3. Click "Verify" in GSC

### Method 3: Google Analytics (Fastest if linked)
1. Account must have **Editor** role in Google Analytics
2. GSC auto-verifies on connection
3. Link Analytics account to property

### Method 4: Google Tag Manager
1. Requires GTM account with **Approver** role
2. Container must be active on site
3. Auto-verification on connection

---

## After Verification: Key Settings

### 1. **URL Inspection Tool**
Test individual URLs before/after changes:
```
1. Paste URL: https://www.tst-plotconnect.com/plots
2. Check "Mobile friendly"
3. View "Page resource review"
4. Request indexing if needed
```

### 2. **Request Indexing for New Content**
When publishing blog posts or new city pages:
```
1. Go to URL Inspection
2. Paste new URL
3. Click "Request indexing"
4. Google crawls within 24-48 hours
```

### 3. **Submit Sitemap**
**Must do for SEO success:**
```
1. Go to "Sitemaps" (left menu)
2. Click "Add/test sitemap"
3. Enter: https://www.tst-plotconnect.com/sitemap.xml
4. Verify "Success" status
5. Check "Discovered pages" count
```

**Current sitemap stats:**
- Total URLs: 50+
- Last updated: 2026-04-09
- Dynamic listings: Auto-synced daily

### 4. **Coverage Report**
Monitor indexing health:
```
Status Breakdown:
✅ Valid                 → Pages indexed successfully
⚠️ Valid (with warnings) → Indexed but fixable issues
❌ Error                  → Not indexed (fix required)
⏭️ Excluded              → Intentionally not indexed

Target: 95%+ "Valid" coverage
```

**Typical excluded pages (by design):**
- `/admin`, `/admin.html` (blocked by robots.txt)
- `/blog-admin.html`
- `/superadmin.html`

### 5. **Performance Report (formerly Search Analytics)**
See how your site performs in search results:
```
Metrics:
- Total Clicks: How many users clicked your link
- Total Impressions: How many times appeared in search
- Average CTR: Click-through rate (benchmark: 3-5%)
- Average Position: Avg ranking position

Filter by:
- Pages (which URLs rank)
- Countries (geo performance)
- Devices (mobile vs desktop)
- Search type (web, image, news, video)
```

**Action items from reports:**
- Pages with high impressions but low CTR → Improve title/description
- Pages not ranking → Build backlinks or improve content quality
- Mobile underperforming → Test with PageSpeed Insights

### 6. **Enhancements (Rich Results)**
Monitor rich snippets and structured data:
```
Types that may appear:
✅ Article (Blog posts)
✅ Accommodation (Listings)
✅ LocalBusiness (Contact page)
✅ BreadcrumbList (Navigation)
✅ Organization (Homepage)

Review any errors with:
- https://search.google.com/test/rich-results
- https://validator.schema.org
```

---

## Monitoring Checklist

### Weekly
- [ ] Review Search Performance report
- [ ] Check Coverage for new errors
- [ ] Monitor Core Web Vitals in PageSpeed Insights

### Monthly
- [ ] Analyze top performing pages
- [ ] Identify opportunities (high impression, low CTR)
- [ ] Request indexing for new blog posts/listings

### Quarterly
- [ ] Full site audit (Lighthouse, Screaming Frog)
- [ ] Backlink profile review (Ahrefs/Semrush)
- [ ] Competitive keyword analysis
- [ ] Update content for ranking gaps

---

## Common GSC Findings & Fixes

### "Page with redirect"
**Issue:** URL redirects instead of direct content
**Fix:**
- Update internal links to point directly
- Submit final URL to GSC
- Allow 2-3 days for crawl update

### "Soft 404"
**Issue:** Page returns 200 status but looks like 404
**Fix:**
- Ensure page loads actual content
- Add proper H1 tag
- Test with URL Inspection

### "Crawled but not indexed"
**Issue:** Google sees page but chooses not to index
**Fix:**
- Increase page quality/uniqueness
- Add more internal links
- Ensure title/description are unique
- Wait 2-4 weeks (often auto-resolves)

### "Excluded: Blocked by robots.txt"
**Issue:** robots.txt intentionally blocks page
**Fix:**
- If should be indexed: Allow in robots.txt
- If intentionally private: Leave as-is
- Example: `/admin` pages should stay blocked

### "Excluded: Duplicate without user-selected canonical"
**Issue:** Duplicate content without clear canonical
**Fix:**
- Ensure ALL pages have `<link rel="canonical">` tag
- Point to self-URL for unique pages
- Run sync-seo.cjs to update all pages

---

## Advanced Features

### Sitelink Search Box
Get branded search box in SERP (for well-known sites):
```json
{
  "@context": "https://schema.org",
  "@type": "WebSite",
  "url": "https://www.tst-plotconnect.com",
  "potentialAction": {
    "@type": "SearchAction",
    "target": "https://www.tst-plotconnect.com/?q={search_term_string}",
    "query-input": "required name=search_term_string"
  }
}
```
✅ Already implemented on homepage!

### Author & Multi-Site Management
If managing canonicalize.com / tst-plotconnect.com:
```
1. Add all variants as properties
2. In Settings → Preferred Domain
3. Choose: www or non-www
4. Google consolidates rankings
```

---

## Bing Webmaster Tools (Bonus)

**Why?** ~15% of searches globally, growing in Africa  
**Setup:** https://www.bing.com/webmasters

Same steps as Google:
1. Add site property
2. Verify ownership
3. Submit sitemap
4. Monitor in Intelligence report

---

## Mobile-First Indexing (Already Implemented!)

**What:** Google indexes mobile version as primary  
**Our Status:** ✅ Mobile-responsive via Tailwind CSS  
**Verify:**
```
GSC → Settings → Crawling → User Agent
Should show: Googlebot/2.1 (mobile)

Check: Google sees same content on mobile/desktop
Test: https://search.google.com/test/mobile-friendly
```

---

## FAQ

**Q: How long until my site ranks?**
A: 3-6 months for new site, faster for content adds. Submit sitemap to accelerate.

**Q: Should I submit every new page?**
A: Not necessary if on sitemap. GSC crawls sitemap automatically. But URL Inspection + "Request indexing" speeds up.

**Q: What's the difference between Impressions and Clicks?**
A: Impressions = saw your link in search, Clicks = clicked your link. Optimize low-CTR pages.

**Q: Can I rank without Google Search Console?**
A: Yes, but GSC helps identify problems faster and request indexing.

**Q: How do I submit to other search engines?**
A: Bing: https://www.bing.com/webmasters  
Yandex: https://webmaster.yandex.com/  
Baidu: https://api.zhanzhang.baidu.com/  

---

## Critical URLs to Submit

**Add these to sitemap and test in URL Inspection:**

```
1. https://www.tst-plotconnect.com/
   Type: Home (Organization schema)

2. https://www.tst-plotconnect.com/plots
   Type: Collection (Listings)

3. https://www.tst-plotconnect.com/nairobi-hostels
   Type: City Page (High traffic target)

4. https://www.tst-plotconnect.com/blogs
   Type: Blog index

5. https://www.tst-plotconnect.com/contacts
   Type: Contact (LocalBusiness schema)

6. https://www.tst-plotconnect.com/listing/[slug]
   Type: Individual listing (Accommodation schema)
```

---

## Performance Benchmarks to Achieve

| Metric | Target | Status |
|--------|--------|--------|
| Coverage: Valid | 95%+ | ✅ Monitor |
| Average CTR | 3-5% | ⏳ Improve titles |
| Mobile friendly | 100% | ✅ Responsive |
| Page Speed | 75+ (PageSpeed Insights) | ⏳ Optimize images |
| Indexing lag | <7 days | ✅ Sitemap submitted |
| Rich snippets | 80%+ pages | ✅ Schema.org added |

---

## Resources

- **Google Search Central:** https://developers.google.com/search
- **SEO Starter Guide:** https://developers.google.com/search/docs/beginner/seo-starter-guide
- **Mobile-Friendly Test:** https://search.google.com/test/mobile-friendly
- **Rich Results Test:** https://search.google.com/test/rich-results
- **Page Speed Insights:** https://pagespeed.web.dev
- **Lighthouse Audit:** Built into Chrome DevTools (F12 → Lighthouse)

---

**Next Steps:**
1. ✅ Verify site in Google Search Console NOW
2. ⏳ Submit sitemap within 24 hours
3. ⏳ Monitor Coverage report weekly
4. ⏳ Implement monitoring system for alerts

---

**Questions?**  
Contact: support@tst-plotconnect.com  
WhatsApp: +254 768 622 994
