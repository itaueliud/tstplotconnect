"use client";

import { useEffect, useMemo, useState, type CSSProperties } from "react";
import { apiRequest } from "@/lib/api";
import PasswordField from "@/components/user/password-field";
import { clearUserSession, readUserSession, writeUserSession } from "@/components/user/user-session";

type User = {
  id?: string;
  name?: string;
  phone?: string;
  isAdmin?: boolean;
  isSuperAdmin?: boolean;
  country?: string;
};

type Plot = {
  id?: string;
  title?: string;
  category?: string;
  country?: string;
  county?: string;
  area?: string;
  price?: number;
  priority?: string;
};

type Payment = {
  id?: string;
  userId?: string;
  phone?: string;
  amount?: number;
  status?: string;
  timestamp?: string;
};

type Analytics = {
  totalPlots?: number;
  totalUsers?: number;
  totalPayments?: number;
  activeAccounts?: number;
};

type AdminAccount = {
  id?: string;
  phone?: string;
  isActive?: boolean;
  createdAt?: string;
};

type LocationMeta = {
  countries: string[];
  countiesByCountry: Record<string, string[]>;
  areasByCounty: Record<string, string[]>;
};

type Props = {
  mode: "superadmin";
};

const inputStyle: CSSProperties = {
  width: "100%",
  border: "1px solid rgba(148, 163, 184, 0.28)",
  borderRadius: 14,
  padding: "0.8rem 0.9rem",
  background: "rgba(255,255,255,0.96)",
  color: "#0f172a"
};

function fmtDate(value?: string): string {
  if (!value) return "-";
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? "-" : date.toLocaleString();
}

function splitCsv(value: string): string[] {
  return String(value || "")
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);
}

function Stat({ value, label }: { value: number | string; label: string }) {
  return (
    <article className="dashboard-stat">
      <div className="value">{value}</div>
      <div className="label">{label}</div>
    </article>
  );
}

