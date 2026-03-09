const DEFAULT_API_BASE = "https://tstplotconnect-2.onrender.com";
const API = (typeof process !== "undefined" && process.env && process.env.NEXT_PUBLIC_API_URL)
  || (typeof window !== "undefined" && window.NEXT_PUBLIC_API_URL)
  || DEFAULT_API_BASE;

const titleEl = document.getElementById("post-title");
const metaEl = document.getElementById("post-meta");
const contentEl = document.getElementById("post-content");
const errorEl = document.getElementById("post-error");

const metaDescription = document.getElementById("meta-description");
const ogTitle = document.getElementById("og-title");
const ogDescription = document.getElementById("og-description");
const ogUrl = document.getElementById("og-url");
const twitterTitle = document.getElementById("twitter-title");
const twitterDescription = document.getElementById("twitter-description");
const canonicalLink = document.getElementById("canonical-link");
const schemaEl = document.getElementById("post-schema");
const relatedEl = document.getElementById("related-posts");

function formatDate(value) {
  if (!value) return "";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return "";
  return d.toLocaleDateString(undefined, { year: "numeric", month: "long", day: "numeric" });
}

function toExcerpt(text, max = 160) {
  const clean = String(text || "").replace(/\s+/g, " ").trim();
  if (!clean) return "";
  return clean.length > max ? `${clean.slice(0, max - 1)}...` : clean;
}

function setMeta(title, description, slug) {
  document.title = `${title} | TST PlotConnect`;
  if (metaDescription) metaDescription.setAttribute("content", description);
  if (ogTitle) ogTitle.setAttribute("content", document.title);
  if (ogDescription) ogDescription.setAttribute("content", description);
  if (twitterTitle) twitterTitle.setAttribute("content", document.title);
  if (twitterDescription) twitterDescription.setAttribute("content", description);

  if (slug) {
    const origin = window.location.origin || "https://www.tst-plotconnect.com";
    const canonical = `${origin}/blog-post.html?slug=${encodeURIComponent(slug)}`;
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
  const canonical = `${origin}/blog-post.html?slug=${encodeURIComponent(post.slug)}`;
  const schema = {
    "@context": "https://schema.org",
    "@type": "BlogPosting",
    headline: post.title,
    datePublished: post.createdAt,
    dateModified: post.updatedAt || post.createdAt,
    author: {
      "@type": "Person",
      name: post.author || "TST PlotConnect"
    },
    publisher: {
      "@type": "Organization",
      name: "TST PlotConnect",
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
    card.className = "glass rounded-2xl p-4";

    const title = document.createElement("h3");
    title.className = "font-semibold";
    const link = document.createElement("a");
    link.href = `/blog-post.html?slug=${encodeURIComponent(post.slug)}`;
    link.className = "hover:text-emerald-700 transition-colors";
    link.textContent = post.title || "Untitled post";
    title.appendChild(link);

    const excerpt = document.createElement("p");
    excerpt.className = "text-slate-700 mt-2 text-sm";
    excerpt.textContent = post.excerpt || "";

    card.appendChild(title);
    if (excerpt.textContent) card.appendChild(excerpt);
    relatedEl.appendChild(card);
  });
}

async function loadPost() {
  const params = new URLSearchParams(window.location.search);
  const slug = params.get("slug");
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
    renderContent(post.content);
    const description = post.excerpt || toExcerpt(post.content);
    setMeta(post.title || "Blog Post", description, post.slug);
    setSchema(post);

    const tag = Array.isArray(post.tags) ? post.tags[0] : "";
    if (tag) {
      const relRes = await fetch(`${API.replace(/\/+$/, "")}/api/blog?limit=3&tag=${encodeURIComponent(tag)}`);
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
