import React, { useEffect, useMemo, useRef, useState } from "https://esm.sh/react@18.2.0";
import { createRoot } from "https://esm.sh/react-dom@18.2.0/client";
import htm from "https://esm.sh/htm@3.1.1";

const html = htm.bind(React.createElement);
const DEFAULT_API_BASE = "https://tstplotconnect-2.onrender.com";
const API = (typeof process !== "undefined" && process.env && process.env.NEXT_PUBLIC_API_URL)
  || (typeof window !== "undefined" && window.NEXT_PUBLIC_API_URL)
  || DEFAULT_API_BASE;
const DEFAULT_SUPER_ADMIN_PHONE = "0700000000";
const PORTAL_ROLE = "admin";
const ALTERNATE_PORTAL_PATH = "/superadmin";

function inferApiBase() {
  const loc = window.location;
  const isLocalHost = /^(localhost|127\.0\.0\.1|192\.168\.\d{1,3}\.\d{1,3}|10\.\d{1,3}\.\d{1,3}\.\d{1,3}|172\.(1[6-9]|2\d|3[0-1])\.\d{1,3}\.\d{1,3})$/i.test(loc.hostname);
  const isLocal = loc.protocol === "file:" || isLocalHost;
  if (isLocal) {
    localStorage.removeItem("apiBase");
    return API;
  }
  const saved = localStorage.getItem("apiBase");
  return saved || API;
}

function formatDate(value) {
  if (!value) return "-";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return "-";
  return d.toLocaleString();
}

function commaUrls(text) {
  return String(text || "")
    .split(",")
    .map((x) => x.trim())
    .filter(Boolean);
}

