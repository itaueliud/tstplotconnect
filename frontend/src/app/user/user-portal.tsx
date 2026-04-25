"use client";

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
  expiresAt?: string;
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

function sameValue(left: string, right: string): boolean {
  return left.trim().toLowerCase() === right.trim().toLowerCase();
}

function formatPrice(value?: number): string {
  return typeof value === "number" ? `KES ${value.toLocaleString()}` : "Price on request";
}

function listingImage(plot: Plot): string {
  return Array.isArray(plot.images) && plot.images[0] ? plot.images[0] : "";
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
    <main className="container portal-shell" style={{ padding: "1.35rem 0 3rem" }}>
      <section className="portal-hero">
        <div>
          <span className="pill" style={{ width: "fit-content" }}>Listings dashboard</span>
          <h1>Search real listings with images, categories, and live filters.</h1>
          <p>
            Register or log in to unlock more access, then filter by country, county, town, area, category, and price.
          </p>
        </div>
        <div className="portal-hero-meta">
          <span className="portal-meta-chip">Showing {filtered.length} listing{filtered.length === 1 ? "" : "s"}</span>
          <span className="portal-meta-chip">Country: {filters.country || "All"}</span>
          <span className="portal-meta-chip">Category: {filters.category || "All"}</span>
          <span className="portal-meta-chip">Status: {status?.active ? "Active account" : "Guest browsing"}</span>
        </div>
      </section>

      <section className="portal-auth-grid">
        <article className="card portal-auth-card">
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
            {isLoggedIn && (
              <button className="btn btn-secondary" onClick={pay} disabled={busy}>
                Pay Activation
              </button>
            )}
          </div>

          {isLoggedIn && (
            <p className="meta" style={{ marginTop: "0.7rem", marginBottom: 0 }}>
              Status: {status?.active ? "Active" : "Inactive"}
            </p>
          )}
        </article>

        <article className="card portal-auth-card">
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

      <section className="card portal-filter-card">
        <div className="portal-filter-header">
          <div>
            <span className="pill">Filters</span>
            <h2 style={{ margin: "0.55rem 0 0.25rem" }}>Refine the feed</h2>
            <p className="meta" style={{ margin: 0 }}>Filter the marketplace by location, category, and budget.</p>
          </div>
          <button className="btn btn-primary" onClick={loadPlots} disabled={loading}>
            {loading ? "Loading..." : "Update results"}
          </button>
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

      <section className="card portal-listings-card">
        <div className="portal-filter-header">
          <div>
            <span className="pill">Listings</span>
            <h2 style={{ margin: "0.55rem 0 0.25rem" }}>Visual marketplace feed</h2>
            <p className="meta" style={{ margin: 0 }}>Cards surface the image, category, location, price, and description first.</p>
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
                  </div>
                </article>
              );
            })}
          </div>
        )}
      </section>

      {(message || error) && (
        <section className="card" style={{ marginTop: "1rem", borderColor: error ? "#fecaca" : undefined }}>
          <p style={{ margin: 0, color: error ? "#b91c1c" : "#0f766e", fontWeight: 700 }}>{error || message}</p>
        </section>
      )}
    </main>
  );
}
