const DEFAULT_API_BASE = "https://tstplotconnect-2.onrender.com";
const API = (typeof process !== "undefined" && process.env && process.env.NEXT_PUBLIC_API_URL)
  || (typeof window !== "undefined" && window.NEXT_PUBLIC_API_URL)
  || DEFAULT_API_BASE;

const loginSection = document.getElementById("admin-login");
const dashboardSection = document.getElementById("blog-dashboard");
const loginBtn = document.getElementById("admin-login-btn");
const loginError = document.getElementById("admin-login-error");
const phoneInput = document.getElementById("admin-phone");
const passwordInput = document.getElementById("admin-password");

const postsEl = document.getElementById("admin-posts");
const searchInput = document.getElementById("admin-search");
const searchBtn = document.getElementById("admin-search-btn");

const postIdInput = document.getElementById("post-id");
const postTitleInput = document.getElementById("post-title");
const postSlugInput = document.getElementById("post-slug");
const postAuthorInput = document.getElementById("post-author");
const postTagsInput = document.getElementById("post-tags");
const postExcerptInput = document.getElementById("post-excerpt");
const postContentInput = document.getElementById("post-content");
const postSaveBtn = document.getElementById("post-save");
const postResetBtn = document.getElementById("post-reset");
const postMessage = document.getElementById("post-message");

let token = localStorage.getItem("blogAdminToken") || "";
let currentQuery = "";

function showLoginError(text) {
  loginError.textContent = text;
  loginError.classList.remove("hidden");
}

function clearLoginError() {
  loginError.classList.add("hidden");
  loginError.textContent = "";
}

function setAuthState(authenticated) {
  loginSection.classList.toggle("hidden", authenticated);
  dashboardSection.classList.toggle("hidden", !authenticated);
}

async function api(path, options = {}) {
  const url = `${API.replace(/\\/+$/, "")}${path.startsWith("/") ? path : `/${path}`}`;
  const headers = {
    "Content-Type": "application/json",
    ...(token ? { Authorization: `Bearer ${token}` } : {})
  };
  const res = await fetch(url, { ...options, headers });
  if (res.status === 204) return null;
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    const err = new Error(data.error || `Request failed (${res.status}).`);
    err.status = res.status;
    throw err;
  }
  return data;
}

async function login() {
  clearLoginError();
  const phone = String(phoneInput.value || "").trim();
  const password = String(passwordInput.value || "").trim();
  if (!phone || !password) {
    showLoginError("Phone and password are required.");
    return;
  }

  try {
    const data = await api("/api/login", {
      method: "POST",
      body: JSON.stringify({ phone, password })
    });
    if (!data.user || !data.user.isAdmin) {
      showLoginError("This account is not admin.");
      return;
    }
    token = data.token;
    localStorage.setItem("blogAdminToken", token);
    localStorage.setItem("blogAdminPhone", phone);
    setAuthState(true);
    await loadPosts();
  } catch (err) {
    showLoginError(err.message || "Login failed.");
  }
}

function setMessage(text, isError = false) {
  postMessage.textContent = text;
  postMessage.className = `mt-3 text-sm ${isError ? "text-red-400" : "text-emerald-300"}`;
}

function resetForm() {
  postIdInput.value = "";
  postTitleInput.value = "";
  postSlugInput.value = "";
  postAuthorInput.value = "";
  postTagsInput.value = "";
  postExcerptInput.value = "";
  postContentInput.value = "";
  setMessage("");
}