function csvSafe(value) {
  if (value === null || value === undefined) return "";
  const raw = String(value);
  if (/[",\n\r]/.test(raw)) {
    return `"${raw.replace(/"/g, "\"\"")}"`;
  }
  return raw;
}

function buildCsv(headers, rows) {
  const headerRow = headers.map((h) => csvSafe(h.label)).join(",");
  const body = rows.map((row) => headers.map((h) => csvSafe(h.value(row))).join(","));
  return [headerRow, ...body].join("\r\n");
}

function triggerDownload(filename, content, mimeType) {
  const blob = new Blob([content], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

function App() {
  const ADMIN_MOBILE_NAV_BREAKPOINT = 900;
  const [apiBaseInput, setApiBaseInput] = useState(inferApiBase());
  const [detectedApiBase, setDetectedApiBase] = useState(null);
  const [token, setToken] = useState("");
  const [isAdminAuthenticated, setIsAdminAuthenticated] = useState(false);
  const [isSuperAdmin, setIsSuperAdmin] = useState(false);
  const [message, setMessage] = useState({ text: "", error: false });
  const messageTimerRef = useRef(null);
  const [plots, setPlots] = useState([]);
  const [users, setUsers] = useState([]);
  const [payments, setPayments] = useState([]);
  const [activeAccounts, setActiveAccounts] = useState([]);
  const [adminAccounts, setAdminAccounts] = useState([]);
  const [locationMeta, setLocationMeta] = useState({ countries: [], countiesByCountry: {}, areasByCounty: {} });
  const [analytics, setAnalytics] = useState(null);
  const [busy, setBusy] = useState(false);
  const [manualActivateUserId, setManualActivateUserId] = useState("");
  const [newAdminPhone, setNewAdminPhone] = useState("");
  const [newAdminPassword, setNewAdminPassword] = useState("");
  const [selectedAdminId, setSelectedAdminId] = useState("");
  const [resetAdminPasswordValue, setResetAdminPasswordValue] = useState("");
  const [issuedPassword, setIssuedPassword] = useState("");
  const [newCountyCountry, setNewCountyCountry] = useState("Kenya");
  const [newCountyName, setNewCountyName] = useState("");
  const [newAreaCounty, setNewAreaCounty] = useState("");
  const [newAreaName, setNewAreaName] = useState("");

  const [adminPhone, setAdminPhone] = useState("");
  const [adminPassword, setAdminPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [rememberMe, setRememberMe] = useState(true);
  const [showForgotHelp, setShowForgotHelp] = useState(false);
  const [forgotPhone, setForgotPhone] = useState(DEFAULT_SUPER_ADMIN_PHONE);
  const [forgotCode, setForgotCode] = useState("");
  const [forgotNewPassword, setForgotNewPassword] = useState("");
  const [forgotExpiresAt, setForgotExpiresAt] = useState("");
  const [activeNav, setActiveNav] = useState("dashboard-home");
  const [isMobileNavOpen, setIsMobileNavOpen] = useState(false);

  const [plotForm, setPlotForm] = useState({
    title: "",
    price: "",
    category: "",
    town: "",
    area: "",
    caretaker: "",
    whatsapp: "",
    description: "",
    images: "",
    videos: ""
  });

  const apiBase = useMemo(
    () => (apiBaseInput || "").trim() || detectedApiBase || inferApiBase(),
    [apiBaseInput, detectedApiBase]
  );

  useEffect(() => {
    localStorage.removeItem("adminToken");
    setToken("");
    setIsAdminAuthenticated(false);
    const savedPhone = localStorage.getItem("adminLoginPhone") || "";
    if (savedPhone) {
      setAdminPhone(savedPhone);
      setRememberMe(true);
    }
  }, []);

  useEffect(() => {
    localStorage.setItem("apiBase", apiBase);
  }, [apiBase]);

  function showMessage(text, error = false) {
    setMessage({ text, error });
    if (messageTimerRef.current) clearTimeout(messageTimerRef.current);
    if (text) {
      messageTimerRef.current = setTimeout(() => {
        setMessage({ text: "", error: false });
      }, 4000);
    }
  }

  async function api(path, options = {}, authToken = null) {
    const url = `${apiBase.replace(/\/+$/, "")}${String(path).startsWith("/") ? path : `/${path}`}`;
    const headers = {
      "Content-Type": "application/json",
      ...((authToken || token) ? { Authorization: `Bearer ${authToken || token}` } : {}),
      ...(options.headers || {})
    };

    let res;
    try {
      res = await fetch(url, { ...options, headers });
    } catch (_err) {
      throw new Error(`Cannot reach backend at ${apiBase}. Start server or fix Backend URL.`);
    }

    if (res.status === 204) return null;
    const raw = await res.text();
    let data = {};
    try {
      data = raw ? JSON.parse(raw) : {};
    } catch (_err) {
      data = {};
    }
    if (!res.ok) {
      const err = new Error(data.error || `Request failed (${res.status})`);
      err.data = data;
      err.status = res.status;
      throw err;
    }
    return data;
  }

  async function probeApiBase(base) {
    try {
      const clean = String(base).replace(/\/+$/, "");
      const healthRes = await fetch(`${clean}/api/health`);
      if (!healthRes.ok) return false;
      const healthData = await healthRes.json().catch(() => ({}));
      return !!healthData.ok;
    } catch (_err) {
      return false;
    }
  }

  async function detectApiBase() {
    const current = (window.location.protocol === "http:" || window.location.protocol === "https:")
      ? window.location.origin
      : "";
    const saved = localStorage.getItem("apiBase") || "";
    const candidates = [apiBaseInput, current, saved, API, "http://127.0.0.1:3000", "http://localhost:10000", "http://127.0.0.1:10000"]
      .map((x) => String(x || "").trim())
      .filter(Boolean)
      .filter((v, i, a) => a.indexOf(v) === i);

    for (const c of candidates) {
      if (await probeApiBase(c)) {
        setDetectedApiBase(c);
        setApiBaseInput(c);
        return c;
      }
    }
    return null;
  }

  async function adminLogin() {
    setBusy(true);
    try {
      if (!adminPhone || !adminPassword) {
        throw new Error("Phone and password are required.");
      }

      let data;
      try {
        data = await api("/api/login", {
          method: "POST",
          body: JSON.stringify({ phone: adminPhone.trim(), password: adminPassword })
        });
      } catch (err) {
        if (String(err.message || "").includes("(404)")) {
          const found = await detectApiBase();
          if (!found) throw err;
          data = await api("/api/login", {
            method: "POST",
            body: JSON.stringify({ phone: adminPhone.trim(), password: adminPassword })
          });
        } else {
          throw err;
        }
      }

      if (!data.user || !data.user.isAdmin) {
        throw new Error("Wrong credentials.");
      }
      if (PORTAL_ROLE === "admin" && data.user.isSuperAdmin) {
        throw new Error("Wrong credentials.");
      }

      setToken(data.token);
      setIsAdminAuthenticated(true);
      setIsSuperAdmin(false);
      setShowForgotHelp(false);
      if (rememberMe) localStorage.setItem("adminLoginPhone", adminPhone.trim());
      else localStorage.removeItem("adminLoginPhone");
      showMessage("Admin portal login successful.");
      const baseLoads = [
        loadPlots(data.token),
        loadUsers(data.token),
        loadPayments(data.token),
        loadAnalytics(data.token),
        loadActiveAccounts(data.token),
        loadLocationMetadata(data.token)
      ];
      await Promise.all(baseLoads);
    } catch (err) {
      setIsAdminAuthenticated(false);
      setIsSuperAdmin(false);
      setToken("");
      setAdminPhone("");
      setAdminPassword("");
      localStorage.removeItem("adminLoginPhone");
      showMessage("Wrong credentials.", true);
    } finally {
      setBusy(false);
    }
  }

  async function loadLocationMetadata(tokenOverride = null) {
    const data = await api("/api/metadata/locations", {}, tokenOverride);
    setLocationMeta(data || { countries: [], countiesByCountry: {}, areasByCounty: {} });
  }

  async function loadAdminAccounts(tokenOverride = null) {
    const rows = await api("/api/super-admin/admins", {}, tokenOverride);
    setAdminAccounts(Array.isArray(rows) ? rows : []);
  }

  async function resetAdminBySuperAdmin() {
    if (!isSuperAdmin) return showMessage("Super admin login required.", true);
    if (!selectedAdminId) return showMessage("Select an admin account first.", true);
    setBusy(true);
    try {
      const data = await api(`/api/super-admin/admins/${encodeURIComponent(selectedAdminId)}/reset-password`, {
        method: "POST",
        body: JSON.stringify({ newPassword: resetAdminPasswordValue.trim() || undefined })
      });
      setIssuedPassword(data.temporaryPassword || "");
      setResetAdminPasswordValue("");
      showMessage(data.message || "Admin password reset.");
      await loadAdminAccounts();
    } catch (err) {
      showMessage(err.message || "Failed to reset admin password.", true);
    } finally {
      setBusy(false);
    }
  }

  async function addCountyBySuperAdmin() {
    if (!isSuperAdmin) return showMessage("Super admin login required.", true);
    setBusy(true);
    try {
      await api("/api/super-admin/locations/county", {
        method: "POST",
        body: JSON.stringify({ country: newCountyCountry, county: newCountyName.trim() })
      });
      setNewCountyName("");
      showMessage("County added.");
      await loadLocationMetadata();
    } catch (err) {
      showMessage(err.message, true);
    } finally {
      setBusy(false);
    }
  }

  async function addAreaBySuperAdmin() {
    if (!isSuperAdmin) return showMessage("Super admin login required.", true);
    setBusy(true);
    try {
      await api("/api/super-admin/locations/area", {
        method: "POST",
        body: JSON.stringify({ county: newAreaCounty, area: newAreaName.trim() })
      });
      setNewAreaName("");
      showMessage("Area added.");
      await loadLocationMetadata();
    } catch (err) {
      showMessage(err.message, true);
    } finally {
      setBusy(false);
    }
  }

  async function requestSuperAdminResetCode() {
    setBusy(true);
    try {
      if (!forgotPhone.trim()) throw new Error("Enter super admin phone.");
      const data = await api("/api/super-admin/forgot-password/request-code", {
        method: "POST",
        body: JSON.stringify({ phone: forgotPhone.trim() })
      });
      setForgotExpiresAt(data.expiresAt || "");
      showMessage(data.message || "SMS code sent.");
    } catch (err) {
      showMessage(err.message || "Failed to send SMS code.", true);
    } finally {
      setBusy(false);
    }
  }

  async function resetSuperAdminPassword() {
    setBusy(true);
    try {
      if (!forgotPhone.trim() || !forgotCode.trim() || !forgotNewPassword.trim()) {
        throw new Error("Phone, SMS code and new password are required.");
      }
      const data = await api("/api/super-admin/forgot-password/verify-code", {
        method: "POST",
        body: JSON.stringify({
          phone: forgotPhone.trim(),
          code: forgotCode.trim(),
          newPassword: forgotNewPassword
        })
      });
      showMessage(data.message || "Password reset successful.");
      setForgotCode("");
      setForgotNewPassword("");
      setForgotExpiresAt("");
      setAdminPhone(forgotPhone.trim());
    } catch (err) {
      showMessage(err.message || "Failed to reset password.", true);
    } finally {
      setBusy(false);
    }
  }

  function logout() {
    setToken("");
    setIsAdminAuthenticated(false);
    setIsSuperAdmin(false);
    setAdminPhone("");
    setAdminPassword("");
    localStorage.removeItem("adminLoginPhone");
    setPlots([]);
    setUsers([]);
    setPayments([]);
    setActiveAccounts([]);
    setAdminAccounts([]);
    setIssuedPassword("");
    setAnalytics(null);
    showMessage("Logged out.");
  }

  async function loadPlots(tokenOverride = null) {
    const rows = await api("/api/admin/plots", {}, tokenOverride);
    setPlots(Array.isArray(rows) ? rows : []);
  }

  async function loadUsers(tokenOverride = null) {
    const rows = await api("/api/admin/users", {}, tokenOverride);
    setUsers(Array.isArray(rows) ? rows : []);
  }

  async function loadPayments(tokenOverride = null) {
    const rows = await api("/api/admin/payments", {}, tokenOverride);
    setPayments(Array.isArray(rows) ? rows : []);
  }

  async function loadAnalytics(tokenOverride = null) {
    const data = await api("/api/admin/analytics", {}, tokenOverride);
    setAnalytics(data || null);
  }

  async function loadActiveAccounts(tokenOverride = null) {
    const rows = await api("/api/admin/accounts/active", {}, tokenOverride);
    setActiveAccounts(Array.isArray(rows) ? rows : []);
  }

  async function createAdmin() {
    if (!isSuperAdmin) return showMessage("Super admin login required.", true);
    if (!newAdminPhone.trim() || !newAdminPassword.trim()) {
      return showMessage("New admin phone and password are required.", true);
    }
    setBusy(true);
    try {
      const res = await api("/api/admin/create-admin", {
        method: "POST",
        body: JSON.stringify({
          phone: newAdminPhone.trim(),
          password: newAdminPassword
        })
      });
      setNewAdminPhone("");
      setNewAdminPassword("");
      showMessage(res.message || "Admin account updated.");
      await Promise.all([loadUsers(), loadAdminAccounts()]);
    } catch (err) {
      showMessage(err.message, true);
    } finally {
      setBusy(false);
    }
  }

  async function addPlot() {
    if (!isAdminAuthenticated) return showMessage("Admin login required.", true);
    setBusy(true);
    try {
      const payload = {
        title: plotForm.title.trim(),
        price: Number(plotForm.price),
        category: plotForm.category.trim(),
        town: plotForm.town.trim(),
        area: plotForm.area.trim(),
        caretaker: plotForm.caretaker.trim(),
        whatsapp: plotForm.whatsapp.trim(),
        description: plotForm.description.trim(),
        images: commaUrls(plotForm.images),
        videos: commaUrls(plotForm.videos)
      };
      await api("/api/admin/plots", { method: "POST", body: JSON.stringify(payload) });
      setPlotForm({
        title: "",
        price: "",
        category: "",
        town: "",
        area: "",
        caretaker: "",
        whatsapp: "",
        description: "",
        images: "",
        videos: ""
      });
      showMessage("Plot created.");
      await Promise.all([loadPlots(), loadAnalytics()]);
    } catch (err) {
      showMessage(err.message, true);
    } finally {
      setBusy(false);
    }
  }

  async function deletePlot(plotId) {
    if (!isAdminAuthenticated) return showMessage("Admin login required.", true);
    if (!window.confirm("Delete this plot?")) return;
    setBusy(true);
    try {
      await api(`/api/admin/plots/${encodeURIComponent(plotId)}`, { method: "DELETE" });
      await Promise.all([loadPlots(), loadAnalytics()]);
      showMessage("Plot deleted.");
    } catch (err) {
      showMessage(err.message, true);
    } finally {
      setBusy(false);
    }
  }

  async function editPlot(plot) {
    if (!isAdminAuthenticated) return showMessage("Admin login required.", true);
    const title = window.prompt("Title:", plot.title);
    if (title === null) return;
    const priceInput = window.prompt("Price (Ksh):", String(plot.price));
    if (priceInput === null) return;
    const category = window.prompt("Category:", plot.category || "");
    if (category === null) return;
    const town = window.prompt("Town/County:", plot.town || plot.county || "");
    if (town === null) return;
    const area = window.prompt("Area:", plot.area || "");
    if (area === null) return;
    const caretaker = window.prompt("Caretaker phone:", plot.caretaker || "");
    if (caretaker === null) return;
    const whatsapp = window.prompt("WhatsApp phone:", plot.whatsapp || "");
    if (whatsapp === null) return;
    const description = window.prompt("Description:", plot.description || "");
    if (description === null) return;
    const imagesRaw = window.prompt("Images (comma separated URLs):", (plot.images || []).join(", "));
    if (imagesRaw === null) return;
    const videosRaw = window.prompt("Videos (comma separated URLs):", (plot.videos || []).join(", "));
    if (videosRaw === null) return;

    setBusy(true);
    try {
      const payload = {
        title: title.trim(),
        price: Number(priceInput),
        category: category.trim(),
        town: town.trim(),
        area: area.trim(),
        caretaker: caretaker.trim(),
        whatsapp: whatsapp.trim(),
        description: description.trim(),
        images: commaUrls(imagesRaw),
        videos: commaUrls(videosRaw)
      };
      await api(`/api/admin/plots/${encodeURIComponent(plot.id)}`, {
        method: "PUT",
        body: JSON.stringify(payload)
      });
      showMessage("Plot updated.");
      await Promise.all([loadPlots(), loadAnalytics()]);
    } catch (err) {
      showMessage(err.message, true);
    } finally {
      setBusy(false);
    }
  }

  function downloadDataset(name, headers, rows) {
    const stamp = new Date().toISOString().replace(/[:.]/g, "-");
    const csv = buildCsv(headers, rows);
    triggerDownload(`${name}-${stamp}.csv`, csv, "text/csv;charset=utf-8");
  }

  function downloadPlots() {
    downloadDataset("plots", [
      { label: "ID", value: (p) => p.id },
      { label: "Title", value: (p) => p.title },
      { label: "Price", value: (p) => p.price },
      { label: "Category", value: (p) => p.category || "" },
      { label: "Country", value: (p) => p.country || "Kenya" },
      { label: "County", value: (p) => p.county || p.town || "" },
      { label: "Area", value: (p) => p.area || "" },
      { label: "Caretaker", value: (p) => p.caretaker || "" },
      { label: "WhatsApp", value: (p) => p.whatsapp || "" },
      { label: "Description", value: (p) => p.description || "" },
      { label: "Created At", value: (p) => p.createdAt || p.created_at || "" }
    ], plots);
  }

  function downloadUsers() {
    downloadDataset("users", [
      { label: "User ID", value: (u) => u.id },
      { label: "Phone", value: (u) => u.phone },
      { label: "Role", value: (u) => u.role || (u.is_super_admin ? "super_admin" : u.is_admin ? "admin" : "user") },
      { label: "Is Admin", value: (u) => (u.is_admin ? "yes" : "no") },
      { label: "Is Super Admin", value: (u) => (u.is_super_admin ? "yes" : "no") },
      { label: "Activated At", value: (u) => u.activatedAt || u.activated_at || "" },
      { label: "Expires At", value: (u) => u.expiresAt || u.expires_at || "" },
      { label: "Payment Status", value: (u) => (u.paymentStatus ? "active" : "inactive") }
    ], users);
  }

  function downloadPayments() {
    downloadDataset("payments", [
      { label: "Payment ID", value: (p) => p.id },
      { label: "User ID", value: (p) => p.userId || "" },
      { label: "Phone", value: (p) => p.phone || "" },
      { label: "Amount", value: (p) => p.amount || 0 },
      { label: "Status", value: (p) => p.status || "" },
      { label: "Receipt", value: (p) => p.mpesaReceipt || "" },
      { label: "Activated At", value: (p) => p.activatedAt || "" },
      { label: "Expires At", value: (p) => p.expiresAt || "" },
      { label: "Timestamp", value: (p) => p.timestamp || p.createdAt || "" }
    ], payments);
  }

  function downloadActiveAccounts() {
    downloadDataset("active-accounts", [
      { label: "User ID", value: (a) => a.userId },
      { label: "Phone", value: (a) => a.phone || "" },
      { label: "Activated At", value: (a) => a.activatedAt || "" },
      { label: "Expires At", value: (a) => a.expiresAt || "" },
      { label: "Remaining Seconds", value: (a) => a.remainingSeconds || 0 },
      { label: "Receipt", value: (a) => a.mpesaReceipt || "" }
    ], activeAccounts);
  }

  async function runExportThenDelete(label, rows, exportFn, deleteFn) {
    if (!isAdminAuthenticated) return showMessage("Admin login required.", true);
    if (!rows.length) return showMessage(`No ${label.toLowerCase()} to export.`, true);
    exportFn();
    if (!window.confirm(`Export complete. Delete ${rows.length} ${label.toLowerCase()} records now?`)) return;

    setBusy(true);
    try {
      let deleted = 0;
      let failed = 0;
      for (const row of rows) {
        try {
          await deleteFn(row);
          deleted += 1;
        } catch (_err) {
          failed += 1;
        }
      }
      await Promise.all([loadPlots(), loadUsers(), loadPayments(), loadAnalytics(), loadActiveAccounts()]);
      if (failed) {
        showMessage(`Exported ${label}. Deleted ${deleted}/${rows.length}; failed ${failed}.`, true);
      } else {
        showMessage(`Exported and deleted ${deleted} ${label.toLowerCase()} records.`);
      }
    } finally {
      setBusy(false);
    }
  }

  async function deleteUserRecord(userId) {
    await api(`/api/admin/users/${encodeURIComponent(userId)}`, { method: "DELETE" });
  }

  async function deletePaymentRecord(paymentId) {
    await api(`/api/admin/payments/${encodeURIComponent(paymentId)}`, { method: "DELETE" });
  }

  async function deleteActivationRecord(userId) {
    await api(`/api/admin/activations/${encodeURIComponent(userId)}`, { method: "DELETE" });
  }

  function exportDeletePlots() {
    return runExportThenDelete("Plots", plots, downloadPlots, (row) => api(`/api/admin/plots/${encodeURIComponent(row.id)}`, { method: "DELETE" }));
  }

  function exportDeleteUsers() {
    const deletable = users.filter((u) => !u.is_admin && !u.is_super_admin);
    return runExportThenDelete("Users", deletable, () => downloadDataset("users", [
      { label: "User ID", value: (u) => u.id },
      { label: "Phone", value: (u) => u.phone },
      { label: "Role", value: (u) => u.role || (u.is_super_admin ? "super_admin" : u.is_admin ? "admin" : "user") },
      { label: "Activated At", value: (u) => u.activatedAt || u.activated_at || "" },
      { label: "Expires At", value: (u) => u.expiresAt || u.expires_at || "" },
      { label: "Payment Status", value: (u) => (u.paymentStatus ? "active" : "inactive") }
    ], deletable), (row) => deleteUserRecord(row.id));
  }

  function exportDeletePayments() {
    return runExportThenDelete("Payments", payments, downloadPayments, (row) => deletePaymentRecord(row.id));
  }

  function exportDeleteActivations() {
    return runExportThenDelete("Active Accounts", activeAccounts, downloadActiveAccounts, (row) => deleteActivationRecord(row.userId));
  }

  async function activateUser(userId) {
    if (!isAdminAuthenticated) return showMessage("Admin login required.", true);
    if (!String(userId || "").trim()) return showMessage("User ID is required.", true);
    setBusy(true);
    try {
      await api("/api/admin/activate", { method: "POST", body: JSON.stringify({ userId }) });
      setManualActivateUserId("");
      await Promise.all([loadUsers(), loadPayments(), loadAnalytics(), loadActiveAccounts()]);
      showMessage("Account activated successfully.");
    } catch (err) {
      showMessage(err.message, true);
    } finally {
      setBusy(false);
    }
  }

  async function revokeUser(userId) {
    if (!isAdminAuthenticated) return showMessage("Admin login required.", true);
    setBusy(true);
    try {
      await api("/api/admin/revoke", { method: "POST", body: JSON.stringify({ userId }) });
      await Promise.all([loadUsers(), loadPayments(), loadAnalytics(), loadActiveAccounts()]);
      showMessage("Account revoked successfully.");
    } catch (err) {
      showMessage(err.message, true);
    } finally {
      setBusy(false);
    }
  }

  useEffect(() => {
    detectApiBase().catch(() => {});
  }, []);

  useEffect(() => {
    if (!newAreaCounty) {
      const firstCounty = Object.keys(locationMeta.areasByCounty || {})[0] || "";
      if (firstCounty) setNewAreaCounty(firstCounty);
    }
  }, [locationMeta, newAreaCounty]);

  useEffect(() => {
    function syncHash() {
      const hash = (window.location.hash || "").replace(/^#/, "");
      setActiveNav(hash || "dashboard-home");
      setIsMobileNavOpen(false);
    }
    syncHash();
    window.addEventListener("hashchange", syncHash);
    return () => window.removeEventListener("hashchange", syncHash);
  }, []);

  useEffect(() => {
    function syncMobileNavState() {
      if (window.innerWidth > ADMIN_MOBILE_NAV_BREAKPOINT) {
        setIsMobileNavOpen(false);
      }
    }
    syncMobileNavState();
    window.addEventListener("resize", syncMobileNavState);
    return () => window.removeEventListener("resize", syncMobileNavState);
  }, []);

  useEffect(() => {
    if (!isAdminAuthenticated || !token) return undefined;
    const poll = async () => {
      try {
        await Promise.all([loadPayments(), loadActiveAccounts(), loadUsers(), loadAnalytics()]);
      } catch (_err) {}
    };
    const timer = setInterval(poll, 10000);
    return () => clearInterval(timer);
  }, [isAdminAuthenticated, token]);

  const metrics = useMemo(() => {
    const revenue = analytics?.payments?.revenue || 0;
    return {
      plots: plots.length,
      users: users.length,
      payments: payments.length,
      revenue: Number(revenue)
    };
  }, [plots, users, payments, analytics]);

  const plotCountyOptions = useMemo(() => {
    const rows = Object.values(locationMeta.countiesByCountry || {})
      .flat()
      .filter(Boolean);
    return Array.from(new Set(rows)).sort((a, b) => String(a).localeCompare(String(b)));
  }, [locationMeta]);

  const plotAreaOptions = useMemo(
    () => (plotForm.town ? (locationMeta.areasByCounty?.[plotForm.town] || []) : []),
    [locationMeta, plotForm.town]
  );

  const navItems = useMemo(() => {
    const items = [{ id: "dashboard-home", label: "Plots", icon: "⌘" }];
    if (!isAdminAuthenticated) {
      items.push({ id: "admin-login", label: "Admin Login", icon: "◉" });
    }
    if (isAdminAuthenticated) {
      items.push(
        { id: "admin-stats", label: "Stats", icon: "◎" },
        { id: "admin-add-plot", label: "Add Plot", icon: "✉" },
        { id: "admin-plots", label: "Plots", icon: "⌂" },
        { id: "admin-users", label: "Users", icon: "▣" },
        { id: "admin-payments", label: "Payments", icon: "◫" },
        { id: "admin-active-accounts", label: "Active Accounts", icon: "◷" },
        { id: "admin-analytics", label: "Analytics", icon: "?" }
      );
    }
    if (isAdminAuthenticated && isSuperAdmin) {
      items.splice(4, 0,
        { id: "admin-add-admin", label: "Add Admin", icon: "◧" },
        { id: "admin-admin-accounts", label: "Admin Accounts", icon: "☑" }
      );
    }
    return items;
  }, [isAdminAuthenticated, isSuperAdmin]);

  return html`
    <div className="page-shell">
      <nav className="glass nav-shell nav-animate flex justify-between items-center">
        <h1 className="text-2xl font-bold text-blue-300 flex items-center gap-2">
          <span className="brand-mark" aria-hidden="true">
            <svg viewBox="0 0 24 24" className="brand-icon" role="img" aria-label="Plot icon">
              <path d="M3 11.2L12 4l9 7.2v8.6a.8.8 0 0 1-.8.8h-5.4v-6.1a.8.8 0 0 0-.8-.8h-4a.8.8 0 0 0-.8.8v6.1H3.8a.8.8 0 0 1-.8-.8v-8.6z"></path>
            </svg>
          </span>
          <span>TST PlotConnect Admin</span>
        </h1>
        <div className="flex gap-2">
          <a href="https://www.tst-plotconnect.com/" className="btn-soft px-4 py-2 rounded-xl">User Site</a>
        </div>
      </nav>

      <main className="main-shell">
        ${!isAdminAuthenticated
          ? html`
              <section id="admin-login" className="auth-wrap">
                <div className="glass auth-card">
                  <p className="hero-kicker">ADMIN ACCESS</p>
                  <h2 className="auth-title">Please fill in your details to log in</h2>

                  <label className="auth-label" for="admin-phone-input">Username</label>
                  <input
                    id="admin-phone-input"
                    type="tel"
                    placeholder="Student No / Employee No"
                    className="input-modern auth-input rounded-xl"
                    value=${adminPhone}
                    onInput=${(e) => setAdminPhone(e.target.value)}
                  />

                  <label className="auth-label" for="admin-password-input">Password</label>
                  <div className="auth-pass-wrap">
                    <input
                      id="admin-password-input"
                      type=${showPassword ? "text" : "password"}
                      placeholder="Enter your Password"
                      className="input-modern auth-input auth-input-pass rounded-xl"
                      value=${adminPassword}
                      onInput=${(e) => setAdminPassword(e.target.value)}
                    />
                    <button
                      type="button"
                      className="auth-eye"
                      onClick=${() => setShowPassword((v) => !v)}
                      aria-label=${showPassword ? "Hide password" : "Show password"}
                    >
                      ${showPassword ? "Hide" : "Show"}
                    </button>
                  </div>

                  <div className="auth-row">
                    <label className="auth-check">
                      <input
                        type="checkbox"
                        checked=${rememberMe}
                        onChange=${(e) => setRememberMe(!!e.target.checked)}
                      />
                      <span>Remember me</span>
                    </label>
                    <button type="button" className="auth-link" onClick=${() => setShowForgotHelp(true)}>Forgot Password?</button>
                  </div>

                  <button onClick=${adminLogin} disabled=${busy} className="btn-success rounded-xl auth-submit">
                    ${busy ? "Please wait..." : "Sign In"}
                  </button>
                  ${showForgotHelp
                    ? html`
                        <div className="mt-3 rounded-xl border border-slate-700 bg-slate-900/50 p-3">
                          <p className="text-sm text-slate-300">
                            Contact Super Admin to reset your password.
                          </p>
                          <p className="text-sm text-emerald-300 mt-2">
                            Super Admin Contact: ${DEFAULT_SUPER_ADMIN_PHONE}
                          </p>
                        </div>
                      `
                    : null}

                  ${message.text
                    ? html`<p className=${`mt-3 text-sm ${message.error ? "text-red-400" : "text-green-400"}`}>${message.text}</p>`
                    : null}
                </div>
              </section>
            `
          : html`
        <div className="admin-layout auth-dashboard">
          <button
            type="button"
            className="mobile-nav-toggle"
            onClick=${() => setIsMobileNavOpen((v) => !v)}
            aria-expanded=${isMobileNavOpen ? "true" : "false"}
            aria-controls="admin-sidebar-nav"
          >
            <span aria-hidden="true">${isMobileNavOpen ? "X" : "☰"}</span>
            <span>${isMobileNavOpen ? "Close Menu" : "Menu"}</span>
          </button>
          <aside id="admin-sidebar-nav" className=${`glass sidebar-nav ${isMobileNavOpen ? "is-mobile-open" : ""}`}>
            <p className="sidebar-title">Navigation</p>
            <div className="sidebar-list">
              ${navItems.map((item) => html`
                <a
                  href=${`#${item.id}`}
                  className=${`sidebar-link ${activeNav === item.id ? "is-active" : ""}`}
                  onClick=${() => {
                    setActiveNav(item.id);
                    setIsMobileNavOpen(false);
                  }}
                >
                  <span className="sidebar-ico" aria-hidden="true">${item.icon || "•"}</span>
                  <span>${item.label}</span>
                  <span className="sidebar-chevron" aria-hidden="true">${item.id === "dashboard-home" ? "" : "›"}</span>
                </a>
              `)}
              <button className="sidebar-link sidebar-logout" onClick=${() => { logout(); setIsMobileNavOpen(false); }}>
                <span className="sidebar-ico" aria-hidden="true">⇦</span>
                <span>Logout</span>
                <span className="sidebar-chevron" aria-hidden="true">›</span>
              </button>
            </div>
          </aside>

          <div className="admin-content">
            ${message.text
              ? html`
                  <div
                    className=${`toast ${message.error ? "toast-error" : "toast-success"}`}
                    role=${message.error ? "alert" : "status"}
                    aria-live=${message.error ? "assertive" : "polite"}
                  >
                    ${message.text}
                  </div>
                `
              : null}
        <section id="dashboard-home" className="hero-panel glass fade-in p-6 md:p-8 rounded-3xl mb-6">
          <p className="hero-kicker">ADMIN COMMAND CENTER</p>
          <h2 className="hero-title text-3xl md:text-4xl font-bold mb-2">Manage Listings, Users, and Payments</h2>
          <p className="text-sm text-muted">Secure operations dashboard for plot inventory, user access control, and Daraja payment tracking.</p>
        </section>

              <section id="admin-stats" className="grid md:grid-cols-4 gap-4 mb-6">
                <article className="glass rounded-2xl p-4 stat-card"><p className="text-xs text-muted">Total Plots</p><p className="text-2xl font-bold">${metrics.plots}</p></article>
                <article className="glass rounded-2xl p-4 stat-card"><p className="text-xs text-muted">Registered Users</p><p className="text-2xl font-bold">${metrics.users}</p></article>
                <article className="glass rounded-2xl p-4 stat-card"><p className="text-xs text-muted">Payments Logged</p><p className="text-2xl font-bold">${metrics.payments}</p></article>
                <article className="glass rounded-2xl p-4 stat-card"><p className="text-xs text-muted">Revenue</p><p className="text-2xl font-bold">Ksh ${metrics.revenue}</p></article>
              </section>

              <section id="admin-add-plot" className="glass fade-in p-6 rounded-2xl mb-6 dashboard-card">
                <h2 className="text-xl font-bold mb-4 text-emerald-400">Add Plot</h2>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <input className="input-modern p-3 rounded-xl" placeholder="Title" value=${plotForm.title} onInput=${(e) => setPlotForm({ ...plotForm, title: e.target.value })} />
                  <input className="input-modern p-3 rounded-xl" type="number" placeholder="Price (Ksh)" value=${plotForm.price} onInput=${(e) => setPlotForm({ ...plotForm, price: e.target.value })} />
                  <select className="input-modern p-3 rounded-xl" value=${plotForm.category} onChange=${(e) => setPlotForm({ ...plotForm, category: e.target.value })}>
                    <option value="">Category</option>
                    <option value="Rental Houses">Rental Houses</option>
                    <option value="Bedsitters">Bedsitters</option>
                    <option value="Hostels">Hostels</option>
                    <option value="Apartments">Apartments</option>
                    <option value="Lodges">Lodges</option>
                    <option value="AirBnB">AirBnB</option>
                    <option value="Vacant Shops">Vacant Shops</option>
                    <option value="Office Spaces">Office Spaces</option>
                    <option value="Guest Houses">Guest Houses</option>
                    <option value="Plots for Sale">Plots for Sale</option>
                  </select>
                  <select
                    className="input-modern p-3 rounded-xl"
                    value=${plotForm.town}
                    onChange=${(e) => setPlotForm({ ...plotForm, town: e.target.value, area: "" })}
                    disabled=${plotCountyOptions.length === 0}
                  >
                    <option value="">Select Town/County</option>
                    ${plotCountyOptions.map((c) => html`<option value=${c} key=${c}>${c}</option>`)}
                  </select>
                  <select
                    className="input-modern p-3 rounded-xl"
                    value=${plotForm.area}
                    onChange=${(e) => setPlotForm({ ...plotForm, area: e.target.value })}
                    disabled=${!plotForm.town || plotAreaOptions.length === 0}
                  >
                    <option value="">Select Area</option>
                    ${plotAreaOptions.map((a) => html`<option value=${a} key=${a}>${a}</option>`)}
                  </select>
                  <input className="input-modern p-3 rounded-xl" placeholder="Caretaker phone" value=${plotForm.caretaker} onInput=${(e) => setPlotForm({ ...plotForm, caretaker: e.target.value })} />
                  <input className="input-modern p-3 rounded-xl" placeholder="WhatsApp phone" value=${plotForm.whatsapp} onInput=${(e) => setPlotForm({ ...plotForm, whatsapp: e.target.value })} />
                  <textarea className="input-modern p-3 rounded-xl md:col-span-2" placeholder="Description" value=${plotForm.description} onInput=${(e) => setPlotForm({ ...plotForm, description: e.target.value })}></textarea>
                  <input className="input-modern p-3 rounded-xl md:col-span-2" placeholder="Image URLs (comma separated)" value=${plotForm.images} onInput=${(e) => setPlotForm({ ...plotForm, images: e.target.value })} />
                  <input className="input-modern p-3 rounded-xl md:col-span-2" placeholder="Video URLs (comma separated)" value=${plotForm.videos} onInput=${(e) => setPlotForm({ ...plotForm, videos: e.target.value })} />
                  <button className="btn-success py-3 rounded-xl md:col-span-2" onClick=${addPlot} disabled=${busy}>Create Plot</button>
                </div>
              </section>

              ${isSuperAdmin
                ? html`
                    <section id="admin-add-admin" className="glass fade-in p-6 rounded-2xl mb-6 dashboard-card">
                      <h2 className="text-xl font-bold mb-4 text-emerald-400">Add Admin</h2>
                      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                        <input
                          className="input-modern p-3 rounded-xl"
                          placeholder="New admin phone"
                          value=${newAdminPhone}
                          onInput=${(e) => setNewAdminPhone(e.target.value)}
                        />
                        <input
                          type="password"
                          className="input-modern p-3 rounded-xl"
                          placeholder="New admin password"
                          value=${newAdminPassword}
                          onInput=${(e) => setNewAdminPassword(e.target.value)}
                        />
                        <button className="btn-success rounded-xl p-3" onClick=${createAdmin} disabled=${busy}>
                          Create Admin
                        </button>
                      </div>
                    </section>

                    <section id="admin-admin-accounts" className="glass fade-in p-6 rounded-2xl mb-6 dashboard-card">
                      <div className="flex items-center justify-between mb-4">
                        <h2 className="text-xl font-bold text-emerald-400">Admin Accounts</h2>
                        <button className="btn-soft px-4 py-2 rounded-xl" onClick=${() => loadAdminAccounts()} disabled=${busy}>
                          Refresh Admin Accounts
                        </button>
                      </div>
                      <div className="overflow-x-auto mb-4">
                        <table className="min-w-full text-left data-table">
                          <thead>
                            <tr>
                              <th className="p-2">Admin ID</th>
                              <th className="p-2">Login Phone</th>
                              <th className="p-2">Role</th>
                              <th className="p-2">Created</th>
                              <th className="p-2">Lock Status</th>
                            </tr>
                          </thead>
                          <tbody>
                            ${adminAccounts.length === 0
                              ? html`<tr><td className="p-2 text-muted" colSpan="5">No admin accounts found.</td></tr>`
                              : adminAccounts.map((a) => html`
                                  <tr key=${a.id} className="admin-row border-t border-slate-700">
                                    <td className="p-2">${a.id}</td>
                                    <td className="p-2">${a.loginPhone}</td>
                                    <td className="p-2">${a.role === "super_admin" ? "Super Admin" : "Admin"}</td>
                                    <td className="p-2">${formatDate(a.createdAt)}</td>
                                    <td className="p-2">${a.lockUntil ? `Locked until ${formatDate(a.lockUntil)}` : "Unlocked"}</td>
                                  </tr>
                                `)}
                          </tbody>
                        </table>
                      </div>
                      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                        <select
                          className="input-modern p-3 rounded-xl"
                          value=${selectedAdminId}
                          onChange=${(e) => setSelectedAdminId(e.target.value)}
                        >
                          <option value="">Select admin to reset password</option>
                          ${adminAccounts
                            .filter((a) => a.role !== "super_admin")
                            .map((a) => html`<option value=${a.id} key=${a.id}>${a.loginPhone}</option>`)}
                        </select>
                        <input
                          className="input-modern p-3 rounded-xl"
                          placeholder="Optional new password (leave empty for auto)"
                          value=${resetAdminPasswordValue}
                          onInput=${(e) => setResetAdminPasswordValue(e.target.value)}
                        />
                        <button className="btn-success rounded-xl p-3" onClick=${resetAdminBySuperAdmin} disabled=${busy}>
                          Reset Selected Admin Password
                        </button>
                      </div>
                      ${issuedPassword
                        ? html`<p className="mt-3 text-sm text-amber-300">Temporary password to share securely: <strong>${issuedPassword}</strong></p>`
                        : null}
                    </section>

                    <section id="admin-locations" className="glass fade-in p-6 rounded-2xl mb-6 dashboard-card">
                      <h2 className="text-xl font-bold mb-4 text-emerald-400">Manage Counties & Areas</h2>
                      <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mb-3">
                        <select className="input-modern p-3 rounded-xl" value=${newCountyCountry} onChange=${(e) => setNewCountyCountry(e.target.value)}>
                          ${(locationMeta.countries || []).map((c) => html`<option value=${c} key=${c}>${c}</option>`)}
                        </select>
                        <input
                          className="input-modern p-3 rounded-xl"
                          placeholder="New county name"
                          value=${newCountyName}
                          onInput=${(e) => setNewCountyName(e.target.value)}
                        />
                        <button className="btn-soft rounded-xl p-3" onClick=${addCountyBySuperAdmin} disabled=${busy}>Add County</button>
                      </div>
                      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                        <select className="input-modern p-3 rounded-xl" value=${newAreaCounty} onChange=${(e) => setNewAreaCounty(e.target.value)}>
                          <option value="">Select county</option>
                          ${Object.keys(locationMeta.areasByCounty || {}).map((c) => html`<option value=${c} key=${c}>${c}</option>`)}
                        </select>
                        <input
                          className="input-modern p-3 rounded-xl"
                          placeholder="New area name"
                          value=${newAreaName}
                          onInput=${(e) => setNewAreaName(e.target.value)}
                        />
                        <button className="btn-soft rounded-xl p-3" onClick=${addAreaBySuperAdmin} disabled=${busy}>Add Area</button>
                      </div>
                    </section>
                  `
                : null}

              <section id="admin-plots" className="glass fade-in p-6 rounded-2xl mb-6 dashboard-card">
                <div className="flex items-center justify-between mb-4 gap-2">
                  <h2 className="text-xl font-bold text-emerald-400">Plots</h2>
                  <div className="flex gap-2">
                    <button className="btn-soft px-4 py-2 rounded-xl" onClick=${downloadPlots} disabled=${busy}>Export Plots</button>
                  </div>
                </div>
                <div className="overflow-x-auto">
                  <table className="min-w-full text-left data-table">
                    <thead><tr><th className="p-2">ID</th><th className="p-2">Title</th><th className="p-2">Price</th><th className="p-2">Category</th><th className="p-2">Town</th><th className="p-2">Area</th><th className="p-2">Caretaker</th><th className="p-2">WhatsApp</th><th className="p-2">Action</th></tr></thead>
                    <tbody>
                      ${plots.map((plot) => html`
                        <tr key=${plot.id} className="admin-row border-t border-slate-700">
                          <td className="p-2">${plot.id}</td>
                          <td className="p-2">${plot.title}</td>
                          <td className="p-2">${plot.price}</td>
                          <td className="p-2">${plot.category || "-"}</td>
                          <td className="p-2">${plot.town || plot.county || "-"}</td>
                          <td className="p-2">${plot.area}</td>
                          <td className="p-2">${plot.caretaker}</td>
                          <td className="p-2">${plot.whatsapp}</td>
                          <td className="p-2 flex gap-2">
                            <button className="btn-chip btn-chip-edit" onClick=${() => editPlot(plot)}>Edit</button>
                            <button className="btn-chip btn-chip-danger" onClick=${() => deletePlot(plot.id)}>Delete</button>
                          </td>
                        </tr>
                      `)}
                    </tbody>
                  </table>
                </div>
              </section>

              <section id="admin-users" className="glass fade-in p-6 rounded-2xl dashboard-card">
                <div className="flex items-center justify-between mb-4 gap-2">
                  <h2 className="text-xl font-bold text-emerald-400">Users & Activations</h2>
                  <div className="flex gap-2">
                    <button className="btn-soft px-4 py-2 rounded-xl" onClick=${downloadUsers} disabled=${busy}>Export Users</button>
                  </div>
                </div>
                <div className="mb-4 grid grid-cols-1 md:grid-cols-3 gap-3">
                  <input
                    className="input-modern p-3 rounded-xl md:col-span-2"
                    placeholder="Enter User ID for manual activation"
                    value=${manualActivateUserId}
                    onInput=${(e) => setManualActivateUserId(e.target.value)}
                  />
                  <button
                    className="btn-success rounded-xl p-3"
                    onClick=${() => activateUser(manualActivateUserId.trim())}
                    disabled=${busy || !manualActivateUserId.trim()}
                  >
                    Activate 24h
                  </button>
                </div>
                <div className="overflow-x-auto">
                  <table className="min-w-full text-left data-table">
                    <thead><tr><th className="p-2">User ID</th><th className="p-2">Phone</th><th className="p-2">Activated</th><th className="p-2">Expires</th><th className="p-2">Status</th><th className="p-2">Action</th></tr></thead>
                    <tbody>
                      ${users.map((u) => html`
                        <tr key=${u.id} className="admin-row border-t border-slate-700">
                          <td className="p-2">${u.id}</td>
                          <td className="p-2">${u.phone}</td>
                          <td className="p-2">${formatDate(u.activatedAt || u.activated_at)}</td>
                          <td className="p-2">${formatDate(u.expiresAt || u.expires_at)}</td>
                          <td className="p-2">${u.paymentStatus ? "Active" : "-"}</td>
                          <td className="p-2 flex gap-2">
                            <button className="btn-chip btn-chip-edit" onClick=${() => activateUser(u.id)}>Activate 24h</button>
                            <button className="btn-chip btn-chip-danger" onClick=${() => revokeUser(u.id)}>Revoke</button>
                          </td>
                        </tr>
                      `)}
                    </tbody>
                  </table>
                </div>
              </section>

              <section id="admin-payments" className="glass fade-in p-6 rounded-2xl mt-6 dashboard-card">
                <div className="flex items-center justify-between mb-4 gap-2">
                  <h2 className="text-xl font-bold text-emerald-400">Payments</h2>
                  <div className="flex gap-2">
                    <button className="btn-soft px-4 py-2 rounded-xl" onClick=${downloadPayments} disabled=${busy}>Export Payments</button>
                  </div>
                </div>
                <div className="overflow-x-auto">
                  <table className="min-w-full text-left data-table">
                    <thead><tr><th className="p-2">Payment ID</th><th className="p-2">User</th><th className="p-2">Amount</th><th className="p-2">Status</th><th className="p-2">Receipt</th><th className="p-2">Created</th></tr></thead>
                    <tbody>
                      ${payments.map((p) => html`
                        <tr key=${p.id} className="admin-row border-t border-slate-700">
                          <td className="p-2">${p.id}</td>
                          <td className="p-2">${p.phone || "-"}</td>
                          <td className="p-2">Ksh ${p.amount}</td>
                          <td className="p-2">${p.status}</td>
                          <td className="p-2">${p.mpesaReceipt || "-"}</td>
                          <td className="p-2">${formatDate(p.timestamp || p.createdAt)}</td>
                        </tr>
                      `)}
                    </tbody>
                  </table>
                </div>
              </section>

              <section id="admin-active-accounts" className="glass fade-in p-6 rounded-2xl mt-6 dashboard-card">
                <div className="flex items-center justify-between mb-4">
                  <h2 className="text-xl font-bold text-emerald-400">Active Accounts Check</h2>
                  <div className="flex gap-2">
                    <button className="btn-soft px-4 py-2 rounded-xl" onClick=${downloadActiveAccounts} disabled=${busy}>Export Activations</button>
                    <button className="btn-soft px-4 py-2 rounded-xl" onClick=${() => loadActiveAccounts()} disabled=${busy}>
                      Refresh Active Accounts
                    </button>
                  </div>
                </div>
                <div className="overflow-x-auto">
                  <table className="min-w-full text-left data-table">
                    <thead>
                      <tr>
                        <th className="p-2">User ID</th>
                        <th className="p-2">Phone</th>
                        <th className="p-2">Activated</th>
                        <th className="p-2">Expires</th>
                        <th className="p-2">Remaining</th>
                        <th className="p-2">Receipt</th>
                      </tr>
                    </thead>
                    <tbody>
                      ${activeAccounts.length === 0
                        ? html`<tr><td className="p-2 text-muted" colSpan="6">No active accounts found.</td></tr>`
                        : activeAccounts.map((a) => html`
                            <tr key=${a.userId} className="admin-row border-t border-slate-700">
                              <td className="p-2">${a.userId}</td>
                              <td className="p-2">${a.phone || "-"}</td>
                              <td className="p-2">${formatDate(a.activatedAt)}</td>
                              <td className="p-2">${formatDate(a.expiresAt)}</td>
                              <td className="p-2">${a.remainingHours}h ${a.remainingMinutes}m (${a.remainingSeconds}s)</td>
                              <td className="p-2">${a.mpesaReceipt || "-"}</td>
                            </tr>
                          `)}
                    </tbody>
                  </table>
                </div>
              </section>

              <section id="admin-analytics" className="glass fade-in p-6 rounded-2xl mt-6 dashboard-card">
                <h2 className="text-xl font-bold mb-4 text-emerald-400">Analytics</h2>
                ${analytics
                  ? html`
                      <div className="grid md:grid-cols-3 gap-3 mb-4">
                        <div className="input-modern rounded-xl p-3"><p className="text-muted text-xs">Total Users</p><p className="text-2xl font-bold">${analytics.users.total}</p></div>
                        <div className="input-modern rounded-xl p-3"><p className="text-muted text-xs">Active (24h)</p><p className="text-2xl font-bold">${analytics.users.active24h}</p></div>
                        <div className="input-modern rounded-xl p-3"><p className="text-muted text-xs">Revenue</p><p className="text-2xl font-bold">Ksh ${analytics.payments.revenue}</p></div>
                      </div>
                    `
                  : html`<p className="text-muted text-sm">No analytics loaded yet.</p>`}
              </section>
          </div>
        </div>
          `}
      </main>
    </div>
  `;
}

createRoot(document.getElementById("app")).render(html`<${App} />`);
