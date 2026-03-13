import React, { useEffect, useMemo, useRef, useState } from "https://esm.sh/react@18.2.0";
import { createRoot } from "https://esm.sh/react-dom@18.2.0/client";
import htm from "https://esm.sh/htm@3.1.1";

const html = htm.bind(React.createElement);
const DEFAULT_API_BASE = "https://tstplotconnect-2.onrender.com";
const API = (typeof process !== "undefined" && process.env && process.env.NEXT_PUBLIC_API_URL)
  || (typeof window !== "undefined" && window.NEXT_PUBLIC_API_URL)
  || DEFAULT_API_BASE;
const DEFAULT_SUPER_ADMIN_PHONE = "0700000000";
const PORTAL_ROLE = "superadmin";
const ALTERNATE_PORTAL_PATH = "/admin";

function inferApiBase() {
  const loc = window.location;
  const isLocalHost = /^(localhost|127\.0\.0\.1|192\.168\.\d{1,3}\.\d{1,3}|10\.\d{1,3}\.\d{1,3}\.\d{1,3}|172\.(1[6-9]|2\d|3[0-1])\.\d{1,3}\.\d{1,3})$/i.test(loc.hostname);
  const isLocal = loc.protocol === "file:" || isLocalHost;
  if (isLocal) {
    localStorage.removeItem("apiBase");
    return API;
  }
  const saved = localStorage.getItem("apiBase");
  if (saved) {
    const savedIsLocal = /^http:\/\/(localhost|127\.0\.0\.1|192\.168\.\d{1,3}\.\d{1,3}|10\.\d{1,3}\.\d{1,3}\.\d{1,3}|172\.(1[6-9]|2\d|3[0-1])\.\d{1,3}\.\d{1,3})(:\d+)?$/i.test(saved);
    const savedIsHttp = /^http:\/\//i.test(saved);
    if (savedIsLocal || savedIsHttp) {
      return API;
    }
  }
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

function fileToDataUrl(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error("Failed to read file."));
    reader.onload = () => resolve(reader.result);
    reader.readAsDataURL(file);
  });
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
  const [uploadedImages, setUploadedImages] = useState([]);
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
  const [newAreaCountry, setNewAreaCountry] = useState("");
  const [newAreaCounty, setNewAreaCounty] = useState("");
  const [newAreaName, setNewAreaName] = useState("");
  const [deleteAreaCountry, setDeleteAreaCountry] = useState("");
  const [deleteAreaCounty, setDeleteAreaCounty] = useState("");
  const [deleteCountyCountry, setDeleteCountyCountry] = useState("");
  const [deleteCountyName, setDeleteCountyName] = useState("");
  const [editCountyCountry, setEditCountyCountry] = useState("");
  const [editCountyName, setEditCountyName] = useState("");
  const [editCountyNewName, setEditCountyNewName] = useState("");
  const [editAreaCountry, setEditAreaCountry] = useState("");
  const [editAreaCounty, setEditAreaCounty] = useState("");
  const [editAreaName, setEditAreaName] = useState("");
  const [editAreaNewName, setEditAreaNewName] = useState("");
  const [deleteAreaName, setDeleteAreaName] = useState("");

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
  const [downloadFormat, setDownloadFormat] = useState("csv");

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
    const savedPhone = localStorage.getItem("superAdminLoginPhone") || "";
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

  async function handleImageFiles(files) {
    const maxBytes = 2 * 1024 * 1024;
    if (!files || !files.length) return;
    const accepted = files.filter((file) => file.size <= maxBytes);
    if (accepted.length !== files.length) {
      showMessage("Some images were skipped (max size 2MB each).", true);
    }
    if (!accepted.length) return;

    try {
      const dataUrls = await Promise.all(accepted.map((file) => fileToDataUrl(file)));
      setUploadedImages((prev) => [...prev, ...dataUrls]);
      showMessage(`${dataUrls.length} image${dataUrls.length === 1 ? "" : "s"} added.`);
    } catch (_err) {
      showMessage("Failed to add selected images.", true);
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
      if (PORTAL_ROLE === "superadmin" && !data.user.isSuperAdmin) {
        throw new Error("Wrong credentials.");
      }

      setToken(data.token);
      setIsAdminAuthenticated(true);
      setIsSuperAdmin(true);
      setShowForgotHelp(false);
      if (rememberMe) localStorage.setItem("superAdminLoginPhone", adminPhone.trim());
      else localStorage.removeItem("superAdminLoginPhone");
      showMessage("Super admin portal login successful.");
      const baseLoads = [
        loadPlots(data.token),
        loadUsers(data.token),
        loadPayments(data.token),
        loadAnalytics(data.token),
        loadActiveAccounts(data.token),
        loadLocationMetadata(data.token)
      ];
      baseLoads.push(loadAdminAccounts(data.token));
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
        body: JSON.stringify({ country: newAreaCountry, county: newAreaCounty, area: newAreaName.trim() })
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

  async function deleteAreaBySuperAdmin() {
    if (!isSuperAdmin) return showMessage("Super admin login required.", true);
    const country = String(deleteAreaCountry || "").trim();
    const county = String(deleteAreaCounty || "").trim();
    const area = String(deleteAreaName || "").trim();
    if (!country || !county || !area) return showMessage("Select country, county, and area to delete.", true);
    if (!window.confirm(`Delete area "${area}" from county "${county}" (${country})?`)) return;
    setBusy(true);
    try {
      const data = await api("/api/super-admin/locations/area", {
        method: "DELETE",
        body: JSON.stringify({ country, county, area })
      });
      showMessage(data.message || "Area deleted.");
      setDeleteAreaName("");
      await loadLocationMetadata();
    } catch (err) {
      showMessage(err.message || "Failed to delete area.", true);
    } finally {
      setBusy(false);
    }
  }

  async function deleteCountyBySuperAdmin() {
    if (!isSuperAdmin) return showMessage("Super admin login required.", true);
    const country = String(deleteCountyCountry || "").trim();
    const county = String(deleteCountyName || "").trim();
    if (!country || !county) return showMessage("Select country and county to delete.", true);
    if (!window.confirm(`Delete county "${county}" from ${country}? This will remove all its areas.`)) return;
    setBusy(true);
    try {
      const data = await api("/api/super-admin/locations/county", {
        method: "DELETE",
        body: JSON.stringify({ country, county })
      });
      showMessage(data.message || "County deleted.");
      setDeleteCountyName("");
      await loadLocationMetadata();
    } catch (err) {
      showMessage(err.message || "Failed to delete county.", true);
    } finally {
      setBusy(false);
    }
  }

  async function editCountyBySuperAdmin() {
    if (!isSuperAdmin) return showMessage("Super admin login required.", true);
    const country = String(editCountyCountry || "").trim();
    const county = String(editCountyName || "").trim();
    const newCounty = String(editCountyNewName || "").trim();
    if (!country || !county || !newCounty) return showMessage("Select country, county, and new county name.", true);
    setBusy(true);
    try {
      const data = await api("/api/super-admin/locations/county", {
        method: "PUT",
        body: JSON.stringify({ country, county, newCounty })
      });
      showMessage(data.message || "County updated.");
      setEditCountyNewName("");
      await loadLocationMetadata();
    } catch (err) {
      showMessage(err.message || "Failed to update county.", true);
    } finally {
      setBusy(false);
    }
  }

  async function editAreaBySuperAdmin() {
    if (!isSuperAdmin) return showMessage("Super admin login required.", true);
    const country = String(editAreaCountry || "").trim();
    const county = String(editAreaCounty || "").trim();
    const area = String(editAreaName || "").trim();
    const newArea = String(editAreaNewName || "").trim();
    if (!country || !county || !area || !newArea) {
      return showMessage("Select country, county, area, and new area name.", true);
    }
    setBusy(true);
    try {
      const data = await api("/api/super-admin/locations/area", {
        method: "PUT",
        body: JSON.stringify({ country, county, area, newArea })
      });
      showMessage(data.message || "Area updated.");
      setEditAreaNewName("");
      await loadLocationMetadata();
    } catch (err) {
      showMessage(err.message || "Failed to update area.", true);
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
        images: [...commaUrls(plotForm.images), ...uploadedImages],
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
      setUploadedImages([]);
      showMessage("Plot created.");
      try {
        await Promise.all([loadPlots(), loadAnalytics()]);
      } catch (err) {
        showMessage(`Plot created, but refresh failed: ${err.message}`, true);
      }
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
      showMessage("Plot deleted successfully.");
    } catch (err) {
      showMessage(err.message, true);
    } finally {
      setBusy(false);
    }
  }

  function downloadDataset(name, headers, rows) {
    if (!rows || rows.length === 0) {
      showMessage(`No ${name} records to download.`, true);
      return;
    }
    const csv = buildCsv(headers, rows);
    const stamp = new Date().toISOString().slice(0, 10);
    const asExcel = downloadFormat === "excel";
    const ext = asExcel ? "xls" : "csv";
    const mime = asExcel ? "application/vnd.ms-excel" : "text/csv;charset=utf-8;";
    triggerDownload(`${name}-${stamp}.${ext}`, csv, mime);
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
      { label: "Images", value: (p) => (p.images || []).join(" | ") },
      { label: "Videos", value: (p) => (p.videos || []).join(" | ") }
    ], plots);
  }

  function downloadUsers() {
    downloadDataset("users", [
      { label: "User ID", value: (u) => u.id },
      { label: "Phone", value: (u) => u.phone },
      { label: "Role", value: (u) => u.role || (u.is_super_admin ? "super_admin" : u.is_admin ? "admin" : "user") },
      { label: "Is Admin", value: (u) => (u.is_admin ? "yes" : "no") },
      { label: "Is Super Admin", value: (u) => (u.is_super_admin ? "yes" : "no") },
      { label: "Created", value: (u) => formatDate(u.createdAt) },
      { label: "Activated", value: (u) => formatDate(u.activatedAt || u.activated_at) },
      { label: "Expires", value: (u) => formatDate(u.expiresAt || u.expires_at) },
      { label: "Payment Status", value: (u) => (u.paymentStatus ? "active" : "-") }
    ], users);
  }

  function downloadPayments() {
    downloadDataset("payments", [
      { label: "Payment ID", value: (p) => p.id },
      { label: "User ID", value: (p) => p.userId || "" },
      { label: "Phone", value: (p) => p.phone || "" },
      { label: "Amount", value: (p) => p.amount },
      { label: "Status", value: (p) => p.status },
      { label: "Receipt", value: (p) => p.mpesaReceipt || "" },
      { label: "Activated", value: (p) => formatDate(p.activatedAt) },
      { label: "Expires", value: (p) => formatDate(p.expiresAt) },
      { label: "Created", value: (p) => formatDate(p.timestamp || p.createdAt) }
    ], payments);
  }

  function downloadAdminAccounts() {
    downloadDataset("admin-accounts", [
      { label: "Admin ID", value: (a) => a.id },
      { label: "Login Phone", value: (a) => a.loginPhone },
      { label: "Role", value: (a) => a.role === "super_admin" ? "Super Admin" : "Admin" },
      { label: "Created", value: (a) => formatDate(a.createdAt) },
      { label: "Lock Status", value: (a) => a.lockUntil ? `Locked until ${formatDate(a.lockUntil)}` : "Unlocked" }
    ], adminAccounts);
  }

  function downloadActiveAccounts() {
    downloadDataset("active-accounts", [
      { label: "User ID", value: (a) => a.userId },
      { label: "Phone", value: (a) => a.phone || "" },
      { label: "Activated", value: (a) => formatDate(a.activatedAt) },
      { label: "Expires", value: (a) => formatDate(a.expiresAt) },
      { label: "Remaining", value: (a) => `${a.remainingHours}h ${a.remainingMinutes}m (${a.remainingSeconds}s)` },
      { label: "Receipt", value: (a) => a.mpesaReceipt || "" }
    ], activeAccounts);
  }

  async function runExportThenDelete(label, rows, exportFn, deleteFn, onDone) {
    if (!isSuperAdmin) return showMessage("Super admin login required.", true);
    if (!rows.length) return showMessage(`No ${label.toLowerCase()} records to export.`, true);
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
      if (typeof onDone === "function") {
        await onDone();
      }
      if (failed) showMessage(`Exported ${label}. Deleted ${deleted}/${rows.length}; failed ${failed}.`, true);
      else showMessage(`Exported and deleted ${deleted} ${label.toLowerCase()} records.`);
    } finally {
      setBusy(false);
    }
  }

  function exportDeletePlots() {
    return runExportThenDelete(
      "Plots",
      plots,
      downloadPlots,
      (row) => api(`/api/admin/plots/${encodeURIComponent(row.id)}`, { method: "DELETE" }),
      () => Promise.all([loadPlots(), loadAnalytics()])
    );
  }

  function exportDeleteUsers() {
    const deletable = users.filter((u) => !u.is_admin && !u.is_super_admin);
    return runExportThenDelete(
      "Users",
      deletable,
      () => downloadDataset("users", [
        { label: "User ID", value: (u) => u.id },
        { label: "Phone", value: (u) => u.phone },
        { label: "Role", value: (u) => u.role || (u.is_super_admin ? "super_admin" : u.is_admin ? "admin" : "user") },
        { label: "Created", value: (u) => formatDate(u.createdAt) },
        { label: "Activated", value: (u) => formatDate(u.activatedAt || u.activated_at) },
        { label: "Expires", value: (u) => formatDate(u.expiresAt || u.expires_at) },
        { label: "Payment Status", value: (u) => (u.paymentStatus ? "active" : "-") }
      ], deletable),
      (row) => api(`/api/super-admin/users/${encodeURIComponent(row.id)}`, { method: "DELETE" }),
      () => Promise.all([loadUsers(), loadPayments(), loadAnalytics(), loadActiveAccounts()])
    );
  }

  function exportDeletePayments() {
    return runExportThenDelete(
      "Payments",
      payments,
      downloadPayments,
      (row) => api(`/api/super-admin/payments/${encodeURIComponent(row.id)}`, { method: "DELETE" }),
      () => Promise.all([loadPayments(), loadUsers(), loadAnalytics(), loadActiveAccounts()])
    );
  }

  function exportDeleteActivations() {
    return runExportThenDelete(
      "Activations",
      activeAccounts,
      downloadActiveAccounts,
      (row) => api(`/api/super-admin/activations/${encodeURIComponent(row.userId)}`, { method: "DELETE" }),
      () => Promise.all([loadActiveAccounts(), loadUsers(), loadPayments(), loadAnalytics()])
    );
  }

  async function deleteUserBySuperAdmin(userId) {
    if (!isSuperAdmin) return showMessage("Super admin login required.", true);
    if (!window.confirm("Delete this user and their related payments?")) return;
    setBusy(true);
    try {
      const res = await api(`/api/super-admin/users/${encodeURIComponent(userId)}`, { method: "DELETE" });
      showMessage(res.message || "User deleted.");
      await Promise.all([loadUsers(), loadPayments(), loadAnalytics(), loadActiveAccounts()]);
    } catch (err) {
      showMessage(err.message || "Failed to delete user.", true);
    } finally {
      setBusy(false);
    }
  }

  async function deletePaymentBySuperAdmin(paymentId) {
    if (!isSuperAdmin) return showMessage("Super admin login required.", true);
    if (!window.confirm("Delete this payment record?")) return;
    setBusy(true);
    try {
      const res = await api(`/api/super-admin/payments/${encodeURIComponent(paymentId)}`, { method: "DELETE" });
      showMessage(res.message || "Payment deleted.");
      await Promise.all([loadPayments(), loadUsers(), loadAnalytics(), loadActiveAccounts()]);
    } catch (err) {
      showMessage(err.message || "Failed to delete payment.", true);
    } finally {
      setBusy(false);
    }
  }

  async function deleteActivationBySuperAdmin(userId) {
    if (!isSuperAdmin) return showMessage("Super admin login required.", true);
    if (!window.confirm("Delete active activation records for this user?")) return;
    setBusy(true);
    try {
      const res = await api(`/api/super-admin/activations/${encodeURIComponent(userId)}`, { method: "DELETE" });
      showMessage(res.message || "Activation records deleted.");
      await Promise.all([loadActiveAccounts(), loadUsers(), loadPayments(), loadAnalytics()]);
    } catch (err) {
      showMessage(err.message || "Failed to delete activation records.", true);
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
    if (!newAreaCountry) {
      setNewAreaCountry((locationMeta.countries || [])[0] || "");
    }
  }, [locationMeta, newAreaCountry]);

  useEffect(() => {
    if (!newAreaCountry) return;
    const list = locationMeta.countiesByCountry?.[newAreaCountry] || [];
    if (!list.includes(newAreaCounty)) {
      setNewAreaCounty(list[0] || "");
    }
  }, [locationMeta, newAreaCountry, newAreaCounty]);

  useEffect(() => {
    if (!deleteAreaCountry) {
      setDeleteAreaCountry((locationMeta.countries || [])[0] || "");
    }
  }, [locationMeta, deleteAreaCountry]);

  useEffect(() => {
    if (!deleteAreaCountry) return;
    const list = locationMeta.countiesByCountry?.[deleteAreaCountry] || [];
    if (!list.includes(deleteAreaCounty)) {
      setDeleteAreaCounty(list[0] || "");
    }
  }, [locationMeta, deleteAreaCountry, deleteAreaCounty]);

  useEffect(() => {
    const areas = locationMeta.areasByCounty?.[deleteAreaCounty] || [];
    if (!areas.length) {
      setDeleteAreaName("");
      return;
    }
    if (!areas.includes(deleteAreaName)) {
      setDeleteAreaName(areas[0]);
    }
  }, [locationMeta, deleteAreaCounty, deleteAreaName]);

  useEffect(() => {
    if (!deleteCountyCountry) {
      setDeleteCountyCountry((locationMeta.countries || [])[0] || "");
    }
  }, [locationMeta, deleteCountyCountry]);

  useEffect(() => {
    if (!deleteCountyCountry) return;
    const list = locationMeta.countiesByCountry?.[deleteCountyCountry] || [];
    if (!list.includes(deleteCountyName)) {
      setDeleteCountyName(list[0] || "");
    }
  }, [locationMeta, deleteCountyCountry, deleteCountyName]);

  useEffect(() => {
    if (!editCountyCountry) {
      setEditCountyCountry((locationMeta.countries || [])[0] || "");
    }
  }, [locationMeta, editCountyCountry]);

  useEffect(() => {
    if (!editCountyCountry) return;
    const list = locationMeta.countiesByCountry?.[editCountyCountry] || [];
    if (!list.includes(editCountyName)) {
      setEditCountyName(list[0] || "");
    }
  }, [locationMeta, editCountyCountry, editCountyName]);

  useEffect(() => {
    if (!editAreaCountry) {
      setEditAreaCountry((locationMeta.countries || [])[0] || "");
    }
  }, [locationMeta, editAreaCountry]);

  useEffect(() => {
    if (!editAreaCountry) return;
    const list = locationMeta.countiesByCountry?.[editAreaCountry] || [];
    if (!list.includes(editAreaCounty)) {
      setEditAreaCounty(list[0] || "");
    }
  }, [locationMeta, editAreaCountry, editAreaCounty]);

  useEffect(() => {
    const areas = locationMeta.areasByCounty?.[editAreaCounty] || [];
    if (!areas.includes(editAreaName)) {
      setEditAreaName(areas[0] || "");
    }
  }, [locationMeta, editAreaCounty, editAreaName]);

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
      items.push({ id: "admin-login", label: "Super Admin Login", icon: "◉" });
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
          <span>TST PlotConnect Super Admin</span>
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
          <p className="hero-kicker">SUPER ADMIN COMMAND CENTER</p>
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
                  <input
                    className="input-modern p-3 rounded-xl md:col-span-2"
                    type="file"
                    accept="image/*"
                    multiple
                    onChange=${async (e) => {
                      const files = Array.from(e.target.files || []);
                      await handleImageFiles(files);
                      e.target.value = "";
                    }}
                  />
                  <p className="text-xs text-muted md:col-span-2">You can paste image URLs or upload images (max 2MB each).</p>
                  ${uploadedImages.length
                    ? html`<p className="text-xs text-emerald-400 md:col-span-2">Uploaded images: ${uploadedImages.length}</p>`
                    : null}
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
                      <p className="text-xs font-semibold text-muted uppercase tracking-[0.18em] mb-2">Add County</p>
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
                        <button className="btn-success rounded-xl p-3 w-full" onClick=${addCountyBySuperAdmin} disabled=${busy}>Add County</button>
                      </div>
                      <p className="text-xs font-semibold text-muted uppercase tracking-[0.18em] mb-2">Update County</p>
                      <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mb-3">
                        <select className="input-modern p-3 rounded-xl" value=${editCountyCountry} onChange=${(e) => setEditCountyCountry(e.target.value)}>
                          <option value="">Select country</option>
                          ${(locationMeta.countries || []).map((c) => html`<option value=${c} key=${c}>${c}</option>`)}
                        </select>
                        <select className="input-modern p-3 rounded-xl" value=${editCountyName} onChange=${(e) => setEditCountyName(e.target.value)}>
                          <option value="">Select county</option>
                          ${(locationMeta.countiesByCountry?.[editCountyCountry] || []).map((c) => html`<option value=${c} key=${c}>${c}</option>`)}
                        </select>
                        <input
                          className="input-modern p-3 rounded-xl"
                          placeholder="New county name"
                          value=${editCountyNewName}
                          onInput=${(e) => setEditCountyNewName(e.target.value)}
                        />
                        <button className="btn-success rounded-xl p-3 w-full md:col-span-3" onClick=${editCountyBySuperAdmin} disabled=${busy || !editCountyCountry || !editCountyName || !editCountyNewName}>Update County</button>
                      </div>
                      <p className="text-xs font-semibold text-muted uppercase tracking-[0.18em] mb-2">Add Area</p>
                      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                        <select className="input-modern p-3 rounded-xl" value=${newAreaCountry} onChange=${(e) => setNewAreaCountry(e.target.value)}>
                          <option value="">Select country</option>
                          ${(locationMeta.countries || []).map((c) => html`<option value=${c} key=${c}>${c}</option>`)}
                        </select>
                        <select className="input-modern p-3 rounded-xl" value=${newAreaCounty} onChange=${(e) => setNewAreaCounty(e.target.value)}>
                          <option value="">Select county</option>
                          ${(locationMeta.countiesByCountry?.[newAreaCountry] || []).map((c) => html`<option value=${c} key=${c}>${c}</option>`)}
                        </select>
                        <input
                          className="input-modern p-3 rounded-xl"
                          placeholder="New area name"
                          value=${newAreaName}
                          onInput=${(e) => setNewAreaName(e.target.value)}
                        />
                        <button className="btn-success rounded-xl p-3 w-full md:col-span-3" onClick=${addAreaBySuperAdmin} disabled=${busy}>Add Area</button>
                      </div>
                      <p className="text-xs font-semibold text-muted uppercase tracking-[0.18em] mb-2">Update Area</p>
                      <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mb-3">
                        <select className="input-modern p-3 rounded-xl" value=${editAreaCountry} onChange=${(e) => setEditAreaCountry(e.target.value)}>
                          <option value="">Select country</option>
                          ${(locationMeta.countries || []).map((c) => html`<option value=${c} key=${c}>${c}</option>`)}
                        </select>
                        <select className="input-modern p-3 rounded-xl" value=${editAreaCounty} onChange=${(e) => setEditAreaCounty(e.target.value)}>
                          <option value="">Select county</option>
                          ${(locationMeta.countiesByCountry?.[editAreaCountry] || []).map((c) => html`<option value=${c} key=${c}>${c}</option>`)}
                        </select>
                        <select className="input-modern p-3 rounded-xl" value=${editAreaName} onChange=${(e) => setEditAreaName(e.target.value)}>
                          <option value="">Select area</option>
                          ${(locationMeta.areasByCounty?.[editAreaCounty] || []).map((a) => html`<option value=${a} key=${a}>${a}</option>`)}
                        </select>
                        <input
                          className="input-modern p-3 rounded-xl"
                          placeholder="New area name"
                          value=${editAreaNewName}
                          onInput=${(e) => setEditAreaNewName(e.target.value)}
                        />
                        <button className="btn-success rounded-xl p-3 w-full md:col-span-3" onClick=${editAreaBySuperAdmin} disabled=${busy || !editAreaCountry || !editAreaCounty || !editAreaName || !editAreaNewName}>Update Area</button>
                      </div>
                      <p className="text-xs font-semibold text-muted uppercase tracking-[0.18em] mb-2">Delete Area</p>
                      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                        <select className="input-modern p-3 rounded-xl" value=${deleteAreaCountry} onChange=${(e) => setDeleteAreaCountry(e.target.value)}>
                          <option value="">Select country</option>
                          ${(locationMeta.countries || []).map((c) => html`<option value=${c} key=${c}>${c}</option>`)}
                        </select>
                        <select className="input-modern p-3 rounded-xl" value=${deleteAreaCounty} onChange=${(e) => setDeleteAreaCounty(e.target.value)}>
                          <option value="">Select county</option>
                          ${(locationMeta.countiesByCountry?.[deleteAreaCountry] || []).map((c) => html`<option value=${c} key=${c}>${c}</option>`)}
                        </select>
                        <select className="input-modern p-3 rounded-xl" value=${deleteAreaName} onChange=${(e) => setDeleteAreaName(e.target.value)}>
                          <option value="">Select area to delete</option>
                          ${(locationMeta.areasByCounty?.[deleteAreaCounty] || []).map((a) => html`<option value=${a} key=${a}>${a}</option>`)}
                        </select>
                        <button className="btn-chip btn-chip-danger rounded-xl p-3 w-full md:col-span-3" onClick=${deleteAreaBySuperAdmin} disabled=${busy || !deleteAreaCountry || !deleteAreaCounty || !deleteAreaName}>Delete Area</button>
                      </div>
                      <p className="text-xs font-semibold text-muted uppercase tracking-[0.18em] mb-2">Delete County</p>
                      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                        <select className="input-modern p-3 rounded-xl" value=${deleteCountyCountry} onChange=${(e) => setDeleteCountyCountry(e.target.value)}>
                          <option value="">Select country</option>
                          ${(locationMeta.countries || []).map((c) => html`<option value=${c} key=${c}>${c}</option>`)}
                        </select>
                        <select className="input-modern p-3 rounded-xl" value=${deleteCountyName} onChange=${(e) => setDeleteCountyName(e.target.value)}>
                          <option value="">Select county to delete</option>
                          ${(locationMeta.countiesByCountry?.[deleteCountyCountry] || []).map((c) => html`<option value=${c} key=${c}>${c}</option>`)}
                        </select>
                        <button className="btn-chip btn-chip-danger rounded-xl p-3 w-full" onClick=${deleteCountyBySuperAdmin} disabled=${busy || !deleteCountyCountry || !deleteCountyName}>Delete County</button>
                      </div>
                    </section>
                  `
                : null}

              <section id="admin-plots" className="glass fade-in p-6 rounded-2xl mb-6 dashboard-card">
                <div className="flex items-center justify-between mb-4">
                  <h2 className="text-xl font-bold text-emerald-400">Plots</h2>
                  <div className="flex items-center gap-2">
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
                <div className="flex items-center justify-between mb-4">
                  <h2 className="text-xl font-bold text-emerald-400">Users & Activations</h2>
                  <div className="flex items-center gap-2">
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
                            ${isSuperAdmin && !u.is_admin && !u.is_super_admin
                              ? html`<button className="btn-chip btn-chip-danger" onClick=${() => deleteUserBySuperAdmin(u.id)}>Delete</button>`
                              : null}
                          </td>
                        </tr>
                      `)}
                    </tbody>
                  </table>
                </div>
              </section>

              <section id="admin-payments" className="glass fade-in p-6 rounded-2xl mt-6 dashboard-card">
                <div className="flex items-center justify-between mb-4">
                  <h2 className="text-xl font-bold text-emerald-400">Payments</h2>
                  <div className="flex items-center gap-2">
                    <button className="btn-soft px-4 py-2 rounded-xl" onClick=${downloadPayments} disabled=${busy}>Export Payments</button>
                  </div>
                </div>
                <div className="overflow-x-auto">
                  <table className="min-w-full text-left data-table">
                    <thead><tr><th className="p-2">Payment ID</th><th className="p-2">User</th><th className="p-2">Amount</th><th className="p-2">Status</th><th className="p-2">Receipt</th><th className="p-2">Created</th><th className="p-2">Action</th></tr></thead>
                    <tbody>
                      ${payments.map((p) => html`
                        <tr key=${p.id} className="admin-row border-t border-slate-700">
                          <td className="p-2">${p.id}</td>
                          <td className="p-2">${p.phone || "-"}</td>
                          <td className="p-2">Ksh ${p.amount}</td>
                          <td className="p-2">${p.status}</td>
                          <td className="p-2">${p.mpesaReceipt || "-"}</td>
                          <td className="p-2">${formatDate(p.timestamp || p.createdAt)}</td>
                          <td className="p-2">
                            ${isSuperAdmin
                              ? html`<button className="btn-chip btn-chip-danger" onClick=${() => deletePaymentBySuperAdmin(p.id)}>Delete</button>`
                              : null}
                          </td>
                        </tr>
                      `)}
                    </tbody>
                  </table>
                </div>
              </section>

              <section id="admin-active-accounts" className="glass fade-in p-6 rounded-2xl mt-6 dashboard-card">
                <div className="flex items-center justify-between mb-4">
                  <h2 className="text-xl font-bold text-emerald-400">Active Accounts Check</h2>
                  <div className="flex items-center gap-2">
                    <button className="btn-soft px-4 py-2 rounded-xl" onClick=${downloadActiveAccounts} disabled=${busy}>Export Activations</button>
                    <button className="btn-soft px-4 py-2 rounded-xl" onClick=${() => loadActiveAccounts()} disabled=${busy}>Refresh Active Accounts</button>
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
                        <th className="p-2">Action</th>
                      </tr>
                    </thead>
                    <tbody>
                      ${activeAccounts.length === 0
                        ? html`<tr><td className="p-2 text-muted" colSpan="7">No active accounts found.</td></tr>`
                        : activeAccounts.map((a) => html`
                            <tr key=${a.userId} className="admin-row border-t border-slate-700">
                              <td className="p-2">${a.userId}</td>
                              <td className="p-2">${a.phone || "-"}</td>
                              <td className="p-2">${formatDate(a.activatedAt)}</td>
                              <td className="p-2">${formatDate(a.expiresAt)}</td>
                              <td className="p-2">${a.remainingHours}h ${a.remainingMinutes}m (${a.remainingSeconds}s)</td>
                              <td className="p-2">${a.mpesaReceipt || "-"}</td>
                              <td className="p-2">
                                <button className="btn-chip btn-chip-danger" onClick=${() => deleteActivationBySuperAdmin(a.userId)}>Delete</button>
                              </td>
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