function renderPosts(items) {
  postsEl.innerHTML = "";
  if (!items.length) {
    const empty = document.createElement("p");
    empty.className = "text-slate-300";
    empty.textContent = "No posts found.";
    postsEl.appendChild(empty);
    return;
  }

  items.forEach((post) => {
    const card = document.createElement("div");
    card.className = "glass rounded-2xl p-4";

    const title = document.createElement("h3");
    title.className = "font-semibold";
    title.textContent = post.title || "Untitled";

    const meta = document.createElement("p");
    meta.className = "text-xs text-slate-400 mt-1";
    meta.textContent = `${post.slug || ""} • ${post.author || ""}`;

    const excerpt = document.createElement("p");
    excerpt.className = "text-slate-300 text-sm mt-2";
    excerpt.textContent = post.excerpt || "";

    const actions = document.createElement("div");
    actions.className = "flex gap-2 mt-3";

    const editBtn = document.createElement("button");
    editBtn.className = "btn-soft px-3 py-1 rounded-xl";
    editBtn.textContent = "Edit";
    editBtn.addEventListener("click", () => fillForm(post));

    const deleteBtn = document.createElement("button");
    deleteBtn.className = "btn-soft px-3 py-1 rounded-xl";
    deleteBtn.textContent = "Delete";
    deleteBtn.addEventListener("click", () => deletePost(post));

    actions.appendChild(editBtn);
    actions.appendChild(deleteBtn);

    card.appendChild(title);
    card.appendChild(meta);
    card.appendChild(excerpt);
    card.appendChild(actions);
    postsEl.appendChild(card);
  });
}

function fillForm(post) {
  postIdInput.value = post.id || "";
  postTitleInput.value = post.title || "";
  postSlugInput.value = post.slug || "";
  postAuthorInput.value = post.author || "";
  postTagsInput.value = Array.isArray(post.tags) ? post.tags.join(", ") : "";
  postExcerptInput.value = post.excerpt || "";
  postContentInput.value = post.content || "";
  setMessage("Editing post. Update fields and click Save.");
}

async function loadPosts() {
  try {
    const params = new URLSearchParams();
    params.set("limit", "50");
    if (currentQuery) params.set("q", currentQuery);
    const data = await api(`/api/admin/blog?${params.toString()}`);
    renderPosts(Array.isArray(data.items) ? data.items : []);
  } catch (err) {
    renderPosts([]);
    setMessage(err.message || "Failed to load posts.", true);
  }
}

async function savePost() {
  const id = String(postIdInput.value || "").trim();
  const payload = {
    title: String(postTitleInput.value || "").trim(),
    slug: String(postSlugInput.value || "").trim(),
    author: String(postAuthorInput.value || "").trim(),
    excerpt: String(postExcerptInput.value || "").trim(),
    content: String(postContentInput.value || "").trim(),
    tags: String(postTagsInput.value || "")
      .split(",")
      .map((t) => t.trim())
      .filter(Boolean)
  };

  if (!payload.title || !payload.content) {
    setMessage("Title and content are required.", true);
    return;
  }

  try {
    if (id) {
      await api(`/api/admin/blog/${encodeURIComponent(id)}`, {
        method: "PUT",
        body: JSON.stringify(payload)
      });
      setMessage("Post updated.");
    } else {
      await api("/api/admin/blog", {
        method: "POST",
        body: JSON.stringify(payload)
      });
      setMessage("Post created.");
    }
    await loadPosts();
    resetForm();
  } catch (err) {
    setMessage(err.message || "Failed to save post.", true);
  }
}

async function deletePost(post) {
  if (!post || !post.id) return;
  if (!window.confirm("Delete this post?")) return;
  try {
    await api(`/api/admin/blog/${encodeURIComponent(post.id)}`, { method: "DELETE" });
    setMessage("Post deleted.");
    await loadPosts();
  } catch (err) {
    setMessage(err.message || "Failed to delete post.", true);
  }
}

loginBtn.addEventListener("click", login);
postSaveBtn.addEventListener("click", savePost);
postResetBtn.addEventListener("click", resetForm);

searchBtn.addEventListener("click", () => {
  currentQuery = String(searchInput.value || "").trim();
  loadPosts();
});

searchInput.addEventListener("keydown", (event) => {
  if (event.key === "Enter") {
    currentQuery = String(searchInput.value || "").trim();
    loadPosts();
  }
});

if (token) {
  setAuthState(true);
  loadPosts();
} else {
  setAuthState(false);
  const savedPhone = localStorage.getItem("blogAdminPhone") || "";
  if (savedPhone) phoneInput.value = savedPhone;
}
