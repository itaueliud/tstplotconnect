"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { apiRequest } from "@/lib/api";

type Plot = {
  id?: string;
  title?: string;
  country?: string;
  county?: string;
  town?: string;
  area?: string;
  category?: string;
  price?: number;
  description?: string;
  images?: string[];
};

type User = {
  id?: string;
  name?: string;
  phone?: string;
  country?: string;
};

type UserStatus = {
  active?: boolean;
  activatedAt?: string;
  expiresAt?: string;
  remainingHours?: number;
  remainingMinutes?: number;
};

type Props = {
  initialCountry: string;
  initialCounty: string;
  initialTown: string;
  initialCategory: string;
};

const CATEGORIES = [
  "Rental Houses",
  "Bedsitters",
  "Hostels",
  "Apartments",
  "Lodges",
  "AirBnB",
  "Vacant Shops",
  "Office Spaces",
  "Guest Houses",
  "Plots for Sale"
] as const;

const QUICK_CATEGORY_CHIPS = ["Hostels", "Bedsitters", "Lodges", "Apartments", "Plots for Sale"] as const;

function sameValue(left: string, right: string): boolean {
  return left.trim().toLowerCase() === right.trim().toLowerCase();
}

function formatPrice(value?: number): string {
  return typeof value === "number" ? `KES ${value.toLocaleString()}` : "Price on request";
}

function listingImage(plot: Plot): string {
  return Array.isArray(plot.images) && plot.images[0] ? plot.images[0] : "";
}

function fmtDateTime(value?: string): string {
  if (!value) return "-";
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? "-" : date.toLocaleString();
}

