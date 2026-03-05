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
const paginationEl = document.getElementById("blog-pagination");
const prevBtn = document.getElementById("blog-prev");
const nextBtn = document.getElementById("blog-next");
const pageInfo = document.getElementById("blog-page-info");
const tagButtons = Array.from(document.querySelectorAll(".blog-tag"));

const state = {
  page: 1,
  pages: 1,
  q: "",
  tag: ""
};

function formatDate(value) {
  if (!value) return "";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return "";
  return d.toLocaleDateString(undefined, { year: "numeric", month: "long", day: "numeric" });
}

function createCard(post) {
  const card = document.createElement("article");
  card.className = "glass rounded-2xl p-6 flex flex-col gap-3";

  const title = document.createElement("h2");
  title.className = "text-xl font-semibold";

  const link = document.createElement("a");
  link.href = `/blog-post.html?slug=${encodeURIComponent(post.slug)}`;
  link.className = "hover:text-emerald-300 transition-colors";
  link.textContent = post.title || "Untitled post";
  title.appendChild(link);

  const meta = document.createElement("p");
  meta.className = "text-xs text-slate-400";
  const date = formatDate(post.createdAt);
  meta.textContent = [post.author, date].filter(Boolean).join(" • ");

  const excerpt = document.createElement("p");
  excerpt.className = "text-slate-300";
  excerpt.textContent = post.excerpt || "";

  const readMore = document.createElement("a");
  readMore.href = link.href;
  readMore.className = "text-emerald-300 font-medium";
  readMore.textContent = "Read more →";

  card.appendChild(title);
  if (meta.textContent) card.appendChild(meta);
  if (excerpt.textContent) card.appendChild(excerpt);
  card.appendChild(readMore);

  return card;
}

function setActiveTag(tag) {
  tagButtons.forEach((btn) => {
    const active = btn.dataset.tag === tag;
    btn.classList.toggle("border-emerald-400", active);
    btn.classList.toggle("text-white", active);
  });
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
}

async function loadBlogs() {
  try {
    clearList();
    const params = new URLSearchParams();
    params.set("limit", "10");
    params.set("page", String(state.page));
    if (state.q) params.set("q", state.q);
    if (state.tag) params.set("tag", state.tag);

    const res = await fetch(`${API.replace(/\\/+$/, "")}/api/blog?${params.toString()}`);
    if (!res.ok) {
      throw new Error(`Failed to load blog posts (${res.status}).`);
    }
    const data = await res.json();
    const items = Array.isArray(data.items) ? data.items : [];
    state.pages = Number(data.pages || 1);
    if (items.length === 0) {
      emptyEl.classList.remove("hidden");
    } else {
      items.forEach((post) => listEl.appendChild(createCard(post)));
    }
    paginationEl.classList.toggle("hidden", state.pages <= 1);
    pageInfo.textContent = `Page ${state.page} of ${state.pages}`;
    prevBtn.disabled = state.page <= 1;
    nextBtn.disabled = state.page >= state.pages;
  } catch (err) {
    errorEl.textContent = err.message || "Failed to load blog posts.";
    errorEl.classList.remove("hidden");
  } finally {
    loadingEl.classList.add("hidden");
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
  searchBtn.addEventListener("click", () => {
    state.q = String(searchInput.value || "").trim();
    state.page = 1;
    syncUrl();
    loadBlogs();
  });
}

if (searchInput) {
  searchInput.addEventListener("keydown", (event) => {
    if (event.key === "Enter") {
      state.q = String(searchInput.value || "").trim();
      state.page = 1;
      syncUrl();
      loadBlogs();
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

initFromUrl();
loadBlogs();
