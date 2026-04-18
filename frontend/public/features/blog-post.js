const DEFAULT_API_BASE = "https://tstplotconnect-2.onrender.com";
const API = (typeof process !== "undefined" && process.env && process.env.NEXT_PUBLIC_API_URL)
  || (typeof window !== "undefined" && window.NEXT_PUBLIC_API_URL)
  || DEFAULT_API_BASE;

const titleEl = document.getElementById("post-title");
const metaEl = document.getElementById("post-meta");
const contentEl = document.getElementById("post-content");
const errorEl = document.getElementById("post-error");

const metaDescription = document.getElementById("meta-description") || document.querySelector('meta[name="description"]');
const ogTitle = document.getElementById("og-title") || document.querySelector('meta[property="og:title"]');
const ogDescription = document.getElementById("og-description") || document.querySelector('meta[property="og:description"]');
const ogUrl = document.getElementById("og-url") || document.querySelector('meta[property="og:url"]');
const twitterTitle = document.getElementById("twitter-title") || document.querySelector('meta[name="twitter:title"]');
const twitterDescription = document.getElementById("twitter-description") || document.querySelector('meta[name="twitter:description"]');
const canonicalLink = document.getElementById("canonical-link") || document.querySelector('link[rel="canonical"]');
const schemaEl = document.getElementById("post-schema");
const relatedEl = document.getElementById("related-posts");

function formatDate(value) {
  if (!value) return "";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return "";
  return d.toLocaleDateString(undefined, { year: "numeric", month: "long", day: "numeric" });
}

function formatTag(tag) {
  return String(tag || "")
    .replace(/[-_]+/g, " ")
    .trim()
    .replace(/\b\w/g, (char) => char.toUpperCase());
}

function toExcerpt(text, max = 160) {
  const clean = String(text || "").replace(/\s+/g, " ").trim();
  if (!clean) return "";
  return clean.length > max ? `${clean.slice(0, max - 1)}...` : clean;
}

function getSlugFromLocation() {
  const parts = window.location.pathname
    .split("/")
    .map((part) => part.trim())
    .filter(Boolean);

  if (parts[0] === "blogs" && parts[1]) {
    return decodeURIComponent(parts.slice(1).join("/"));
  }

  const params = new URLSearchParams(window.location.search);
  return params.get("slug");
}

function setMeta(title, description, slug) {
  document.title = `${title} | AfricaRentalGrid`;
  if (metaDescription) metaDescription.setAttribute("content", description);
  if (ogTitle) ogTitle.setAttribute("content", document.title);
  if (ogDescription) ogDescription.setAttribute("content", description);
  if (twitterTitle) twitterTitle.setAttribute("content", document.title);
  if (twitterDescription) twitterDescription.setAttribute("content", description);

  if (slug) {
    const origin = window.location.origin || "https://www.tst-plotconnect.com";
    const canonical = `${origin}/blogs/${encodeURIComponent(slug)}`;
    if (canonicalLink) canonicalLink.setAttribute("href", canonical);
    if (ogUrl) ogUrl.setAttribute("content", canonical);
  }
}

function renderContent(content) {
  contentEl.innerHTML = "";
  const parts = String(content || "")
    .split(/\n{2,}/)
    .map((p) => p.trim())
    .filter(Boolean);

  if (parts.length === 0) {
    const empty = document.createElement("p");
    empty.textContent = "No content available.";
    contentEl.appendChild(empty);
    return;
  }

  parts.forEach((part) => {
    const p = document.createElement("p");
    p.textContent = part;
    contentEl.appendChild(p);
  });
}

function setSchema(post) {
  if (!schemaEl || !post) return;
  const origin = window.location.origin || "https://www.tst-plotconnect.com";
  const canonical = `${origin}/blogs/${encodeURIComponent(post.slug)}`;
  const schema = {
    "@context": "https://schema.org",
    "@type": "BlogPosting",
    headline: post.title,
    datePublished: post.createdAt,
    dateModified: post.updatedAt || post.createdAt,
    author: {
      "@type": "Person",
      name: post.author || "AfricaRentalGrid"
    },
    publisher: {
      "@type": "Organization",
      name: "AfricaRentalGrid",
      logo: {
        "@type": "ImageObject",
        url: "https://www.tst-plotconnect.com/favicon.svg"
      }
    },
    mainEntityOfPage: canonical,
    url: canonical
  };
  schemaEl.textContent = JSON.stringify(schema);
}

