const DEFAULT_API_BASE = "https://tstplotconnect-2.onrender.com";
const API = (typeof process !== "undefined" && process.env && process.env.NEXT_PUBLIC_API_URL)
  || (typeof window !== "undefined" && window.NEXT_PUBLIC_API_URL)
  || DEFAULT_API_BASE;

const listEl = document.getElementById("blog-list");
const loadingEl = document.getElementById("blog-loading");
const errorEl = document.getElementById("blog-error");
const emptyEl = document.getElementById("blog-empty");
const searchInput = document.getElementById("blog-search-input");
const searchBtn = document.getElementById("blog-search-btn");
const resetBtn = document.getElementById("blog-reset-btn");
const paginationEl = document.getElementById("blog-pagination");
const prevBtn = document.getElementById("blog-prev");
const nextBtn = document.getElementById("blog-next");
const pageInfo = document.getElementById("blog-page-info");
const resultsSummaryEl = document.getElementById("blog-results-summary");
const totalCountEl = document.getElementById("blog-total-count");
const tagButtons = Array.from(document.querySelectorAll(".blog-tag"));

const numberFormatter = new Intl.NumberFormat();

const state = {
  page: 1,
  pages: 1,
  total: 0,
  visibleCount: 0,
  q: "",
  tag: ""
};

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

function toExcerpt(text, max = 170) {
  const clean = String(text || "").replace(/\s+/g, " ").trim();
  if (!clean) return "";
  return clean.length > max ? `${clean.slice(0, max - 1)}...` : clean;
}

function estimateReadTime(content, excerpt) {
  const source = String(content || excerpt || "").trim();
  if (!source) return "1 min read";
  const words = source.split(/\s+/).filter(Boolean).length;
  const minutes = Math.max(1, Math.round(words / 180));
  return `${minutes} min read`;
}

function setControlsDisabled(disabled) {
  if (searchInput) searchInput.disabled = disabled;
  if (searchBtn) searchBtn.disabled = disabled;
  if (resetBtn) resetBtn.disabled = disabled;
  tagButtons.forEach((btn) => {
    btn.disabled = disabled;
  });
  prevBtn.disabled = disabled || state.page <= 1;
  nextBtn.disabled = disabled || state.page >= state.pages;
}

function createTagChip(tag) {
  const chip = document.createElement("span");
  chip.className = "blog-card-tag";
  chip.textContent = formatTag(tag);
  return chip;
}

function createCard(post) {
  const card = document.createElement("article");
  card.className = "blog-card";

  const header = document.createElement("div");
  header.className = "blog-card-header";

  const tagsWrap = document.createElement("div");
  tagsWrap.className = "blog-card-tags";
  const tags = Array.isArray(post.tags) && post.tags.length > 0 ? post.tags.slice(0, 3) : ["guides"];
  tags.forEach((tag) => tagsWrap.appendChild(createTagChip(tag)));

  const date = document.createElement("span");
  date.className = "blog-card-date";
  date.textContent = formatDate(post.createdAt) || "Recently published";

  header.appendChild(tagsWrap);
  header.appendChild(date);

  const title = document.createElement("h2");
  title.className = "blog-card-title";

  const link = document.createElement("a");
  link.href = post.slug ? `/blogs/${encodeURIComponent(post.slug)}` : "/blogs";
  link.textContent = post.title || "Untitled post";
  title.appendChild(link);

  const excerpt = document.createElement("p");
  excerpt.className = "blog-card-excerpt";
  excerpt.textContent = post.excerpt || toExcerpt(post.content) || "Helpful rental guidance from TST PlotConnect.";

  const footer = document.createElement("div");
  footer.className = "blog-card-footer";

  const meta = document.createElement("p");
  meta.className = "blog-card-meta";
  meta.textContent = [
    post.author || "TST PlotConnect",
    estimateReadTime(post.content, post.excerpt)
  ].filter(Boolean).join(" - ");

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

  return card;
}

function setActiveTag(tag) {
  tagButtons.forEach((btn) => {
    const active = btn.dataset.tag === tag;
    btn.classList.toggle("is-active", active);
    btn.setAttribute("aria-pressed", String(active));
  });
}