export default function UserPortal({ initialCountry, initialCounty, initialTown, initialCategory }: Props) {
  const [token, setToken] = useState("");
  const [user, setUser] = useState<User | null>(null);
  const [status, setStatus] = useState<UserStatus | null>(null);

  const [registerName, setRegisterName] = useState("");
  const [registerCountry, setRegisterCountry] = useState(initialCountry || "Kenya");
  const [registerPhone, setRegisterPhone] = useState("");
  const [registerPassword, setRegisterPassword] = useState("");

  const [loginPhone, setLoginPhone] = useState("");
  const [loginPassword, setLoginPassword] = useState("");
  const [isLoginMode, setIsLoginMode] = useState(true);

  const [filters, setFilters] = useState({
    country: initialCountry || "Kenya",
    county: initialCounty || "",
    town: initialTown || "",
    area: "",
    category: initialCategory || "",
    minPrice: "",
    maxPrice: ""
  });

  const [plots, setPlots] = useState<Plot[]>([]);
  const [loading, setLoading] = useState(false);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  const [otpPhone, setOtpPhone] = useState("");
  const [otpCode, setOtpCode] = useState("");
  const [otpNewPassword, setOtpNewPassword] = useState("");

  const isLoggedIn = Boolean(token && user);

  const availableCategories = useMemo(() => {
    const dynamic = plots.map((plot) => String(plot.category || "").trim()).filter(Boolean);
    return Array.from(new Set([...CATEGORIES, ...dynamic]));
  }, [plots]);

  const filtered = useMemo(() => {
    return plots.filter((plot) => {
      const countryOk = filters.country ? sameValue(String(plot.country || ""), filters.country) : true;
      const countyOk = filters.county ? sameValue(String(plot.county || ""), filters.county) : true;
      const townOk = filters.town
        ? sameValue(String(plot.town || plot.area || ""), filters.town) || sameValue(String(plot.county || ""), filters.town)
        : true;
      const areaOk = filters.area ? sameValue(String(plot.area || ""), filters.area) : true;
      const categoryOk = filters.category ? sameValue(String(plot.category || ""), filters.category) : true;
      const hasMin = filters.minPrice.trim() !== "";
      const hasMax = filters.maxPrice.trim() !== "";
      const price = Number(plot.price);

      if (!countryOk || !countyOk || !townOk || !areaOk || !categoryOk) return false;
      if (hasMin && Number.isFinite(price) && price < Number(filters.minPrice)) return false;
      if (hasMax && Number.isFinite(price) && price > Number(filters.maxPrice)) return false;
      return true;
    });
  }, [plots, filters]);

  function showSuccess(text: string) {
    setMessage(text);
    setError("");
  }

  function showError(text: string) {
    setError(text);
    setMessage("");
  }

  async function loadPlots() {
    setLoading(true);
    try {
      const query = new URLSearchParams();
      if (filters.country) query.set("country", filters.country);
      if (filters.county) query.set("county", filters.county);
      if (!filters.county && filters.town) query.set("town", filters.town);
      if (filters.area) query.set("area", filters.area);
      if (filters.category) query.set("category", filters.category);
      if (filters.minPrice) query.set("minPrice", filters.minPrice);
      if (filters.maxPrice) query.set("maxPrice", filters.maxPrice);

      const rows = await apiRequest<Plot[]>(`/api/plots${query.toString() ? `?${query.toString()}` : ""}`);
      setPlots(Array.isArray(rows) ? rows : []);
    } catch (e) {
      showError(e instanceof Error ? e.message : "Unable to load plots.");
      setPlots([]);
    } finally {
      setLoading(false);
    }
  }

  async function loadStatus(authToken: string) {
    try {
      const s = await apiRequest<UserStatus>("/api/user/status", { token: authToken });
      setStatus(s || null);
    } catch (_e) {
      setStatus(null);
    }
  }

  async function registerUser() {
    setBusy(true);
    try {
      const data = await apiRequest<{ token: string; user: User }>("/api/user/register", {
        method: "POST",
        body: JSON.stringify({
          name: registerName.trim(),
          country: registerCountry.trim(),
          phone: registerPhone.trim(),
          password: registerPassword
        })
      });
      setToken(data.token);
      setUser(data.user);
      setFilters((prev) => ({ ...prev, country: data.user?.country || prev.country }));
      await loadStatus(data.token);
      showSuccess("Registration successful. Activate your account to unlock full access.");
      setRegisterPassword("");
    } catch (e) {
      showError(e instanceof Error ? e.message : "Registration failed.");
    } finally {
      setBusy(false);
    }
  }

  async function loginUser() {
    setBusy(true);
    try {
      const data = await apiRequest<{ token: string; user: User }>("/api/user/login", {
        method: "POST",
        body: JSON.stringify({ phone: loginPhone.trim(), password: loginPassword })
      });
      setToken(data.token);
      setUser(data.user);
      setFilters((prev) => ({ ...prev, country: data.user?.country || prev.country }));
      await loadStatus(data.token);
      showSuccess("Login successful.");
      setLoginPassword("");
    } catch (e) {
      showError(e instanceof Error ? e.message : "Login failed.");
    } finally {
      setBusy(false);
    }
  }

  async function requestCode() {
    setBusy(true);
    try {
      const data = await apiRequest<{ message?: string }>("/api/auth/request-code", {
        method: "POST",
        body: JSON.stringify({ phone: otpPhone.trim() })
      });
      showSuccess(data?.message || "OTP sent.");
    } catch (e) {
      showError(e instanceof Error ? e.message : "Failed to request OTP.");
    } finally {
      setBusy(false);
    }
  }

  async function verifyCodeAndReset() {
    setBusy(true);
    try {
      const data = await apiRequest<{ message?: string }>("/api/auth/verify-code", {
        method: "POST",
        body: JSON.stringify({
          phone: otpPhone.trim(),
          code: otpCode.trim(),
          newPassword: otpNewPassword
        })
      });
      showSuccess(data?.message || "Password reset successful.");
      setOtpCode("");
      setOtpNewPassword("");
    } catch (e) {
      showError(e instanceof Error ? e.message : "Failed to reset password.");
    } finally {
      setBusy(false);
    }
  }

  async function pay() {
    if (!token) {
      showError("Please login or register first.");
      return;
    }
    setBusy(true);
    try {
      const data = await apiRequest<{ message?: string }>("/api/pay", {
        method: "POST",
        token
      });
      await loadStatus(token);
      showSuccess(data?.message || "Payment initiated.");
    } catch (e) {
      showError(e instanceof Error ? e.message : "Payment failed.");
    } finally {
      setBusy(false);
    }
  }

  function logout() {
    setToken("");
    setUser(null);
    setStatus(null);
    showSuccess("Logged out.");
  }

  useEffect(() => {
    loadPlots();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <main className="container portal-shell" style={{ padding: "1.2rem 0 3rem" }}>
      <section className="portal-nav reveal-card">
        <div className="portal-nav-brand">
          <span className="pill">AfricaRentalGrid</span>
          <strong>Modern property search dashboard</strong>
        </div>
        <nav className="portal-nav-links" aria-label="User portal navigation">
          <a href="#dashboard">Dashboard</a>
          <a href="#listings">Listings</a>
          <a href="#about">About</a>
          <a href="#contact">Contact</a>
        </nav>
      </section>

      <section className="portal-hero reveal-card" id="dashboard" style={{ display: "flex", flexDirection: "row", alignItems: "flex-start", gap: "2.5rem", padding: "2.5rem 2rem 2rem 2rem", background: "#f8fafc", borderRadius: "1.2rem", boxShadow: "0 2px 16px rgba(0,0,0,0.06)", marginBottom: "2rem" }}>
        <div style={{ flex: 2, minWidth: 0 }}>
          <span className="pill" style={{ width: "fit-content", marginBottom: "0.7rem" }}>User dashboard</span>
          <h1 style={{ margin: 0, fontSize: "2.2rem", fontWeight: 800, color: "#0f172a" }}>Welcome to your dashboard</h1>
          <p style={{ margin: "0.7rem 0 0.5rem", color: "#334155", fontSize: "1.1rem" }}>
            Search, activate, and manage your access from a modern, left-aligned dashboard. Enjoy a streamlined experience with live filters, backend-powered listings, and instant account actions.
          </p>
        </div>
        <div className="portal-hero-meta" style={{ flex: 1, minWidth: 220, display: "flex", flexDirection: "column", gap: "0.7rem", alignItems: "flex-start" }}>
          <span className="portal-meta-chip">Listings loaded: {plots.length}</span>
          <span className="portal-meta-chip">Filtered: {filtered.length}</span>
          <span className="portal-meta-chip">Category: {filters.category || "All"}</span>
          <span className="portal-meta-chip">Account: {isLoggedIn ? "Signed in" : "Guest"}</span>
        </div>
      </section>

      <section className="portal-dashboard-grid">
        <article className="card portal-status-card reveal-card">
          <div className="portal-status-header">
            <div>
              <span className="pill">Activation</span>
              <h2>Account access</h2>
            </div>
            <span className={`portal-status-pill ${status?.active ? "is-active" : "is-inactive"}`}>
              {status?.active ? "Active" : "Inactive"}
            </span>
          </div>
          <p className="meta">
            {status?.active
              ? "Your account is active. You can continue browsing and unlocking more details."
              : "Activate your account to follow the full access flow from the backend."}
          </p>
          <div className="portal-status-grid">
            <div className="portal-status-metric">
              <strong>{status?.remainingHours ?? 0}h</strong>
              <span>Hours left</span>
            </div>
            <div className="portal-status-metric">
              <strong>{status?.remainingMinutes ?? 0}m</strong>
              <span>Minutes left</span>
            </div>
            <div className="portal-status-metric">
              <strong>{status?.expiresAt ? fmtDateTime(status.expiresAt) : "-"}</strong>
              <span>Expires at</span>
            </div>
          </div>
          <div className="portal-status-actions">
            <button className="btn btn-primary" onClick={pay} disabled={busy || !isLoggedIn}>
              {status?.active ? "Refresh Activation" : "Activate Account"}
            </button>
            {isLoggedIn && (
              <button className="btn btn-secondary" onClick={() => loadStatus(token)} disabled={busy}>
                Check Status
              </button>
            )}
          </div>
        </article>

        <article className="card portal-auth-card reveal-card">
          <div style={{ display: "flex", gap: "0.6rem", flexWrap: "wrap", marginBottom: "0.8rem" }}>
            <span className="pill">Access</span>
            {isLoggedIn && <span className="portal-account-line">Account: {user?.name || user?.phone}</span>}
          </div>
          <div style={{ display: "flex", gap: "0.6rem", flexWrap: "wrap", marginBottom: "0.8rem" }}>
            <button className={`btn ${isLoginMode ? "btn-primary" : "btn-secondary"}`} onClick={() => setIsLoginMode(true)}>
              Login
            </button>
            <button className={`btn ${!isLoginMode ? "btn-primary" : "btn-secondary"}`} onClick={() => setIsLoginMode(false)}>
              Register
            </button>
            {isLoggedIn && (
              <button className="btn btn-secondary" onClick={logout}>
                Logout
              </button>
            )}
          </div>

          {isLoginMode ? (
            <div className="grid" style={{ gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))" }}>
              <input className="portal-input" placeholder="Phone" value={loginPhone} onChange={(e) => setLoginPhone(e.target.value)} />
              <input className="portal-input" type="password" placeholder="Password" value={loginPassword} onChange={(e) => setLoginPassword(e.target.value)} />
            </div>
          ) : (
            <div className="grid" style={{ gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))" }}>
              <input className="portal-input" placeholder="Full name" value={registerName} onChange={(e) => setRegisterName(e.target.value)} />
              <select className="portal-input" value={registerCountry} onChange={(e) => setRegisterCountry(e.target.value)}>
                <option>Kenya</option>
                <option>Uganda</option>
                <option>Tanzania</option>
              </select>
              <input className="portal-input" placeholder="Phone" value={registerPhone} onChange={(e) => setRegisterPhone(e.target.value)} />
              <input className="portal-input" type="password" placeholder="Password" value={registerPassword} onChange={(e) => setRegisterPassword(e.target.value)} />
            </div>
          )}

          <div style={{ marginTop: "0.8rem", display: "flex", gap: "0.6rem", flexWrap: "wrap" }}>
            <button className="btn btn-primary" onClick={isLoginMode ? loginUser : registerUser} disabled={busy}>
              {busy ? "Please wait..." : isLoginMode ? "Login" : "Register & continue"}
            </button>
          </div>

          {isLoggedIn && (
            <p className="meta" style={{ marginTop: "0.7rem", marginBottom: 0 }}>
              Logged in as {user?.name || user?.phone}. Activation state: {status?.active ? "Active" : "Inactive"}.
            </p>
          )}
        </article>

        <article className="card portal-auth-card reveal-card">
          <span className="pill">Password recovery</span>
          <h2 style={{ marginBottom: "0.4rem" }}>Forgot Password (OTP)</h2>
          <p className="meta" style={{ marginTop: 0 }}>Request an OTP, verify it, and reset the password without leaving the page.</p>
          <div className="grid" style={{ gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))" }}>
            <input className="portal-input" placeholder="Phone" value={otpPhone} onChange={(e) => setOtpPhone(e.target.value)} />
            <input className="portal-input" placeholder="OTP code" value={otpCode} onChange={(e) => setOtpCode(e.target.value)} />
            <input className="portal-input" type="password" placeholder="New password" value={otpNewPassword} onChange={(e) => setOtpNewPassword(e.target.value)} />
          </div>
          <div style={{ marginTop: "0.8rem", display: "flex", gap: "0.6rem", flexWrap: "wrap" }}>
            <button className="btn btn-secondary" onClick={requestCode} disabled={busy}>
              Request OTP
            </button>
            <button className="btn btn-secondary" onClick={verifyCodeAndReset} disabled={busy}>
              Verify and Reset
            </button>
          </div>
        </article>
      </section>

      <section className="card portal-filter-card reveal-card" id="listings">
        <div className="portal-filter-header">
          <div>
            <span className="pill">Filters</span>
            <h2 style={{ margin: "0.55rem 0 0.25rem" }}>Refine the feed</h2>
            <p className="meta" style={{ margin: 0 }}>Filter the marketplace by location, category, and budget like the earlier flow, but with a cleaner layout.</p>
          </div>
          <button className="btn btn-primary" onClick={loadPlots} disabled={loading}>
            {loading ? "Loading..." : "Update results"}
          </button>
        </div>

        <div className="portal-chip-row">
          {QUICK_CATEGORY_CHIPS.map((category) => (
            <button
              key={category}
              type="button"
              className={`portal-chip ${filters.category === category ? "is-selected" : ""}`}
              onClick={() => setFilters((f) => ({ ...f, category: f.category === category ? "" : category }))}
            >
              {category}
            </button>
          ))}
        </div>

        <div className="portal-filter-grid">
          <select className="portal-input" value={filters.country} onChange={(e) => setFilters((f) => ({ ...f, country: e.target.value }))}>
            <option value="">All countries</option>
            <option value="Kenya">Kenya</option>
            <option value="Uganda">Uganda</option>
            <option value="Tanzania">Tanzania</option>
          </select>
          <input className="portal-input" placeholder="County" value={filters.county} onChange={(e) => setFilters((f) => ({ ...f, county: e.target.value }))} />
          <input className="portal-input" placeholder="Town" value={filters.town} onChange={(e) => setFilters((f) => ({ ...f, town: e.target.value }))} />
          <input className="portal-input" placeholder="Area" value={filters.area} onChange={(e) => setFilters((f) => ({ ...f, area: e.target.value }))} />
          <select className="portal-input" value={filters.category} onChange={(e) => setFilters((f) => ({ ...f, category: e.target.value }))}>
            <option value="">All categories</option>
            {availableCategories.map((category) => (
              <option key={category} value={category}>
                {category}
              </option>
            ))}
          </select>
          <input className="portal-input" placeholder="Min price" value={filters.minPrice} onChange={(e) => setFilters((f) => ({ ...f, minPrice: e.target.value }))} />
          <input className="portal-input" placeholder="Max price" value={filters.maxPrice} onChange={(e) => setFilters((f) => ({ ...f, maxPrice: e.target.value }))} />
        </div>
      </section>

      <section className="card portal-listings-card reveal-card">
        <div className="portal-filter-header">
          <div>
            <span className="pill">Listings</span>
            <h2 style={{ margin: "0.55rem 0 0.25rem" }}>Backend-powered marketplace feed</h2>
            <p className="meta" style={{ margin: 0 }}>
              Cards read from the backend and surface the plot image, category, location, price, and description first.
            </p>
          </div>
        </div>
        {loading && <p className="meta">Loading listings...</p>}
        {!loading && filtered.length === 0 && <p className="meta">No listings match the selected filters.</p>}
        {!loading && filtered.length > 0 && (
          <div className="portal-listing-grid">
            {filtered.map((plot) => {
              const image = listingImage(plot);
              return (
                <article key={plot.id || `${plot.title}-${plot.area}`} className="listing-card">
                  <div
                    className="listing-media"
                    style={image ? { backgroundImage: `linear-gradient(180deg, rgba(2, 8, 23, 0.08), rgba(2, 8, 23, 0.44)), url(${image})` } : undefined}
                  >
                    <span className="listing-badge">{plot.category || "Property"}</span>
                    <div className="listing-price">{formatPrice(plot.price)}</div>
                  </div>
                  <div className="listing-body">
                    <h3>{plot.title || "Listing"}</h3>
                    <p className="listing-location">
                      {[plot.area, plot.town || plot.county, plot.country].filter(Boolean).join(", ") || "Location not specified"}
                    </p>
                    <p className="listing-description">{plot.description || "Verified listing on AfricaRentalGrid."}</p>
                    <div className="listing-contact" style={{ marginTop: "0.5rem", fontSize: "0.97em", color: "#0f766e" }}>
                      <strong>Contact:</strong> {plot.phone || plot.contact || "Not provided"}
                    </div>
                  </div>
                </article>
              );
            })}
          </div>
        )}
      </section>

      <section className="portal-info-grid">
        <article className="card reveal-card" id="about">
          <span className="pill">About</span>
          <h2 style={{ marginBottom: "0.45rem" }}>Location-first property discovery</h2>
          <p className="meta" style={{ marginTop: 0 }}>
            AfricaRentalGrid helps renters, travelers, and students discover verified hostels, bedsitters, lodges, apartments, and plots across East Africa.
          </p>
          <Link href="/about" className="btn btn-secondary">Open full About page</Link>
        </article>

        <article className="card reveal-card" id="contact">
          <span className="pill">Contact</span>
          <h2 style={{ marginBottom: "0.45rem" }}>Support and partnerships</h2>
          <p className="meta" style={{ marginTop: 0 }}>
            Need help with listings, account access, or partnerships? Reach the team through the contact page and keep the support flow consistent.
          </p>
          <div className="portal-contact-list">
            <span>Email: support@africarentalgrid.com</span>
            <span>Hours: Mon-Sat, 8:00 AM to 6:00 PM EAT</span>
          </div>
          <Link href="/contact" className="btn btn-secondary">Open full Contact page</Link>
        </article>
      </section>

      {(message || error) && (
        <section className="card reveal-card" style={{ marginTop: "1rem", borderColor: error ? "#fecaca" : undefined }}>
          <p style={{ margin: 0, color: error ? "#b91c1c" : "#0f766e", fontWeight: 700 }}>{error || message}</p>
        </section>
      )}
    </main>
  );
}
