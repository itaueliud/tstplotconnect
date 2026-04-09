const fs = require("fs");
const path = require("path");

const { SITE, pages, blogPosts } = require("../seo.config.cjs");

const FRONTEND_DIR = path.resolve(__dirname, "..");
const PUBLIC_DIR = path.join(FRONTEND_DIR, "public");
const ROBOTS_PATH = path.join(PUBLIC_DIR, "robots.txt");
const SITEMAP_PATH = path.join(PUBLIC_DIR, "sitemap.xml");
const LISTINGS_DIR = path.join(PUBLIC_DIR, "listings");
const LISTINGS_MANIFEST_PATH = path.join(LISTINGS_DIR, "manifest.json");
const PLOT_REDIRECT_DELAY_MS = 1200;

function escapeHtml(value) {
  return String(value || "")
    .replace(/&/g, "&amp;")
    .replace(/"/g, "&quot;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

function absoluteUrl(relativePath = "/") {
  return new URL(relativePath, SITE.url).toString();
}

function detectEol(text) {
  return text.includes("\r\n") ? "\r\n" : "\n";
}

function dedupe(values = []) {
  return [...new Set(values.filter(Boolean).map((value) => String(value).trim()))];
}

function repairMojibake(value) {
  const text = String(value || "");
  if (!/[ÃÂâ]/.test(text)) return text;
  try {
    const repaired = Buffer.from(text, "latin1").toString("utf8");
    const originalNoise = (text.match(/[ÃÂâ]/g) || []).length;
    const repairedNoise = (repaired.match(/[ÃÂâ]/g) || []).length;
    return repairedNoise < originalNoise ? repaired : text;
  } catch (_error) {
    return text;
  }
}

function stripText(value) {
  return repairMojibake(value).replace(/\s+/g, " ").trim();
}

function truncate(value, max = 160) {
  const clean = stripText(value);
  if (clean.length <= max) return clean;
  return `${clean.slice(0, max - 1).trim()}...`;
}

function slugify(value) {
  return String(value || "")
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, " ")
    .replace(/[\s_-]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "") || "listing";
}

function formatCurrency(value) {
  const num = Number(value);
  if (!Number.isFinite(num)) return "Price on request";
  return `KES ${num.toLocaleString()}`;
}

function toIsoDate(value) {
  if (!value) return new Date().toISOString().slice(0, 10);
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return new Date().toISOString().slice(0, 10);
  return parsed.toISOString().slice(0, 10);
}

function removeManagedSeo(head) {
  return head
    .replace(/\s*<title>[\s\S]*?<\/title>\s*/gi, "\n")
    .replace(/\s*<meta[^>]+name=["']viewport["'][^>]*>\s*/gi, "\n")
    .replace(/\s*<meta[^>]+name=["']description["'][^>]*>\s*/gi, "\n")
    .replace(/\s*<meta[^>]+name=["']keywords["'][^>]*>\s*/gi, "\n")
    .replace(/\s*<meta[^>]+name=["']author["'][^>]*>\s*/gi, "\n")
    .replace(/\s*<meta[^>]+name=["']robots["'][^>]*>\s*/gi, "\n")
    .replace(/\s*<link[^>]+rel=["']canonical["'][^>]*>\s*/gi, "\n")
    .replace(/\s*<link[^>]+rel=["']icon["'][^>]*>\s*/gi, "\n")
    .replace(/\s*<meta[^>]+property=["']og:[^"']+["'][^>]*>\s*/gi, "\n")
    .replace(/\s*<meta[^>]+name=["']twitter:[^"']+["'][^>]*>\s*/gi, "\n")
    .replace(/\s*<script\b(?=[^>]*type=["']application\/ld\+json["'])(?:(?!id=)[^>])*data-seo-schema=["']true["'][^>]*>[\s\S]*?<\/script>\s*/gi, "\n")
    .replace(/\s*<script\b(?=[^>]*type=["']application\/ld\+json["'])(?![^>]*\bid=)[^>]*>[\s\S]*?<\/script>\s*/gi, "\n")
    .replace(/\n{3,}/g, "\n\n");
}

function buildJsonLd(schema, eol) {
  const json = JSON.stringify(schema, null, 2)
    .split("\n")
    .map((line) => `    ${line}`)
    .join(eol);
  return [
    '  <script type="application/ld+json" data-seo-schema="true">',
    json,
    "  </script>"
  ].join(eol);
}

function buildSeoBlock(page, eol) {
  const lines = [
    `  <title>${escapeHtml(page.title)}</title>`,
    '  <meta name="viewport" content="width=device-width, initial-scale=1.0">',
    `  <meta name="description" content="${escapeHtml(page.description)}">`,
    `  <meta name="author" content="${escapeHtml(SITE.author)}">`,
    `  <meta name="robots" content="${escapeHtml(page.robots)}">`
  ];

  if (Array.isArray(page.keywords) && page.keywords.length > 0) {
    lines.push(`  <meta name="keywords" content="${escapeHtml(page.keywords.join(", "))}">`);
  }

  if (page.path) {
    lines.push(`  <link rel="canonical" href="${escapeHtml(absoluteUrl(page.path))}">`);
  }

  lines.push(
    `  <meta property="og:type" content="${escapeHtml(page.ogType || "website")}">`,
    `  <meta property="og:site_name" content="${escapeHtml(SITE.name)}">`,
    `  <meta property="og:locale" content="${escapeHtml(SITE.locale)}">`,
    `  <meta property="og:title" content="${escapeHtml(page.title)}">`,
    `  <meta property="og:description" content="${escapeHtml(page.description)}">`,
    `  <meta property="og:url" content="${escapeHtml(absoluteUrl(page.path || "/"))}">`,
    `  <meta property="og:image" content="${escapeHtml(absoluteUrl(SITE.image))}">`,
    `  <meta name="twitter:card" content="${escapeHtml(page.twitterCard || SITE.twitterCard)}">`,
    `  <meta name="twitter:title" content="${escapeHtml(page.title)}">`,
    `  <meta name="twitter:description" content="${escapeHtml(page.description)}">`,
    `  <meta name="twitter:image" content="${escapeHtml(absoluteUrl(SITE.image))}">`,
    `  <link rel="icon" type="image/svg+xml" href="${escapeHtml(SITE.image)}">`
  );

  if (Array.isArray(page.schemas) && page.schemas.length > 0) {
    page.schemas.forEach((schema) => {
      lines.push(buildJsonLd(schema, eol));
    });
  }

  return lines.join(eol);
}

function syncHtmlPage(page) {
  const filePath = path.join(PUBLIC_DIR, page.file);
  const html = fs.readFileSync(filePath, "utf8");
  const eol = detectEol(html);
  const headMatch = html.match(/<head>([\s\S]*?)<\/head>/i);
  if (!headMatch) {
    throw new Error(`Missing <head> in ${page.file}`);
  }

  const originalHead = headMatch[1];
  const cleanedHead = removeManagedSeo(originalHead).trim();
  const charsetMatch = cleanedHead.match(/<meta[^>]+charset=["'][^"']+["'][^>]*>|<meta[^>]+charset=[^>\s]+[^>]*>/i);
  const seoBlock = buildSeoBlock(page, eol);

  let rebuiltHead = cleanedHead;
  if (charsetMatch) {
    rebuiltHead = cleanedHead.replace(charsetMatch[0], `${charsetMatch[0]}${eol}${seoBlock}`);
  } else {
    rebuiltHead = `${seoBlock}${eol}${cleanedHead}`;
  }

  rebuiltHead = rebuiltHead
    .replace(/\n{3,}/g, "\n\n")
    .replace(/\r\n\r\n\r\n/g, "\r\n\r\n")
    .trim();

  const nextHtml = html.replace(/<head>[\s\S]*?<\/head>/i, `<head>${eol}${rebuiltHead}${eol}</head>`);
  fs.writeFileSync(filePath, nextHtml, "utf8");

  return {
    file: page.file,
    hasMain: /<main[\s>]/i.test(nextHtml),
    hasH1: /<h1[\s>]/i.test(nextHtml)
  };
}

function formatPriority(value) {
  const num = Number(value || 0);
  return num.toFixed(1);
}

function xmlEscape(value) {
  return String(value || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

function buildPlotTitle(plot) {
  const title = stripText(plot.title);
  const location = [stripText(plot.area), stripText(plot.county || plot.town)].filter(Boolean).join(", ");
  if (title && location) return `${title} | ${location} | TST PlotConnect`;
  if (title) return `${title} | TST PlotConnect`;
  const fallback = [stripText(plot.category || "Listing"), stripText(plot.county || plot.town || plot.country || "Kenya")].filter(Boolean).join(" in ");
  return `${fallback || "Property Listing"} | TST PlotConnect`;
}

function buildPlotDescription(plot) {
  const title = stripText(plot.title) || "Verified property listing";
  const place = [stripText(plot.area), stripText(plot.county || plot.town), stripText(plot.country || "Kenya")].filter(Boolean).join(", ");
  const pricePart = Number.isFinite(Number(plot.price))
    ? ` priced at ${formatCurrency(plot.price)}`
    : "";
  const details = stripText(plot.description) || "View photos, location details, and open the live listing on TST PlotConnect.";
  return truncate(`View ${title}${place ? ` in ${place}` : ""}${pricePart} on TST PlotConnect. ${details}`, 158);
}

function buildPlotSlug(plot) {
  const base = slugify(plot.title || [plot.category, plot.area, plot.county || plot.town].filter(Boolean).join(" "));
  return `${base || "listing"}-${String(plot.id || "").toLowerCase()}`;
}

function buildPlotPath(plot) {
  return `/listing/${buildPlotSlug(plot)}`;
}

function buildUserListingUrl(plot) {
  const params = new URLSearchParams();
  if (plot.country) params.set("country", plot.country);
  if (plot.county || plot.town) params.set("county", plot.county || plot.town);
  if (plot.area) params.set("area", plot.area);
  if (plot.category) params.set("category", plot.category);
  if (plot.id) params.set("plotId", plot.id);
  return `${SITE.url}/?${params.toString()}#user-listings`;
}

function buildPlotKeywords(plot) {
  return dedupe([
    stripText(plot.title),
    stripText(plot.category),
    `${stripText(plot.category)} ${stripText(plot.county || plot.town)}`.trim(),
    `${stripText(plot.area)} ${stripText(plot.county || plot.town)}`.trim(),
    `verified plot ${stripText(plot.county || plot.town)}`.trim(),
    "TST PlotConnect listing"
  ]).filter(Boolean);
}

function buildPlotSchema(plot, canonical, userUrl, description) {
  const schema = {
    "@context": "https://schema.org",
    "@type": "Accommodation",
    name: stripText(plot.title) || "Property listing",
    description,
    url: canonical,
    image: Array.isArray(plot.images) ? plot.images.filter(Boolean).slice(0, 3) : [],
    address: {
      "@type": "PostalAddress",
      addressCountry: stripText(plot.country || "Kenya"),
      addressLocality: stripText(plot.county || plot.town || ""),
      addressRegion: stripText(plot.area || plot.county || plot.town || "")
    },
    provider: {
      "@type": "Organization",
      name: SITE.name,
      url: SITE.url
    }
  };

  const price = Number(plot.price);
  if (Number.isFinite(price)) {
    schema.offers = {
      "@type": "Offer",
      price,
      priceCurrency: "KES",
      availability: "https://schema.org/InStock",
      url: userUrl
    };
  }

  return schema;
}

function renderPlotLandingHtml(plotEntry) {
  const {
    title,
    description,
    canonical,
    userUrl,
    keywords,
    image,
    plot
  } = plotEntry;

  const schema = buildPlotSchema(plot, canonical, userUrl, description);
  const location = [stripText(plot.area), stripText(plot.county || plot.town), stripText(plot.country || "Kenya")].filter(Boolean).join(", ");
  const detailRows = [
    ["Category", stripText(plot.category) || "Property"],
    ["Location", location || "Kenya"],
    ["Price", formatCurrency(plot.price)],
    ["Listing ID", stripText(plot.id)]
  ].filter(([, value]) => value);

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <title>${escapeHtml(title)}</title>
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <meta name="description" content="${escapeHtml(description)}">
  <meta name="author" content="${escapeHtml(SITE.author)}">
  <meta name="robots" content="index,follow,max-image-preview:large">
  <meta name="keywords" content="${escapeHtml(keywords.join(", "))}">
  <link rel="canonical" href="${escapeHtml(canonical)}">
  <meta property="og:type" content="website">
  <meta property="og:site_name" content="${escapeHtml(SITE.name)}">
  <meta property="og:locale" content="${escapeHtml(SITE.locale)}">
  <meta property="og:title" content="${escapeHtml(title)}">
  <meta property="og:description" content="${escapeHtml(description)}">
  <meta property="og:url" content="${escapeHtml(canonical)}">
  <meta property="og:image" content="${escapeHtml(image || absoluteUrl(SITE.image))}">
  <meta name="twitter:card" content="${escapeHtml(SITE.twitterCard)}">
  <meta name="twitter:title" content="${escapeHtml(title)}">
  <meta name="twitter:description" content="${escapeHtml(description)}">
  <meta name="twitter:image" content="${escapeHtml(image || absoluteUrl(SITE.image))}">
  <link rel="icon" type="image/svg+xml" href="${escapeHtml(SITE.image)}">
  <script type="application/ld+json">
${JSON.stringify(schema, null, 2)}
  </script>
  <style>
    :root {
      --bg: #f4f7fb;
      --surface: rgba(255,255,255,0.92);
      --border: rgba(96,122,161,0.22);
      --text: #10233f;
      --muted: #5a7394;
      --brand1: #0f6fbd;
      --brand2: #2aa88f;
      --shadow: 0 20px 40px rgba(16, 35, 63, 0.12);
    }
    * { box-sizing: border-box; }
    body {
      margin: 0;
      min-height: 100vh;
      font-family: "Segoe UI", Arial, sans-serif;
      color: var(--text);
      background:
        radial-gradient(900px 500px at 0% -10%, rgba(15,111,189,0.16) 0%, transparent 55%),
        radial-gradient(700px 400px at 100% 0%, rgba(42,168,143,0.15) 0%, transparent 60%),
        linear-gradient(160deg, #f7fbff 0%, var(--bg) 100%);
      display: grid;
      place-items: center;
      padding: 24px;
    }
    main {
      width: min(100%, 860px);
      background: var(--surface);
      border: 1px solid var(--border);
      border-radius: 28px;
      box-shadow: var(--shadow);
      overflow: hidden;
    }
    .hero {
      display: grid;
      gap: 24px;
      padding: 28px;
    }
    .eyebrow {
      margin: 0;
      text-transform: uppercase;
      letter-spacing: 0.16em;
      font-size: 0.74rem;
      font-weight: 800;
      color: var(--brand1);
    }
    h1 {
      margin: 10px 0 12px;
      font-size: clamp(2rem, 4vw, 3rem);
      line-height: 1.08;
    }
    p {
      margin: 0;
      line-height: 1.7;
      color: var(--muted);
    }
    .actions {
      display: flex;
      flex-wrap: wrap;
      gap: 12px;
      margin-top: 18px;
    }
    .button, .button-soft {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      min-height: 46px;
      padding: 0 18px;
      border-radius: 14px;
      text-decoration: none;
      font-weight: 700;
    }
    .button {
      color: #fff;
      background: linear-gradient(132deg, var(--brand1) 0%, var(--brand2) 100%);
      box-shadow: 0 12px 22px rgba(28, 95, 124, 0.2);
    }
    .button-soft {
      color: var(--text);
      background: #eef3fb;
      border: 1px solid #c2d3ea;
    }
    .grid {
      display: grid;
      gap: 18px;
      grid-template-columns: repeat(auto-fit, minmax(220px, 1fr));
      margin-top: 24px;
    }
    .card {
      padding: 18px;
      border-radius: 18px;
      border: 1px solid var(--border);
      background: rgba(255,255,255,0.85);
    }
    .label {
      display: block;
      margin-bottom: 8px;
      font-size: 0.76rem;
      font-weight: 800;
      letter-spacing: 0.12em;
      text-transform: uppercase;
      color: #41658f;
    }
    .value {
      font-weight: 700;
      color: var(--text);
    }
    .photo {
      width: 100%;
      height: 280px;
      object-fit: cover;
      border-radius: 22px;
      display: block;
      border: 1px solid var(--border);
      background: #eaf1fa;
    }
    .redirect-note {
      margin-top: 18px;
      font-size: 0.94rem;
      color: #335985;
    }
    @media (max-width: 680px) {
      .hero {
        padding: 20px;
      }
      .photo {
        height: 220px;
      }
    }
  </style>
  <script>
    window.addEventListener("DOMContentLoaded", function () {
      const target = ${JSON.stringify(userUrl)};
      const countdownEl = document.getElementById("redirect-seconds");
      let remaining = Math.max(1, Math.round(${PLOT_REDIRECT_DELAY_MS} / 1000));
      if (countdownEl) countdownEl.textContent = String(remaining);
      const timer = window.setInterval(function () {
        remaining = Math.max(0, remaining - 1);
        if (countdownEl) countdownEl.textContent = String(remaining);
        if (remaining <= 0) window.clearInterval(timer);
      }, 1000);
      window.setTimeout(function () {
        window.location.replace(target);
      }, ${PLOT_REDIRECT_DELAY_MS});
    });
  </script>
</head>
<body>
  <main>
    <div class="hero">
      <div>
        <p class="eyebrow">Verified Plot Listing</p>
        <h1>${escapeHtml(stripText(plot.title) || "Property listing on TST PlotConnect")}</h1>
        <p>${escapeHtml(description)}</p>
        <div class="actions">
          <a id="open-live-listing" class="button" href="${escapeHtml(userUrl)}">Open Live Listing</a>
          <a class="button-soft" href="${escapeHtml(SITE.url)}/#user-listings">Browse More Listings</a>
        </div>
        <p class="redirect-note">Redirecting to the live user listing page in <span id="redirect-seconds">1</span> second.</p>
      </div>
      ${image ? `<img class="photo" src="${escapeHtml(image)}" alt="${escapeHtml(stripText(plot.title) || "Plot image")}">` : ""}
      <div class="grid">
        ${detailRows.map(([label, value]) => `
        <div class="card">
          <span class="label">${escapeHtml(label)}</span>
          <span class="value">${escapeHtml(value)}</span>
        </div>`).join("")}
      </div>
      <div class="card">
        <span class="label">About This Listing</span>
        <p>${escapeHtml(stripText(plot.description) || "This verified property listing is available on TST PlotConnect. Open the live listing to view current search filters, nearby options, and map context.")}</p>
      </div>
    </div>
  </main>
</body>
</html>
`;
}

async function fetchJson(url, timeoutMs = 12000) {
  const controller = typeof AbortController !== "undefined" ? new AbortController() : null;
  const timeout = controller ? setTimeout(() => controller.abort(), timeoutMs) : null;

  try {
    const response = await fetch(url, {
      headers: { Accept: "application/json" },
      signal: controller ? controller.signal : undefined
    });

    if (!response.ok) {
      throw new Error(`Request failed (${response.status})`);
    }

    return await response.json();
  } finally {
    if (timeout) clearTimeout(timeout);
  }
}

async function loadLivePlots() {
  const candidates = dedupe([
    process.env.PLOTCONNECT_API_BASE,
    process.env.NEXT_PUBLIC_API_URL,
    "http://127.0.0.1:10000",
    "http://localhost:10000",
    "https://tstplotconnect-2.onrender.com"
  ]);

  let lastError = null;
  for (const base of candidates) {
    const normalized = String(base || "").replace(/\/+$/, "");
    if (!normalized) continue;
    try {
      const data = await fetchJson(`${normalized}/api/plots`);
      if (!Array.isArray(data)) {
        throw new Error("Invalid plots response");
      }
      return { plots: data, source: normalized };
    } catch (error) {
      lastError = error;
    }
  }

  return { plots: null, source: null, error: lastError };
}

function readPlotManifest() {
  try {
    const raw = fs.readFileSync(LISTINGS_MANIFEST_PATH, "utf8");
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed.entries) ? parsed.entries : [];
  } catch (_error) {
    return [];
  }
}

function buildPlotEntry(plot) {
  const pathName = buildPlotPath(plot);
  const slug = path.basename(pathName);
  const title = buildPlotTitle(plot);
  const description = buildPlotDescription(plot);
  const userUrl = buildUserListingUrl(plot);
  const canonical = absoluteUrl(pathName);
  const keywords = buildPlotKeywords(plot);
  const image = Array.isArray(plot.images) && plot.images[0] ? plot.images[0] : absoluteUrl(SITE.image);

  return {
    id: stripText(plot.id),
    slug,
    file: `${slug}.html`,
    path: pathName,
    title,
    description,
    canonical,
    userUrl,
    keywords,
    image,
    lastmod: toIsoDate(plot.updatedAt || plot.createdAt),
    changefreq: "daily",
    priority: 0.6,
    plot
  };
}

function syncPlotLandingPagesFromLiveData(plots) {
  fs.rmSync(LISTINGS_DIR, { recursive: true, force: true });
  fs.mkdirSync(LISTINGS_DIR, { recursive: true });

  const entries = plots
    .filter((plot) => plot && plot.id)
    .map(buildPlotEntry);

  entries.forEach((entry) => {
    const filePath = path.join(LISTINGS_DIR, entry.file);
    fs.writeFileSync(filePath, renderPlotLandingHtml(entry), "utf8");
  });

  fs.writeFileSync(
    LISTINGS_MANIFEST_PATH,
    JSON.stringify({
      generatedAt: new Date().toISOString(),
      entries: entries.map((entry) => ({
        id: entry.id,
        slug: entry.slug,
        file: entry.file,
        path: entry.path,
        title: entry.title,
        description: entry.description,
        lastmod: entry.lastmod,
        changefreq: entry.changefreq,
        priority: entry.priority
      }))
    }, null, 2),
    "utf8"
  );

  return entries;
}

async function syncPlotLandingPages() {
  const live = await loadLivePlots();
  if (Array.isArray(live.plots)) {
    return {
      entries: syncPlotLandingPagesFromLiveData(live.plots),
      source: live.source,
      cached: false
    };
  }

  const cachedEntries = readPlotManifest();
  return {
    entries: cachedEntries,
    source: live.source,
    cached: true,
    error: live.error
  };
}

function buildSitemapXml(plotEntries = []) {
  const entries = pages
    .filter((page) => page.includeInSitemap && page.path)
    .map((page) => ({
      path: page.path,
      lastmod: page.lastmod,
      changefreq: page.changefreq,
      priority: page.priority
    }))
    .concat(
      blogPosts.map((post) => ({
        path: `/blogs/${post.slug}`,
        lastmod: post.lastmod,
        changefreq: post.changefreq,
        priority: post.priority
      }))
    )
    .concat(
      plotEntries.map((entry) => ({
        path: entry.path,
        lastmod: entry.lastmod,
        changefreq: entry.changefreq,
        priority: entry.priority
      }))
    );

  const lines = ['<?xml version="1.0" encoding="UTF-8"?>', '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">'];
  entries.forEach((entry) => {
    lines.push("  <url>");
    lines.push(`    <loc>${xmlEscape(absoluteUrl(entry.path))}</loc>`);
    lines.push(`    <lastmod>${xmlEscape(entry.lastmod)}</lastmod>`);
    lines.push(`    <changefreq>${xmlEscape(entry.changefreq)}</changefreq>`);
    lines.push(`    <priority>${xmlEscape(formatPriority(entry.priority))}</priority>`);
    lines.push("  </url>");
  });
  lines.push("</urlset>");
  return `${lines.join("\n")}\n`;
}

function buildRobotsTxt() {
  const disallowPaths = new Set();
  pages
    .filter((page) => !page.includeInSitemap)
    .forEach((page) => {
      (page.disallowPaths || []).forEach((value) => disallowPaths.add(value));
    });

  const lines = [
    "User-agent: *",
    "Allow: /"
  ];

  [...disallowPaths].sort().forEach((entry) => {
    lines.push(`Disallow: ${entry}`);
  });

  lines.push("", `Sitemap: ${SITE.url}/sitemap.xml`, "");
  return lines.join("\n");
}

async function main() {
  const results = pages.map(syncHtmlPage);
  const plotSync = await syncPlotLandingPages();

  fs.writeFileSync(SITEMAP_PATH, buildSitemapXml(plotSync.entries), "utf8");
  fs.writeFileSync(ROBOTS_PATH, buildRobotsTxt(), "utf8");

  const warnings = results.filter((result) => !result.hasMain || !result.hasH1);
  console.log(`Synced SEO metadata for ${results.length} HTML files.`);
  console.log(`Generated ${path.relative(FRONTEND_DIR, SITEMAP_PATH)} and ${path.relative(FRONTEND_DIR, ROBOTS_PATH)}.`);

  if (plotSync.cached) {
    console.log(`Reused ${plotSync.entries.length} cached listing SEO pages.`);
    if (plotSync.error) {
      console.log(`Plot sync warning: ${plotSync.error.message || String(plotSync.error)}`);
    }
  } else {
    console.log(`Generated ${plotSync.entries.length} listing SEO pages from ${plotSync.source}.`);
  }

  if (warnings.length > 0) {
    console.log("Warnings:");
    warnings.forEach((warning) => {
      const parts = [];
      if (!warning.hasMain) parts.push("missing <main>");
      if (!warning.hasH1) parts.push("missing <h1>");
      console.log(`- ${warning.file}: ${parts.join(", ")}`);
    });
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