function updateResultsSummary() {
  if (!resultsSummaryEl) return;

  const filters = [];
  if (state.tag) filters.push(`tagged ${formatTag(state.tag)}`);
  if (state.q) filters.push(`matching "${state.q}"`);

  if (state.total === 0) {
    resultsSummaryEl.textContent = filters.length
      ? `No guides ${filters.join(" and ")} yet.`
      : "No guides published yet.";
    return;
  }

  const start = (state.page - 1) * 10 + 1;
  const end = start + Math.max(state.visibleCount - 1, 0);
  const summary = `Showing ${numberFormatter.format(start)}-${numberFormatter.format(end)} of ${numberFormatter.format(state.total)} guides`;
  resultsSummaryEl.textContent = filters.length ? `${summary}, ${filters.join(" and ")}.` : `${summary}.`;
}

function syncUrl() {
  const params = new URLSearchParams();
  if (state.page > 1) params.set("page", String(state.page));
  if (state.q) params.set("q", state.q);
  if (state.tag) params.set("tag", state.tag);
  const next = `${window.location.pathname}${params.toString() ? `?${params}` : ""}`;
  window.history.replaceState(null, "", next);
}

function clearList() {
  listEl.innerHTML = "";
  errorEl.classList.add("hidden");
  emptyEl.classList.add("hidden");
  loadingEl.classList.remove("hidden");
  paginationEl.classList.add("hidden");
  pageInfo.textContent = "";
  if (resultsSummaryEl) resultsSummaryEl.textContent = "Loading posts...";
}

async function loadBlogs() {
  clearList();
  setControlsDisabled(true);

  try {
    const params = new URLSearchParams();
    params.set("limit", "10");
    params.set("page", String(state.page));
    if (state.q) params.set("q", state.q);
    if (state.tag) params.set("tag", state.tag);

    const res = await fetch(`${API.replace(/\/+$/, "")}/api/blog?${params.toString()}`);
    if (!res.ok) {
      throw new Error(`Failed to load blog posts (${res.status}).`);
    }

    const data = await res.json();
    const items = Array.isArray(data.items) ? data.items : [];
    state.pages = Number(data.pages || 1);
    state.total = Number(data.total || items.length || 0);
    state.visibleCount = items.length;

    if (state.page > state.pages) {
      state.page = state.pages;
      syncUrl();
      return loadBlogs();
    }

    totalCountEl.textContent = numberFormatter.format(state.total);
    updateResultsSummary();

    if (items.length === 0) {
      emptyEl.classList.remove("hidden");
    } else {
      items.forEach((post) => listEl.appendChild(createCard(post)));
    }

    paginationEl.classList.toggle("hidden", state.pages <= 1);
    pageInfo.textContent = `Page ${state.page} of ${state.pages}`;
  } catch (err) {
    state.total = 0;
    state.visibleCount = 0;
    totalCountEl.textContent = "0";
    updateResultsSummary();
    errorEl.textContent = err.message || "Failed to load blog posts.";
    errorEl.classList.remove("hidden");
  } finally {
    loadingEl.classList.add("hidden");
    setControlsDisabled(false);
  }
}

function initFromUrl() {
  const params = new URLSearchParams(window.location.search);
  state.page = Math.max(1, Number(params.get("page") || 1));
  state.q = String(params.get("q") || "").trim();
  state.tag = String(params.get("tag") || "").trim();
  if (searchInput) searchInput.value = state.q;
  setActiveTag(state.tag);
}

function runSearch() {
  state.q = String(searchInput?.value || "").trim();
  state.page = 1;
  syncUrl();
  loadBlogs();
}

function resetFilters() {
  state.page = 1;
  state.q = "";
  state.tag = "";
  if (searchInput) searchInput.value = "";
  setActiveTag(state.tag);
  syncUrl();
  loadBlogs();
}

tagButtons.forEach((btn) => {
  btn.addEventListener("click", () => {
    state.tag = btn.dataset.tag || "";
    state.page = 1;
    setActiveTag(state.tag);
    syncUrl();
    loadBlogs();
  });
});

if (searchBtn) {
  searchBtn.addEventListener("click", runSearch);
}

if (resetBtn) {
  resetBtn.addEventListener("click", resetFilters);
}

if (searchInput) {
  searchInput.addEventListener("keydown", (event) => {
    if (event.key === "Enter") {
      runSearch();
    }
  });
}

prevBtn.addEventListener("click", () => {
  if (state.page > 1) {
    state.page -= 1;
    syncUrl();
    loadBlogs();
  }
});

nextBtn.addEventListener("click", () => {
  if (state.page < state.pages) {
    state.page += 1;
    syncUrl();
    loadBlogs();
  }
});

window.addEventListener("popstate", () => {
  initFromUrl();
  loadBlogs();
});

initFromUrl();
loadBlogs();
