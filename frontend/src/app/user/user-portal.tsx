"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { apiRequest } from "@/lib/api";
import AuthenticatedUserShell from "@/components/user/authenticated-user-shell";
import PasswordField from "@/components/user/password-field";
import { clearUserSession, readUserSession, writeUserSession } from "@/components/user/user-session";
import { countrySeeds } from "@/main";

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
  phone?: string;
  contact?: string;
};

type User = {
  id?: string;
  displayId?: string;
  name?: string;
  email?: string;
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

type FilterState = {
  country: string;
  county: string;
  area: string;
  category: string;
  minPrice: string;
  maxPrice: string;
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

function includesValue(source: string, query: string): boolean {
  return source.trim().toLowerCase().includes(query.trim().toLowerCase());
}

function countryToSlug(country: string): keyof typeof countrySeeds | null {
  const normalized = country.trim().toLowerCase();
  if (normalized === "kenya" || normalized === "uganda" || normalized === "tanzania") {
    return normalized;
  }
  return null;
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

function timeRemainingLabel(status: UserStatus | null): string {
  if (!status?.active) return "Inactive";
  const hours = Math.max(0, Number(status.remainingHours ?? 0));
  const minutes = Math.max(0, Number(status.remainingMinutes ?? 0));
  return `${hours}h ${minutes}m remaining`;
}

export default function UserPortal({ initialCountry, initialCounty, initialTown: _initialTown, initialCategory }: Props) {
  const [token, setToken] = useState("");
  const [user, setUser] = useState<User | null>(null);
  const [status, setStatus] = useState<UserStatus | null>(null);
  const [sessionReady, setSessionReady] = useState(false);
  const [authView, setAuthView] = useState<"login" | "register" | "recover">("login");
  const [activeSection, setActiveSection] = useState<"dashboard" | "listings">("dashboard");

  const [registerName, setRegisterName] = useState("");
  const [registerCountry, setRegisterCountry] = useState(initialCountry || "Kenya");
  const [registerPhone, setRegisterPhone] = useState("");
  const [registerPassword, setRegisterPassword] = useState("");

  const [loginPhone, setLoginPhone] = useState("");
  const [loginPassword, setLoginPassword] = useState("");

  const defaultFilters: FilterState = {
    country: initialCountry || "Kenya",
    county: initialCounty || "",
    area: "",
    category: initialCategory || "",
    minPrice: "",
    maxPrice: ""
  };

  const [filters, setFilters] = useState<FilterState>(defaultFilters);

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

  const availableCounties = useMemo(() => {
    const countrySlug = countryToSlug(filters.country);
    const seeded = countrySlug ? countrySeeds[countrySlug] : [];
    const dynamic = plots
      .filter((plot) => !filters.country || sameValue(String(plot.country || ""), filters.country))
      .map((plot) => String(plot.county || plot.town || "").trim())
      .filter(Boolean);

    const allCounties = Array.from(new Set([...seeded, ...dynamic])).sort((left, right) => left.localeCompare(right));
    if (!filters.county.trim()) return allCounties;
    return allCounties.filter((county) => includesValue(county, filters.county));
  }, [filters.country, filters.county, plots]);

  const filtered = useMemo(() => {
    return plots.filter((plot) => {
      const countryOk = filters.country ? sameValue(String(plot.country || ""), filters.country) : true;
      const plotCounty = String(plot.county || plot.town || "");
      const countyOk = filters.county ? includesValue(plotCounty, filters.county) : true;
      const areaOk = filters.area ? sameValue(String(plot.area || ""), filters.area) : true;
      const categoryOk = filters.category ? sameValue(String(plot.category || ""), filters.category) : true;
      const minPrice = filters.minPrice.trim() === "" ? null : Number(filters.minPrice);
      const maxPrice = filters.maxPrice.trim() === "" ? null : Number(filters.maxPrice);
      const price = Number(plot.price);

      if (!countryOk || !countyOk || !areaOk || !categoryOk) return false;
      if (minPrice !== null && Number.isFinite(minPrice) && Number.isFinite(price) && price < minPrice) return false;
      if (maxPrice !== null && Number.isFinite(maxPrice) && Number.isFinite(price) && price > maxPrice) return false;
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

  async function loadPlots(nextFilters?: FilterState) {
    setLoading(true);
    try {
      const source = nextFilters || filters;
      const query = new URLSearchParams();
      if (source.country) query.set("country", source.country);
      if (source.county) query.set("county", source.county);
      if (source.area) query.set("area", source.area);
      if (source.category) query.set("category", source.category);
      if (source.minPrice.trim() !== "" && Number.isFinite(Number(source.minPrice))) query.set("minPrice", source.minPrice);
      if (source.maxPrice.trim() !== "" && Number.isFinite(Number(source.maxPrice))) query.set("maxPrice", source.maxPrice);

      const rows = await apiRequest<Plot[]>(`/api/plots${query.toString() ? `?${query.toString()}` : ""}`);
      setPlots(Array.isArray(rows) ? rows : []);
      if (isLoggedIn) {
        showSuccess(`Listings updated. ${Array.isArray(rows) ? rows.length : 0} listings loaded.`);
      }
    } catch (e) {
      showError(e instanceof Error ? e.message : "Unable to load plots.");
      setPlots([]);
    } finally {
      setLoading(false);
    }
  }

  async function loadStatus(authToken: string, notify = false) {
    try {
      const s = await apiRequest<UserStatus>("/api/user/status", { token: authToken });
      setStatus(s || null);
      if (notify) {
        showSuccess(s?.active ? `Status updated. ${timeRemainingLabel(s)}.` : "Status updated. Your account is currently inactive.");
      }
    } catch (_e) {
      setStatus(null);
      if (notify) {
        showError("Unable to refresh account status right now.");
      }
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
      writeUserSession({ token: data.token, user: data.user });
      setFilters((prev) => ({ ...prev, country: data.user?.country || prev.country }));
      await loadStatus(data.token);
      showSuccess("Registration successful. You can now log in and continue.");
      setRegisterPassword("");
      setAuthView("login");
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
      writeUserSession({ token: data.token, user: data.user });
      setFilters((prev) => ({ ...prev, country: data.user?.country || prev.country }));
      await loadStatus(data.token);
      showSuccess("Login successful.");
      await loadPlots();
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
      setAuthView("login");
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
    setPlots([]);
    setAuthView("login");
    setFilters(defaultFilters);
    clearUserSession();
    showSuccess("Logged out.");
  }

  function clearFilters() {
    const nextFilters: FilterState = {
      ...defaultFilters,
      country: user?.country || defaultFilters.country || "Kenya"
    };
    setFilters(nextFilters);
    showSuccess("Filters cleared. Showing the default feed again.");
    loadPlots(nextFilters);
  }

  useEffect(() => {
    const stored = readUserSession();
    if (stored?.token) {
      setToken(stored.token);
      setUser(stored.user as User | null);
      if (stored.user?.country) {
        setFilters((prev) => ({ ...prev, country: stored.user?.country || prev.country }));
      }
    }
    setSessionReady(true);
  }, []);

  useEffect(() => {
    const applyHash = () => {
      setActiveSection(window.location.hash === "#listings" ? "listings" : "dashboard");
    };
    applyHash();
    window.addEventListener("hashchange", applyHash);
    return () => window.removeEventListener("hashchange", applyHash);
  }, []);

  useEffect(() => {
    if (!isLoggedIn) return;
    loadPlots();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isLoggedIn]);

  useEffect(() => {
    if (!message && !error) return;
    const timeout = window.setTimeout(() => {
      setMessage("");
      setError("");
    }, 4000);
    return () => window.clearTimeout(timeout);
  }, [message, error]);

  if (!sessionReady) {
    return (
      <main className="container portal-auth-shell">
        <header className="portal-page-header reveal-card">
          <div className="portal-page-branding">
            <span className="pill">africaRentalsGrind</span>
            <div>
              <strong>Restoring your workspace.</strong>
              <p>We are checking your saved session so refresh keeps you inside the user portal.</p>
            </div>
          </div>
        </header>
        <section className="card portal-session-loading reveal-card">
          <span className="pill">Loading</span>
          <h2 style={{ margin: "0.65rem 0 0.35rem", color: "#0f172a" }}>Opening your dashboard</h2>
          <p className="meta" style={{ margin: 0 }}>Pulling your saved account and listings state from this browser.</p>
        </section>
      </main>
    );
  }

  if (!isLoggedIn) {
    return (
      <main className="container portal-auth-shell">
        {(message || error) && (
          <div className={`portal-toast ${error ? "is-error" : "is-success"}`}>
            {error || message}
          </div>
        )}
        <header className="portal-page-header reveal-card">
          <div className="portal-page-branding">
            <span className="pill">africaRentalsGrind</span>
            <div>
              <strong>Search rentals, manage access, and keep your account in one polished user portal.</strong>
              <p>Sign in or create an account to browse verified listings, review payments, and update your profile without leaving the page.</p>
            </div>
          </div>
          <nav className="portal-page-links" aria-label="User page header navigation">
            <Link href="/user">User portal</Link>
            <Link href="/user#listings">Listings</Link>
            <Link href="/about">About</Link>
            <Link href="/contact">Contact</Link>
          </nav>
        </header>
        <section className="portal-auth-landing reveal-card">
          <div className="portal-auth-stage">
            <div className="portal-auth-glow portal-auth-glow-left" />
            <div className="portal-auth-glow portal-auth-glow-right" />
            <div className="portal-auth-story">
              <span className="pill">africaRentalsGrind</span>
              <h1>Find your next stay from one calm, modern dashboard.</h1>
              <p>
                Sign in to browse verified rentals, activate your access, and manage everything from a cleaner private workspace.
              </p>
              <div className="portal-auth-story-grid">
                <div className="portal-auth-story-card">
                  <strong>Verified listings</strong>
                  <span>Real locations, categories, and prices in one flow.</span>
                </div>
                <div className="portal-auth-story-card">
                  <strong>Fast access</strong>
                  <span>Register, login, or recover your password without leaving the page.</span>
                </div>
              </div>
            </div>

            <div className="card portal-auth-panel">
              <div className="portal-auth-panel-top">
                <div>
                  <span className="pill">Welcome</span>
                  <h2>
                    {authView === "login"
                      ? "Login to continue"
                      : authView === "register"
                        ? "Create your account"
                        : "Reset your password"}
                  </h2>
                  <p className="meta">
                    {authView === "login"
                      ? "Access your private dashboard and continue where you left off."
                      : authView === "register"
                        ? "Start with a simple account and unlock your personalized dashboard."
                        : "Request an OTP, verify it, and get back into your account quickly."}
                  </p>
                </div>

                <div className="portal-auth-switcher" aria-label="Authentication views">
                  <button
                    type="button"
                    className={`portal-auth-tab ${authView === "login" ? "is-active" : ""}`}
                    onClick={() => setAuthView("login")}
                  >
                    Login
                  </button>
                  <button
                    type="button"
                    className={`portal-auth-tab ${authView === "register" ? "is-active" : ""}`}
                    onClick={() => setAuthView("register")}
                  >
                    Register
                  </button>
                </div>
              </div>

              {authView === "login" && (
                <div className="portal-auth-form">
                  <div className="grid" style={{ gridTemplateColumns: "1fr", gap: "0.9rem" }}>
                    <input className="portal-input" placeholder="Phone number" value={loginPhone} onChange={(e) => setLoginPhone(e.target.value)} />
                    <PasswordField placeholder="Password" value={loginPassword} onChange={setLoginPassword} />
                  </div>
                  <button className="btn btn-primary portal-auth-submit" onClick={loginUser} disabled={busy}>
                    {busy ? "Signing you in..." : "Login"}
                  </button>
                  <button type="button" className="portal-inline-link" onClick={() => setAuthView("recover")}>
                    Forgot your password?
                  </button>
                </div>
              )}

              {authView === "register" && (
                <div className="portal-auth-form">
                  <div className="grid" style={{ gridTemplateColumns: "1fr", gap: "0.9rem" }}>
                    <input className="portal-input" placeholder="Full name" value={registerName} onChange={(e) => setRegisterName(e.target.value)} />
                    <select className="portal-input" value={registerCountry} onChange={(e) => setRegisterCountry(e.target.value)}>
                      <option>Kenya</option>
                      <option>Uganda</option>
                      <option>Tanzania</option>
                    </select>
                    <input className="portal-input" placeholder="Phone number" value={registerPhone} onChange={(e) => setRegisterPhone(e.target.value)} />
                    <PasswordField placeholder="Create password" value={registerPassword} onChange={setRegisterPassword} />
                  </div>
                  <button className="btn btn-primary portal-auth-submit" onClick={registerUser} disabled={busy}>
                    {busy ? "Creating your account..." : "Register"}
                  </button>
                  <p className="meta portal-auth-footnote">You can activate access right after signing in.</p>
                </div>
              )}

              {authView === "recover" && (
                <div className="portal-auth-form">
                  <div className="grid" style={{ gridTemplateColumns: "1fr", gap: "0.9rem" }}>
                    <input className="portal-input" placeholder="Phone number" value={otpPhone} onChange={(e) => setOtpPhone(e.target.value)} />
                    <input className="portal-input" placeholder="OTP code" value={otpCode} onChange={(e) => setOtpCode(e.target.value)} />
                    <PasswordField placeholder="New password" value={otpNewPassword} onChange={setOtpNewPassword} />
                  </div>
                  <div className="portal-auth-action-row">
                    <button className="btn btn-secondary" onClick={requestCode} disabled={busy}>
                      Request OTP
                    </button>
                    <button className="btn btn-primary" onClick={verifyCodeAndReset} disabled={busy}>
                      {busy ? "Updating..." : "Reset password"}
                    </button>
                  </div>
                  <button type="button" className="portal-inline-link" onClick={() => setAuthView("login")}>
                    Back to login
                  </button>
                </div>
              )}

              {(message || error) && (
                <section className="portal-auth-message" style={{ borderColor: error ? "#fecaca" : undefined }}>
                  <p style={{ margin: 0, color: error ? "#b91c1c" : "#0f766e", fontWeight: 700 }}>{error || message}</p>
                </section>
              )}
            </div>
          </div>
        </section>
        <footer className="portal-page-footer reveal-card">
          <div>
            <strong>africaRentalsGrind</strong>
            <p>Trusted browsing, payments, and account tools designed around cleaner rental discovery.</p>
          </div>
          <nav className="portal-page-footer-links" aria-label="User page footer navigation">
            <Link href="/about">About</Link>
            <Link href="/contact">Contact</Link>
            <Link href="/privacy">Privacy</Link>
            <Link href="/user">User portal</Link>
          </nav>
        </footer>
      </main>
    );
  }

  return (
    <AuthenticatedUserShell active={activeSection}>
      {(message || error) && (
        <div className={`portal-toast ${error ? "is-error" : "is-success"}`}>
          {error || message}
        </div>
      )}
        {activeSection !== "listings" && (
          <section className="portal-hero portal-hero-surface reveal-card" id="dashboard">
            <div className="portal-hero-copy">
              <span className="pill" style={{ width: "fit-content", marginBottom: "0.7rem" }}>User dashboard</span>
              <h1 style={{ color: "#0f172a" }}>Welcome back</h1>
              <p>
                Browse listings, check your access window, and move into profile or payments from one cleaner workspace built around your active account.
              </p>
            </div>
            <div className="portal-hero-overview">
              <article className="portal-overview-card">
                <span>Total listings</span>
                <strong>{plots.length}</strong>
              </article>
              <article className="portal-overview-card">
                <span>Visible now</span>
                <strong>{filtered.length}</strong>
              </article>
              <article className="portal-overview-card">
                <span>Category</span>
                <strong>{filters.category || "All"}</strong>
              </article>
              <article className="portal-overview-card">
                <span>Countdown</span>
                <strong>{timeRemainingLabel(status)}</strong>
              </article>
            </div>
          </section>
        )}

        {activeSection !== "listings" && (
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
            <div className="portal-status-metric">
              <strong>{timeRemainingLabel(status)}</strong>
              <span>Countdown</span>
            </div>
          </div>
          <div className="portal-status-actions">
            <button className="btn btn-primary" onClick={pay} disabled={busy || !isLoggedIn}>
              {status?.active ? "Refresh Activation" : "Activate Account"}
            </button>
            {isLoggedIn && (
              <button className="btn btn-secondary" onClick={() => loadStatus(token, true)} disabled={busy}>
                Check Status
              </button>
            )}
          </div>
        </article>

        <article className="card portal-auth-card portal-account-card reveal-card">
          <div className="portal-account-card-head">
            <span className="pill">Account</span>
            <strong style={{ color: "#0f172a", fontSize: "1.15rem" }}>{user?.name || user?.phone || "User account"}</strong>
            <p className="meta">
              Keep your profile, payments, and listing activity close by without leaving the dashboard.
            </p>
          </div>

          <div className="portal-account-summary">
            <div className="portal-account-summary-item">
              <span>Phone</span>
              <strong>{user?.phone || "-"}</strong>
            </div>
            <div className="portal-account-summary-item">
              <span>Status</span>
              <strong>{status?.active ? "Access active" : "Activation needed"}</strong>
            </div>
          </div>

          <div style={{ display: "flex", gap: "0.6rem", flexWrap: "wrap" }}>
            {isLoggedIn && (
              <button className="btn btn-secondary" onClick={logout}>
                Logout
              </button>
            )}
          </div>
        </article>
          </section>
        )}

          <section className="card portal-filter-card reveal-card" id="listings">
        <div className="portal-filter-header">
          <div>
            <span className="pill">Filters</span>
            <h2 style={{ margin: "0.55rem 0 0.25rem" }}>Refine the feed</h2>
            <p className="meta" style={{ margin: 0 }}>Filter the marketplace by location, category, and budget like the earlier flow, but with a cleaner layout.</p>
          </div>
          <div style={{ display: "flex", gap: "0.6rem", flexWrap: "wrap" }}>
            <button className="btn btn-secondary" onClick={clearFilters} disabled={loading}>
              Clear filters
            </button>
            <button className="btn btn-primary" onClick={() => loadPlots()} disabled={loading}>
              {loading ? "Loading..." : "Update results"}
            </button>
          </div>
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
          <select className="portal-input" value={filters.country} onChange={(e) => setFilters((f) => ({ ...f, country: e.target.value, county: "" }))}>
            <option value="">All countries</option>
            <option value="Kenya">Kenya</option>
            <option value="Uganda">Uganda</option>
            <option value="Tanzania">Tanzania</option>
          </select>
          <input
            className="portal-input"
            list="portal-county-options"
            placeholder={filters.country ? `Search ${filters.country} counties` : "Search county"}
            value={filters.county}
            onChange={(e) => setFilters((f) => ({ ...f, county: e.target.value }))}
          />
          <datalist id="portal-county-options">
            {availableCounties.map((county) => (
              <option key={county} value={county} />
            ))}
          </datalist>
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
          <span className="portal-results-count">{filtered.length} of {plots.length} listings</span>
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
    </AuthenticatedUserShell>
  );
}