export default function DashboardPortalClient({ mode }: Props) {
  const [phone, setPhone] = useState("");
  const [password, setPassword] = useState("");
  const [token, setToken] = useState("");
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  const [plots, setPlots] = useState<Plot[]>([]);
  const [users, setUsers] = useState<User[]>([]);
  const [payments, setPayments] = useState<Payment[]>([]);
  const [activeAccounts, setActiveAccounts] = useState<User[]>([]);
  const [analytics, setAnalytics] = useState<Analytics | null>(null);
  const [admins, setAdmins] = useState<AdminAccount[]>([]);
  const [locationMeta, setLocationMeta] = useState<LocationMeta>({ countries: [], countiesByCountry: {}, areasByCounty: {} });

  const [plotForm, setPlotForm] = useState({
    title: "",
    price: "",
    category: "",
    country: "Kenya",
    county: "",
    area: "",
    caretaker: "",
    whatsapp: "",
    mapLink: "",
    description: "",
    priority: "medium",
    images: "",
    videos: ""
  });

  const [newAdminPhone, setNewAdminPhone] = useState("");
  const [newAdminPassword, setNewAdminPassword] = useState("");
  const [newCountyCountry, setNewCountyCountry] = useState("Kenya");
  const [newCountyName, setNewCountyName] = useState("");
  const [newAreaCountry, setNewAreaCountry] = useState("Kenya");
  const [newAreaCounty, setNewAreaCounty] = useState("");
  const [newAreaName, setNewAreaName] = useState("");

  const isLoggedIn = Boolean(token && currentUser?.isSuperAdmin);
  const canManageSuperAdmin = Boolean(currentUser?.isSuperAdmin);
  const availableCountries = useMemo(
    () => (locationMeta.countries.length ? locationMeta.countries : ["Kenya", "Uganda", "Tanzania"]),
    [locationMeta.countries]
  );

  function showSuccess(text: string) {
    setMessage(text);
    setError("");
  }

  function showError(text: string) {
    setError(text);
    setMessage("");
  }

  useEffect(() => {
    if (!message && !error) return;
    const timeout = window.setTimeout(() => {
      setMessage("");
      setError("");
    }, 4000);
    return () => window.clearTimeout(timeout);
  }, [message, error]);

  useEffect(() => {
    const stored = readUserSession();
    if (!stored?.token) return;
    setToken(stored.token);
    setCurrentUser(stored.user as User | null);
    void loadDashboardData(stored.token);
  }, []);

  async function loadDashboardData(authToken: string) {
    const [plotsRows, usersRows, paymentsRows, analyticsData, activeRows, metaRows] = await Promise.all([
      apiRequest<Plot[]>("/api/admin/plots", { token: authToken }),
      apiRequest<User[]>("/api/admin/users", { token: authToken }),
      apiRequest<Payment[]>("/api/admin/payments", { token: authToken }),
      apiRequest<Analytics>("/api/admin/analytics", { token: authToken }),
      apiRequest<User[]>("/api/admin/accounts/active", { token: authToken }),
      apiRequest<LocationMeta>("/api/metadata/locations", { token: authToken })
    ]);

    setPlots(Array.isArray(plotsRows) ? plotsRows : []);
    setUsers(Array.isArray(usersRows) ? usersRows : []);
    setPayments(Array.isArray(paymentsRows) ? paymentsRows : []);
    setAnalytics(analyticsData || null);
    setActiveAccounts(Array.isArray(activeRows) ? activeRows : []);
    setLocationMeta(
      metaRows || {
        countries: [],
        countiesByCountry: {},
        areasByCounty: {}
      }
    );

    const adminRows = await apiRequest<AdminAccount[]>("/api/super-admin/admins", { token: authToken });
    setAdmins(Array.isArray(adminRows) ? adminRows : []);
  }

  async function login() {
    setBusy(true);
    try {
      const data = await apiRequest<{ token: string; user: User }>("/api/login", {
        method: "POST",
        body: JSON.stringify({ phone: phone.trim(), password })
      });

      if (!data.user?.isSuperAdmin) {
        throw new Error("Superadmin access required.");
      }

      setToken(data.token);
      setCurrentUser(data.user);
      writeUserSession({ token: data.token, user: data.user });
      await loadDashboardData(data.token);
      showSuccess("Dashboard login successful.");
    } catch (e) {
      showError(e instanceof Error ? e.message : "Login failed.");
    } finally {
      setBusy(false);
    }
  }

  async function createPlot() {
    if (!token) return;
    setBusy(true);
    try {
      await apiRequest("/api/admin/plots", {
        method: "POST",
        token,
        body: JSON.stringify({
          ...plotForm,
          price: Number(plotForm.price) || 0,
          images: splitCsv(plotForm.images),
          videos: splitCsv(plotForm.videos)
        })
      });
      await loadDashboardData(token);
      setPlotForm({
        title: "",
        price: "",
        category: "",
        country: "Kenya",
        county: "",
        area: "",
        caretaker: "",
        whatsapp: "",
        mapLink: "",
        description: "",
        priority: "medium",
        images: "",
        videos: ""
      });
      showSuccess("Plot created successfully.");
    } catch (e) {
      showError(e instanceof Error ? e.message : "Failed to create plot.");
    } finally {
      setBusy(false);
    }
  }

  async function activateAccount(userId: string) {
    if (!token || !userId) return;
    try {
      await apiRequest("/api/admin/activate", {
        method: "POST",
        token,
        body: JSON.stringify({ userId })
      });
      await loadDashboardData(token);
      showSuccess("Account activated.");
    } catch (e) {
      showError(e instanceof Error ? e.message : "Failed to activate.");
    }
  }

  async function revokeAccount(userId: string) {
    if (!token || !userId) return;
    if (!window.confirm("Are you sure you want to revoke this user's activation now?")) return;
    try {
      await apiRequest("/api/admin/revoke", {
        method: "POST",
        token,
        body: JSON.stringify({ userId })
      });
      await loadDashboardData(token);
      showSuccess("Account revoked.");
    } catch (e) {
      showError(e instanceof Error ? e.message : "Failed to revoke.");
    }
  }

  async function createAdmin() {
    if (!token) return;
    if (!canManageSuperAdmin) {
      showError("Only superadmin accounts can create superadmin users.");
      return;
    }
    try {
      await apiRequest("/api/super-admin/create-superadmin", {
        method: "POST",
        token,
        body: JSON.stringify({ phone: newAdminPhone.trim(), password: newAdminPassword })
      });
      setNewAdminPhone("");
      setNewAdminPassword("");
      await loadDashboardData(token);
      showSuccess("Superadmin account created.");
    } catch (e) {
      showError(e instanceof Error ? e.message : "Failed to create superadmin account.");
    }
  }

  async function addCounty() {
    if (!token) return;
    if (!canManageSuperAdmin) {
      showError("Only superadmin accounts can add counties.");
      return;
    }
    try {
      await apiRequest("/api/super-admin/locations/county", {
        method: "POST",
        token,
        body: JSON.stringify({ country: newCountyCountry.trim(), county: newCountyName.trim() })
      });
      setNewCountyName("");
      await loadDashboardData(token);
      showSuccess("County added.");
    } catch (e) {
      showError(e instanceof Error ? e.message : "Failed to add county.");
    }
  }

  async function addArea() {
    if (!token) return;
    if (!canManageSuperAdmin) {
      showError("Only superadmin accounts can add areas.");
      return;
    }
    try {
      await apiRequest("/api/super-admin/locations/area", {
        method: "POST",
        token,
        body: JSON.stringify({
          country: newAreaCountry.trim(),
          county: newAreaCounty.trim(),
          area: newAreaName.trim()
        })
      });
      setNewAreaName("");
      await loadDashboardData(token);
      showSuccess("Area added.");
    } catch (e) {
      showError(e instanceof Error ? e.message : "Failed to add area.");
    }
  }

  function logout() {
    setToken("");
    setCurrentUser(null);
    setMessage("");
    setError("");
    clearUserSession();
  }

  return (
    <main className="dashboard-shell">
      <div className="container">
        <div className="dashboard-topbar">
          <div className="brand">
            <span className="pill" style={{ background: "rgba(255,255,255,0.12)", color: "#fff", borderColor: "rgba(255,255,255,0.08)" }}>
              Superadmin
            </span>
            <strong>tstplotconnect control center</strong>
          </div>
          <div className="chip-row">
            {isLoggedIn ? <button className="btn btn-secondary" onClick={logout}>Logout</button> : null}
          </div>
        </div>

        {!isLoggedIn ? (
          <div className="login-shell">
            <div className="login-card">
              <section className="login-visual">
                <span className="pill" style={{ background: "rgba(255,255,255,0.12)", color: "#fff", borderColor: "rgba(255,255,255,0.1)" }}>
                  Operations, listings, and location control
                </span>
                <h1>Premium platform control with full location governance.</h1>
                <p style={{ color: "rgba(255,255,255,0.82)", lineHeight: 1.75, maxWidth: 600, margin: 0 }}>
                  A polished workspace for overseeing plots, users, payments, and location metadata while keeping the public marketplace fast and discoverable.
                </p>
                <div className="hero-badges" style={{ marginTop: "1rem" }}>
                  <span className="hero-badge">Real-time admin actions</span>
                  <span className="hero-badge">SEO-safe location updates</span>
                  <span className="hero-badge">Marketplace-ready operations</span>
                </div>
              </section>

              <section className="login-form-card">
                <p className="section-kicker" style={{ color: "#0f766e" }}>Secure sign in</p>
                <h2 style={{ marginTop: 0, fontSize: "1.5rem" }}>Enter your superadmin credentials</h2>
                <div className="search-grid" style={{ gridTemplateColumns: "1fr" }}>
                  <label className="search-field">
                    <span>Phone</span>
                    <input style={inputStyle} value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="07XXXXXXXX" />
                  </label>
                  <label className="search-field">
                    <span>Password</span>
                    <PasswordField placeholder="Password" value={password} onChange={setPassword} />
                  </label>
                </div>
                <button className="btn btn-primary" onClick={login} disabled={busy} style={{ width: "100%", marginTop: "1rem", padding: "0.95rem 1rem" }}>
                  {busy ? "Signing in..." : "Sign in"}
                </button>
                <p className="meta" style={{ marginTop: "0.85rem" }}>
                  Designed for fast moderation, clean operations, and controlled launch management.
                </p>
              </section>
            </div>
          </div>
        ) : (
          <div className="dashboard-frame">
            <aside className="dashboard-sidebar">
              <div>
                <span className="market-pill">{currentUser?.name || currentUser?.phone || "Superadmin"}</span>
                <h2 style={{ margin: "0.65rem 0 0.25rem", fontSize: "1.3rem" }}>Superadmin workspace</h2>
                <p className="meta" style={{ margin: 0 }}>
                  Access: Full platform governance
                </p>
              </div>

              <nav className="dashboard-nav" aria-label="Dashboard navigation">
                <a href="#dashboard-overview">Overview</a>
                <a href="#dashboard-plots">Plots</a>
                <a href="#dashboard-users">Users</a>
                <a href="#dashboard-payments">Payments</a>
                {canManageSuperAdmin ? <a href="#dashboard-superadmin">Superadmin</a> : null}
              </nav>

              <div className="card" style={{ background: "rgba(15, 23, 42, 0.04)", boxShadow: "none" }}>
                <p className="section-kicker" style={{ color: "#0f766e" }}>Live counts</p>
                <div className="chip-row">
                  <span className="chip">{analytics?.totalPlots ?? plots.length} plots</span>
                  <span className="chip">{analytics?.totalUsers ?? users.length} users</span>
                  <span className="chip">{analytics?.totalPayments ?? payments.length} payments</span>
                </div>
              </div>
            </aside>

            <section className="dashboard-content">
              <div className="dashboard-hero" id="dashboard-overview">
                <span className="pill" style={{ background: "rgba(255,255,255,0.12)", color: "#fff", borderColor: "rgba(255,255,255,0.08)" }}>
                  Marketplace operations
                </span>
                <h1>Run the platform with full oversight.</h1>
                <p>This dashboard is structured for speed, trust, and control, so your team can manage listings and location data without clutter.</p>
              </div>

              <section className="dashboard-stat-grid">
                <Stat value={analytics?.totalPlots ?? plots.length} label="Published plots" />
                <Stat value={analytics?.totalUsers ?? users.length} label="Registered users" />
                <Stat value={analytics?.totalPayments ?? payments.length} label="Payment records" />
                <Stat value={analytics?.activeAccounts ?? activeAccounts.length} label="Active accounts" />
              </section>

              <div className="dashboard-grid-2">
                <section className="dashboard-panel" id="dashboard-plots">
                  <p className="section-kicker" style={{ color: "#0f766e" }}>Create listing</p>
                  <h2 style={{ marginTop: 0 }}>Add a new plot</h2>
                  <div className="search-grid" style={{ gridTemplateColumns: "repeat(auto-fit, minmax(190px, 1fr))" }}>
                    <label className="search-field"><span>Title</span><input style={inputStyle} value={plotForm.title} onChange={(e) => setPlotForm((p) => ({ ...p, title: e.target.value }))} /></label>
                    <label className="search-field"><span>Category</span><input style={inputStyle} value={plotForm.category} onChange={(e) => setPlotForm((p) => ({ ...p, category: e.target.value }))} /></label>
                    <label className="search-field"><span>Price</span><input style={inputStyle} value={plotForm.price} onChange={(e) => setPlotForm((p) => ({ ...p, price: e.target.value }))} /></label>
                    <label className="search-field"><span>Country</span><select style={inputStyle} value={plotForm.country} onChange={(e) => setPlotForm((p) => ({ ...p, country: e.target.value }))}>{availableCountries.map((country) => <option key={country} value={country}>{country}</option>)}</select></label>
                    <label className="search-field"><span>County</span><input style={inputStyle} value={plotForm.county} onChange={(e) => setPlotForm((p) => ({ ...p, county: e.target.value }))} /></label>
                    <label className="search-field"><span>Area</span><input style={inputStyle} value={plotForm.area} onChange={(e) => setPlotForm((p) => ({ ...p, area: e.target.value }))} /></label>
                    <label className="search-field"><span>MAP LINK</span><input style={inputStyle} value={plotForm.mapLink} onChange={(e) => setPlotForm((p) => ({ ...p, mapLink: e.target.value }))} placeholder="Paste Google Maps or OpenStreetMap link" /></label>
                    <label className="search-field"><span>Caretaker</span><input style={inputStyle} value={plotForm.caretaker} onChange={(e) => setPlotForm((p) => ({ ...p, caretaker: e.target.value }))} /></label>
                    <label className="search-field"><span>WhatsApp</span><input style={inputStyle} value={plotForm.whatsapp} onChange={(e) => setPlotForm((p) => ({ ...p, whatsapp: e.target.value }))} /></label>
                    <label className="search-field"><span>Priority</span><input style={inputStyle} value={plotForm.priority} onChange={(e) => setPlotForm((p) => ({ ...p, priority: e.target.value }))} /></label>
                    <label className="search-field"><span>Images</span><input style={inputStyle} value={plotForm.images} onChange={(e) => setPlotForm((p) => ({ ...p, images: e.target.value }))} /></label>
                    <label className="search-field"><span>Videos</span><input style={inputStyle} value={plotForm.videos} onChange={(e) => setPlotForm((p) => ({ ...p, videos: e.target.value }))} /></label>
                  </div>
                  <label className="search-field" style={{ marginTop: "0.8rem" }}>
                    <span>Description</span>
                    <textarea style={{ ...inputStyle, minHeight: 130 }} value={plotForm.description} onChange={(e) => setPlotForm((p) => ({ ...p, description: e.target.value }))} />
                  </label>
                  <button className="btn btn-primary" onClick={createPlot} disabled={busy} style={{ marginTop: "0.9rem" }}>
                    Save Plot
                  </button>
                </section>

                <section className="dashboard-panel">
                  <p className="section-kicker" style={{ color: "#0f766e" }}>Operations</p>
                  <h2 style={{ marginTop: 0 }}>Realtime control</h2>
                  <div className="feature-grid">
                    <article className="feature-card">
                      <h3>Platform health</h3>
                      <p>Review listing volume, user volume, and payment volume at a glance before taking action.</p>
                    </article>
                    <article className="feature-card">
                      <h3>Fast moderation</h3>
                      <p>Activate or revoke accounts in a clean workflow that stays readable on desktop and mobile.</p>
                    </article>
                    <article className="feature-card">
                      <h3>Location governance</h3>
                      <p>Keep county and area data aligned so your public marketplace remains accurate and searchable.</p>
                    </article>
                  </div>
                </section>
              </div>

              <section className="dashboard-table" id="dashboard-users">
                <div style={{ display: "flex", justifyContent: "space-between", gap: "1rem", flexWrap: "wrap", alignItems: "end" }}>
                  <div>
                    <p className="section-kicker" style={{ color: "#0f766e" }}>Users</p>
                    <h2 style={{ marginTop: 0 }}>User access and activation</h2>
                  </div>
                </div>
                <div className="table-scroll">
                  <table>
                    <thead>
                      <tr>
                        <th>Name</th>
                        <th>Phone</th>
                        <th>Country</th>
                        <th>Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {users.slice(0, 120).map((u) => (
                        <tr key={u.id || `${u.phone}-${u.name}`}>
                          <td>{u.name || "-"}</td>
                          <td>{u.phone || "-"}</td>
                          <td>{u.country || "-"}</td>
                          <td>
                            <div className="chip-row">
                              <button className="btn btn-secondary" onClick={() => activateAccount(String(u.id || ""))}>Activate</button>
                              <button className="btn btn-secondary" onClick={() => revokeAccount(String(u.id || ""))}>Revoke</button>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </section>

              <section className="dashboard-table" id="dashboard-payments">
                <div style={{ display: "flex", justifyContent: "space-between", gap: "1rem", flexWrap: "wrap", alignItems: "end" }}>
                  <div>
                    <p className="section-kicker" style={{ color: "#0f766e" }}>Payments</p>
                    <h2 style={{ marginTop: 0 }}>All payment requests</h2>
                  </div>
                </div>
                <div className="table-scroll">
                  <table>
                    <thead>
                      <tr>
                        <th>User</th>
                        <th>Phone</th>
                        <th>Amount</th>
                        <th>Time</th>
                        <th>Successful</th>
                        <th>Status</th>
                      </tr>
                    </thead>
                    <tbody>
                      {payments.map((p) => (
                        <tr key={p.id || `${p.userId}-${p.timestamp}`}>
                          <td>{p.userId || "-"}</td>
                          <td>{p.phone || "-"}</td>
                          <td>{typeof p.amount === "number" ? p.amount.toLocaleString() : "-"}</td>
                          <td>{fmtDate(p.timestamp)}</td>
                          <td>{String(p.status || "").toLowerCase() === "completed" ? "Yes" : "No"}</td>
                          <td>{p.status || "-"}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </section>

              {canManageSuperAdmin && (
                <section className="dashboard-panel" id="dashboard-superadmin">
                  <p className="section-kicker" style={{ color: "#0f766e" }}>Superadmin tools</p>
                  <h2 style={{ marginTop: 0 }}>Control location metadata and superadmin accounts</h2>
                  <div className="feature-grid">
                    <article className="feature-card">
                      <h3>Create superadmin</h3>
                      <label className="search-field"><span>Superadmin phone</span><input style={inputStyle} value={newAdminPhone} onChange={(e) => setNewAdminPhone(e.target.value)} /></label>
                      <label className="search-field" style={{ marginTop: "0.6rem" }}><span>Temporary password</span><PasswordField placeholder="Temporary password" value={newAdminPassword} onChange={setNewAdminPassword} /></label>
                      <button className="btn btn-primary" onClick={createAdmin} style={{ marginTop: "0.8rem" }}>Create Superadmin</button>
                    </article>
                    <article className="feature-card">
                      <h3>Add county</h3>
                      <label className="search-field"><span>Country</span><input style={inputStyle} value={newCountyCountry} onChange={(e) => setNewCountyCountry(e.target.value)} /></label>
                      <label className="search-field" style={{ marginTop: "0.6rem" }}><span>County</span><input style={inputStyle} value={newCountyName} onChange={(e) => setNewCountyName(e.target.value)} /></label>
                      <button className="btn btn-primary" onClick={addCounty} style={{ marginTop: "0.8rem" }}>Save County</button>
                    </article>
                    <article className="feature-card">
                      <h3>Add area</h3>
                      <label className="search-field"><span>Country</span><input style={inputStyle} value={newAreaCountry} onChange={(e) => setNewAreaCountry(e.target.value)} /></label>
                      <label className="search-field" style={{ marginTop: "0.6rem" }}><span>County</span><input style={inputStyle} value={newAreaCounty} onChange={(e) => setNewAreaCounty(e.target.value)} /></label>
                      <label className="search-field" style={{ marginTop: "0.6rem" }}><span>Area</span><input style={inputStyle} value={newAreaName} onChange={(e) => setNewAreaName(e.target.value)} /></label>
                      <button className="btn btn-primary" onClick={addArea} style={{ marginTop: "0.8rem" }}>Save Area</button>
                    </article>
                  </div>

                  <div className="dashboard-table" style={{ marginTop: "1rem" }}>
                    <div className="table-scroll">
                      <table>
                        <thead>
                          <tr>
                            <th>Phone</th>
                            <th>Active</th>
                            <th>Created</th>
                          </tr>
                        </thead>
                        <tbody>
                          {admins.map((admin) => (
                            <tr key={admin.id || admin.phone}>
                              <td>{admin.phone || "-"}</td>
                              <td>{admin.isActive ? "Yes" : "No"}</td>
                              <td>{fmtDate(admin.createdAt)}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                </section>
              )}

              {(message || error) && (
                <section className="card" style={{ borderColor: error ? "#fecaca" : undefined, background: "rgba(255,255,255,0.94)" }}>
                  <p style={{ margin: 0, color: error ? "#b91c1c" : "#0f766e", fontWeight: 700 }}>{error || message}</p>
                </section>
              )}
            </section>
          </div>
        )}
      </div>
    </main>
  );
}