function renderRelated(posts, currentSlug) {
  if (!relatedEl) return;
  relatedEl.innerHTML = "";
  const filtered = posts.filter((p) => p.slug && p.slug !== currentSlug).slice(0, 2);
  if (filtered.length === 0) {
    const empty = document.createElement("p");
    empty.className = "text-slate-700";
    empty.textContent = "No related posts yet.";
    relatedEl.appendChild(empty);
    return;
  }

  filtered.forEach((post) => {
    const card = document.createElement("article");
    card.className = "blog-card";

    const header = document.createElement("div");
    header.className = "blog-card-header";

    const tagsWrap = document.createElement("div");
    tagsWrap.className = "blog-card-tags";
    const tagList = Array.isArray(post.tags) && post.tags.length > 0 ? post.tags.slice(0, 2) : ["guides"];
    tagList.forEach((tag) => {
      const chip = document.createElement("span");
      chip.className = "blog-card-tag";
      chip.textContent = formatTag(tag);
      tagsWrap.appendChild(chip);
    });

    const date = document.createElement("span");
    date.className = "blog-card-date";
    date.textContent = formatDate(post.createdAt) || "Recently published";

    header.appendChild(tagsWrap);
    header.appendChild(date);

    const title = document.createElement("h3");
    title.className = "blog-card-title";
    const link = document.createElement("a");
    link.href = `/blogs/${encodeURIComponent(post.slug)}`;
    link.textContent = post.title || "Untitled post";
    title.appendChild(link);

    const excerpt = document.createElement("p");
    excerpt.className = "blog-card-excerpt";
    excerpt.textContent = post.excerpt || "More rental guidance from AfricaRentalGrid.";

    const footer = document.createElement("div");
    footer.className = "blog-card-footer";

    const meta = document.createElement("p");
    meta.className = "blog-card-meta";
    meta.textContent = post.author || "AfricaRentalGrid";

    const readMore = document.createElement("a");
    readMore.href = link.href;
    readMore.className = "blog-card-link";
    readMore.textContent = "Read article";

    card.appendChild(header);
    card.appendChild(title);
    card.appendChild(excerpt);
    footer.appendChild(meta);
    footer.appendChild(readMore);
    card.appendChild(footer);
    relatedEl.appendChild(card);
  });
}

async function loadPost() {
  const slug = getSlugFromLocation();
  if (!slug) {
    errorEl.textContent = "Missing blog slug in the URL.";
    errorEl.classList.remove("hidden");
    titleEl.textContent = "Blog post not found";
    return;
  }

  try {
    const res = await fetch(`${API.replace(/\/+$/, "")}/api/blog/${encodeURIComponent(slug)}`);
    if (!res.ok) {
      throw new Error(`Blog post not found (${res.status}).`);
    }
    const post = await res.json();
    titleEl.textContent = post.title || "Untitled post";
    const date = formatDate(post.createdAt);
    metaEl.textContent = [post.author, date].filter(Boolean).join(" - ");
    const firstTag = Array.isArray(post.tags) ? post.tags[0] : "";
    const kickerEl = document.getElementById("post-kicker");
    if (kickerEl) {
      kickerEl.textContent = firstTag ? formatTag(firstTag) : "Blog Post";
    }
    renderContent(post.content);
    const description = post.excerpt || toExcerpt(post.content);
    setMeta(post.title || "Blog Post", description, post.slug);
    setSchema(post);

    if (firstTag) {
      const relRes = await fetch(`${API.replace(/\/+$/, "")}/api/blog?limit=3&tag=${encodeURIComponent(firstTag)}`);
      if (relRes.ok) {
        const relData = await relRes.json();
        const relItems = Array.isArray(relData.items) ? relData.items : [];
        renderRelated(relItems, post.slug);
      }
    }
  } catch (err) {
    errorEl.textContent = err.message || "Failed to load blog post.";
    errorEl.classList.remove("hidden");
    titleEl.textContent = "Blog post not found";
  }
}

loadPost();
