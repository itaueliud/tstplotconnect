"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
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
  lat?: number | null;
  lng?: number | null;
  mapLink?: string;
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
const COUNTY_HIGHLIGHTS = ["Nairobi", "Machakos", "Mombasa", "Kiambu", "Thika", "Makueni", "Kajiado", "Embu", "Kitui", "Uasin Gishu"] as const;

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

function sanitizePhone(raw?: string): string {
  const value = String(raw || "").trim();
  if (!value) return "";
  const startsWithPlus = value.startsWith("+");
  const digits = value.replace(/\D/g, "");
  if (!digits) return "";
  return startsWithPlus ? `+${digits}` : digits;
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

function loadIds(key: string): string[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(key);
    const parsed = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? parsed.filter((item) => typeof item === "string") : [];
  } catch {
    return [];
  }
}

function saveIds(key: string, values: string[]) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(key, JSON.stringify(values));
}

function listingImages(plot: Plot): string[] {
  if (!Array.isArray(plot.images)) return [];
  return plot.images.map((item) => String(item || "").trim()).filter(Boolean);
}

type MapFocus = {
  label: string;
  lat: number;
  lng: number;
};

const EAST_AFRICA_BBOX = "28.5,-12.5,52.5,8.8";

function parseCoordinatesFromMapLink(raw?: string): [number, number] | null {
  const value = String(raw || "").trim();
  if (!value) return null;

  const directPatterns = [
    /@(-?\d+(?:\.\d+)?),(-?\d+(?:\.\d+)?)/,
    /[?&]q=(-?\d+(?:\.\d+)?),(-?\d+(?:\.\d+)?)/,
    /[?&]query=(-?\d+(?:\.\d+)?),(-?\d+(?:\.\d+)?)/,
    /[?&]ll=(-?\d+(?:\.\d+)?),(-?\d+(?:\.\d+)?)/,
    /\/#map=\d+\/(-?\d+(?:\.\d+)?)\/(-?\d+(?:\.\d+)?)/
  ];

  for (const pattern of directPatterns) {
    const match = value.match(pattern);
    if (!match) continue;
    const lat = Number(match[1]);
    const lng = Number(match[2]);
    if (Number.isFinite(lat) && Number.isFinite(lng)) return [lat, lng];
  }

  return null;
}

function mapBoundsForPoint(lat: number, lng: number): string {
  const latPad = 0.18;
  const lngPad = 0.22;
  const left = lng - lngPad;
  const right = lng + lngPad;
  const top = lat + latPad;
  const bottom = lat - latPad;
  return `${left},${bottom},${right},${top}`;
}

export default function UserPortal({ initialCountry, initialCounty, initialTown: _initialTown, initialCategory }: Props) {
  const [token, setToken] = useState("");
  const [user, setUser] = useState<User | null>(null);
  const [status, setStatus] = useState<UserStatus | null>(null);
  const [sessionReady, setSessionReady] = useState(false);
  const [authView, setAuthView] = useState<"login" | "register" | "recover">("login");
  const [activeSection, setActiveSection] = useState<"dashboard" | "search" | "map" | "saved">("dashboard");
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [mapFocus, setMapFocus] = useState<MapFocus | null>(null);

  const [registerName, setRegisterName] = useState("");
  const [registerCountry, setRegisterCountry] = useState(initialCountry || "Kenya");
  const [registerPhone, setRegisterPhone] = useState("");
  const [registerEmail, setRegisterEmail] = useState("");
  const [registerPassword, setRegisterPassword] = useState("");
  const [registerConfirmPassword, setRegisterConfirmPassword] = useState("");

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
  const [imageIndexByListing, setImageIndexByListing] = useState<Record<string, number>>({});
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

  const savedListings = useMemo(() => {
    const savedIds = new Set(loadIds("tst_saved_listings"));
    if (savedIds.size === 0) return [];
    return plots.filter((plot) => savedIds.has(listingKey(plot)));
  }, [plots]);

  const mapQuery = useMemo(() => {
    const value = [filters.county, filters.country].filter(Boolean).join(", ");
    return value || "Kenya";
  }, [filters.county, filters.country]);

  const mapEmbedUrl = useMemo(() => {
    if (mapFocus) {
      const bbox = mapBoundsForPoint(mapFocus.lat, mapFocus.lng);
      return `https://www.openstreetmap.org/export/embed.html?bbox=${bbox}&layer=mapnik&marker=${mapFocus.lat}%2C${mapFocus.lng}`;
    }

    return `https://www.openstreetmap.org/export/embed.html?bbox=${EAST_AFRICA_BBOX}&layer=mapnik`;
  }, [mapFocus]);

  function focusListingOnMap(plot: Plot) {
    const directLat = typeof plot.lat === "number" ? plot.lat : NaN;
    const directLng = typeof plot.lng === "number" ? plot.lng : NaN;
    let lat = directLat;
    let lng = directLng;

    if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
      const parsed = parseCoordinatesFromMapLink(plot.mapLink);
      if (parsed) {
        lat = parsed[0];
        lng = parsed[1];
      }
    }

    if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
      const query = [plot.title, plot.area, plot.town || plot.county, plot.country].filter(Boolean).join(", ");
      showError(`No exact coordinates saved for this listing yet. Add a valid mapLink in admin. (${query || "Unknown location"})`);
      return;
    }

    setMapFocus({
      label: plot.title || "Listing location",
      lat,
      lng
    });
    setActiveSection("map");
    window.location.hash = "map";
    showSuccess(`Map focused on ${plot.title || "selected listing"}.`);
  }

  function showSuccess(text: string) {
    setMessage(text);
    setError("");
  }

  function showError(text: string) {
    setError(text);
    setMessage("");
  }

  function listingKey(plot: Plot): string {
    return String(plot.id || `${plot.title || "listing"}-${plot.area || plot.county || "unknown"}`);
  }

  function currentListingImage(plot: Plot): string {
    const key = listingKey(plot);
    const images = listingImages(plot);
    if (images.length === 0) return "";
    const idx = imageIndexByListing[key] || 0;
    const safeIndex = ((idx % images.length) + images.length) % images.length;
    return images[safeIndex];
  }

  function shiftListingImage(plot: Plot, direction: -1 | 1) {
    const key = listingKey(plot);
    const images = listingImages(plot);
    if (images.length <= 1) return;
    setImageIndexByListing((prev) => {
      const current = prev[key] || 0;
      const next = (current + direction + images.length) % images.length;
      return { ...prev, [key]: next };
    });
  }

  function markSaved(plot: Plot) {
    const key = listingKey(plot);
    const saved = loadIds("tst_saved_listings");
    if (saved.includes(key)) return;
    saveIds("tst_saved_listings", [...saved, key]);
    showSuccess("Listing saved to your profile.");
  }

  function markViewed(plot: Plot) {
    const key = listingKey(plot);
    const viewed = loadIds("tst_viewed_once_listings");
    if (viewed.includes(key)) return;
    saveIds("tst_viewed_once_listings", [...viewed, key]);
  }

  function markInquiry(plot: Plot) {
    const key = listingKey(plot);
    const inquiries = loadIds("tst_inquiry_listings");
    saveIds("tst_inquiry_listings", [...inquiries, key]);
  }

  function openLocation(plot: Plot) {
    markViewed(plot);
    focusListingOnMap(plot);
  }

  function openCall(plot: Plot) {
    markInquiry(plot);
    const phone = sanitizePhone(plot.phone || plot.contact);
    if (!phone) {
      showError("This listing has no phone contact yet.");
      return;
    }
    window.location.href = `tel:${phone}`;
  }

  function openWhatsApp(plot: Plot) {
    markInquiry(plot);
    const phone = sanitizePhone(plot.phone || plot.contact).replace(/^\+/, "");
    if (!phone) {
      showError("This listing has no WhatsApp number yet.");
      return;
    }
    const href = `https://wa.me/${phone}`;
    window.open(href, "_blank", "noopener,noreferrer");
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
    if (registerPassword !== registerConfirmPassword) {
      showError("Password confirmation does not match.");
      return;
    }
    setBusy(true);
    try {
      const data = await apiRequest<{ token: string; user: User }>("/api/user/register", {
        method: "POST",
        body: JSON.stringify({
          name: registerName.trim(),
          country: registerCountry.trim(),
          phone: registerPhone.trim(),
          email: registerEmail.trim(),
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
      setRegisterConfirmPassword("");
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
      if (!initialCountry && stored.user?.country) {
        setFilters((prev) => ({ ...prev, country: stored.user?.country || prev.country }));
      }
    }
    setSessionReady(true);
  }, [initialCountry]);

  useEffect(() => {
    const applyHash = () => {
      const hash = window.location.hash.toLowerCase();
      if (hash === "#search" || hash === "#listings") {
        setActiveSection("search");
        return;
      }
      if (hash === "#map") {
        setActiveSection("map");
        return;
      }
      if (hash === "#saved") {
        setActiveSection("saved");
        return;
      }
      setActiveSection("dashboard");
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

  function applyFiltersAndClose() {
    loadPlots();
    setFiltersOpen(false);
  }

  if (!sessionReady) {
    return (
      <main className="container portal-auth-shell">
        <header className="portal-page-header reveal-card">
          <div className="portal-page-branding">
            <span className="pill">tstplotconnect</span>
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
      <main className="portal-landing-shell">
        {(message || error) && (
          <div className={`portal-toast ${error ? "is-error" : "is-success"}`}>
            {error || message}
          </div>
        )}
        <header className="portal-landing-nav">
          <Link href="/" className="portal-landing-brand" aria-label="tstplotconnect home">
            <span className="portal-brand-wordmark">
              <span className="tst">tst</span>
              <span className="plot">plot</span>
              <span className="connect">connect</span>
            </span>
            <span className="portal-brand-tagline">Verified rentals across Kenya, Uganda &amp; Tanzania</span>
          </Link>
          <div className="portal-landing-actions">
            <button type="button" className="portal-landing-action-muted" onClick={() => setAuthView("login")}>Sign in</button>
            <button type="button" className="portal-landing-action-strong" onClick={() => setAuthView("register")}>Get started</button>
          </div>
        </header>

        <section className="portal-landing-hero">
          <div className="portal-landing-left">
            <span className="portal-landing-kicker">KE Kenya - Uganda - Tanzania</span>
            <h1>Browse verified rentals, hostels &amp; plots - fast.</h1>
            <p>
              Create a free account and unlock full access to caretaker contacts, WhatsApp details, and property images with one small KES 50 activation via M-Pesa.
            </p>
            <ul>
              <li><strong>Register free</strong> - takes under a minute, just a phone number and password.</li>
              <li><strong>Activate for KES 50</strong> - one M-Pesa STK push unlocks 24 hours of full access.</li>
              <li><strong>View contacts &amp; images</strong> - caretaker phone, WhatsApp, and all listing photos revealed.</li>
              <li><strong>Filter by county &amp; category</strong> - Nairobi, Machakos, Mombasa and more.</li>
            </ul>
          </div>

          <div className="portal-landing-right">
            <div className="portal-landing-tabs">
              <button type="button" className={authView === "login" ? "is-active" : ""} onClick={() => setAuthView("login")}>Sign in</button>
              <button type="button" className={authView === "register" ? "is-active" : ""} onClick={() => setAuthView("register")}>Register</button>
            </div>
            <div className="portal-landing-auth-card">
              <h2>{authView === "register" ? "Create account" : authView === "recover" ? "Reset password" : "Welcome back"}</h2>
              <p>{authView === "register" ? "Register to continue to your dashboard and listings." : "Sign in to continue to your dashboard and listings."}</p>

              {authView === "login" && (
                <div className="portal-auth-form">
                  <div className="grid" style={{ gridTemplateColumns: "1fr", gap: "0.9rem" }}>
                    <input className="portal-input" placeholder="e.g. 0712 345 678" value={loginPhone} onChange={(e) => setLoginPhone(e.target.value)} />
                    <PasswordField placeholder="Your password" value={loginPassword} onChange={setLoginPassword} />
                  </div>
                  <button className="btn portal-landing-submit" onClick={loginUser} disabled={busy}>
                    {busy ? "Signing in..." : "Sign in"}
                  </button>
                  <button type="button" className="portal-inline-link" onClick={() => setAuthView("recover")}>
                    Forgot password? Request OTP
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
                    <input className="portal-input" placeholder="Email address" value={registerEmail} onChange={(e) => setRegisterEmail(e.target.value)} />
                    <PasswordField placeholder="Create password" value={registerPassword} onChange={setRegisterPassword} />
                    <PasswordField placeholder="Confirm password" value={registerConfirmPassword} onChange={setRegisterConfirmPassword} />
                  </div>
                  <button className="btn portal-landing-submit" onClick={registerUser} disabled={busy}>
                    {busy ? "Creating account..." : "Register"}
                  </button>
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
                    <button className="btn btn-secondary" onClick={requestCode} disabled={busy}>Request OTP</button>
                    <button className="btn portal-landing-submit" onClick={verifyCodeAndReset} disabled={busy}>{busy ? "Updating..." : "Reset password"}</button>
                  </div>
                  <button type="button" className="portal-inline-link" onClick={() => setAuthView("login")}>Back to login</button>
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

        <section className="portal-landing-stats">
          <div><strong>1,200+</strong><span>Listings</span></div>
          <div><strong>30+</strong><span>Counties</span></div>
          <div><strong>3</strong><span>Countries</span></div>
          <div><strong>KES 50</strong><span>Full access</span></div>
          <p>&quot;Find your next home without the hassle.&quot;</p>
        </section>

        <section className="portal-landing-feature-row">
          <article className="portal-landing-feature-card">
            <h3>Contacts unlocked on activation</h3>
            <p>After your KES 50 M-Pesa payment, caretaker name, phone number, and WhatsApp link are fully visible on every listing.</p>
          </article>
          <article className="portal-landing-feature-card">
            <h3>Real property photos</h3>
            <p>All listing images are shown to activated users. Non-activated accounts see a placeholder - no more guessing what a property looks like.</p>
          </article>
          <article className="portal-landing-feature-card">
            <h3>Filter by county &amp; category</h3>
            <p>Narrow down by country, county, area, category, and price range to find the exact type of rental you need, fast.</p>
          </article>
        </section>

        <section className="portal-landing-counties">
          <h4>Browse by county</h4>
          <div>
            {COUNTY_HIGHLIGHTS.map((county) => (
              <button key={county} type="button" onClick={() => setFilters((f) => ({ ...f, county }))}>{county}</button>
            ))}
          </div>
        </section>

        <footer className="portal-landing-footer">
          <span>tstplotconnect</span>
          <nav>
            <Link href="/about">About</Link>
            <Link href="/blog">Blog</Link>
            <Link href="/privacy">Privacy</Link>
            <Link href="/contact">Contact</Link>
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
        {activeSection === "dashboard" && (
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

        {activeSection === "dashboard" && (
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
            <button className="btn btn-primary" onClick={pay} disabled={busy || !isLoggedIn}>
              {status?.active ? "Refresh Activation" : "Activate Account"}
            </button>
            {isLoggedIn && (
              <button className="btn btn-secondary" onClick={logout}>
                Logout
              </button>
            )}
          </div>
        </article>
          </section>
        )}

          {(activeSection === "dashboard" || activeSection === "search") && (
          <section className="card portal-filter-card reveal-card" id="search">
        <div className="portal-filter-header">
          <div>
            <span className="pill">Filters</span>
            <h2 style={{ margin: "0.55rem 0 0.25rem" }}>Refine the feed</h2>
            <p className="meta" style={{ margin: 0 }}>Filter the marketplace by location, category, and budget like the earlier flow, but with a cleaner layout.</p>
          </div>
          <div style={{ display: "flex", gap: "0.6rem", flexWrap: "wrap" }}>
            <button
              type="button"
              className="btn btn-secondary portal-filter-hamburger"
              onClick={() => setFiltersOpen(true)}
            >
              Menu Filters
            </button>
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
          )}

          {filtersOpen && (
            <div className="portal-filter-overlay" onClick={() => setFiltersOpen(false)}>
              <aside className="portal-filter-drawer" onClick={(e) => e.stopPropagation()}>
                <div className="portal-filter-drawer-head">
                  <h3>Filters</h3>
                  <button type="button" className="btn btn-secondary" onClick={() => setFiltersOpen(false)}>Close</button>
                </div>
                <div className="portal-filter-drawer-body">
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
                    <input className="portal-input" list="portal-county-options" placeholder={filters.country ? `Search ${filters.country} counties` : "Search county"} value={filters.county} onChange={(e) => setFilters((f) => ({ ...f, county: e.target.value }))} />
                    <input className="portal-input" placeholder="Area" value={filters.area} onChange={(e) => setFilters((f) => ({ ...f, area: e.target.value }))} />
                    <select className="portal-input" value={filters.category} onChange={(e) => setFilters((f) => ({ ...f, category: e.target.value }))}>
                      <option value="">All categories</option>
                      {availableCategories.map((category) => (
                        <option key={category} value={category}>{category}</option>
                      ))}
                    </select>
                    <input className="portal-input" placeholder="Min price" value={filters.minPrice} onChange={(e) => setFilters((f) => ({ ...f, minPrice: e.target.value }))} />
                    <input className="portal-input" placeholder="Max price" value={filters.maxPrice} onChange={(e) => setFilters((f) => ({ ...f, maxPrice: e.target.value }))} />
                  </div>
                </div>
                <div className="portal-filter-drawer-actions">
                  <button className="btn btn-secondary" onClick={clearFilters}>Reset</button>
                  <button className="btn btn-primary" onClick={applyFiltersAndClose}>Apply Filters</button>
                </div>
              </aside>
            </div>
          )}

          {(activeSection === "dashboard" || activeSection === "search") && (
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
              const image = currentListingImage(plot) || listingImage(plot);
              const images = listingImages(plot);
              const imageCount = images.length;
              const index = imageCount > 0 ? ((imageIndexByListing[listingKey(plot)] || 0) % imageCount + imageCount) % imageCount : 0;
              return (
                <article key={plot.id || `${plot.title}-${plot.area}`} className="listing-card">
                  <div
                    className="listing-media"
                    style={image ? { backgroundImage: `linear-gradient(180deg, rgba(2, 8, 23, 0.08), rgba(2, 8, 23, 0.44)), url(${image})`, position: "relative" } : undefined}
                  >
                    <span className="listing-badge">{plot.category || "Property"}</span>
                    <div className="listing-price">{formatPrice(plot.price)}</div>
                    {imageCount > 1 && (
                      <>
                        <button
                          type="button"
                          className="listing-action"
                          style={{ position: "absolute", left: 8, top: "50%", transform: "translateY(-50%)", minWidth: 38, padding: "0.35rem 0.5rem" }}
                          onClick={() => shiftListingImage(plot, -1)}
                        >
                          ←
                        </button>
                        <button
                          type="button"
                          className="listing-action"
                          style={{ position: "absolute", right: 8, top: "50%", transform: "translateY(-50%)", minWidth: 38, padding: "0.35rem 0.5rem" }}
                          onClick={() => shiftListingImage(plot, 1)}
                        >
                          →
                        </button>
                        <span className="listing-badge" style={{ position: "absolute", bottom: 8, left: 8 }}>
                          {index + 1}/{imageCount}
                        </span>
                      </>
                    )}
                  </div>
                  <div className="listing-body">
                    <h3>{plot.title || "Listing"}</h3>
                    <p className="listing-location">
                      {[plot.area, plot.town || plot.county, plot.country].filter(Boolean).join(", ") || "Location not specified"}
                    </p>
                    <p className="listing-description">{plot.description || "Verified listing on tstplotconnect."}</p>
                    <div className="listing-contact" style={{ marginTop: "0.5rem", fontSize: "0.97em", color: "#0f766e" }}>
                      <strong>Contact:</strong> {plot.phone || plot.contact || "Not provided"}
                    </div>
                    <div className="listing-actions">
                      <button type="button" className="listing-action" onClick={() => markSaved(plot)}>Save</button>
                      <button type="button" className="listing-action" onClick={() => openCall(plot)}>Call</button>
                      <button type="button" className="listing-action" onClick={() => openWhatsApp(plot)}>WhatsApp</button>
                      <button type="button" className="listing-action" onClick={() => openLocation(plot)}>Location</button>
                    </div>
                  </div>
                </article>
              );
            })}
          </div>
        )}
          </section>
          )}

          {(activeSection === "dashboard" || activeSection === "map") && (
            <section className="card portal-listings-card reveal-card" id="map">
              <div className="portal-filter-header">
                <div>
                  <span className="pill">Map</span>
                  <h2 style={{ margin: "0.55rem 0 0.25rem" }}>Listings map</h2>
                  <p className="meta" style={{ margin: 0 }}>
                    View the current area on map and open directions for each listing location.
                  </p>
                </div>
                <span className="portal-results-count">{mapFocus?.label || mapQuery}</span>
              </div>
              <div style={{ borderRadius: "14px", overflow: "hidden", border: "1px solid rgba(148, 163, 184, 0.28)" }}>
                <iframe
                  title="Listings map"
                  src={mapEmbedUrl}
                  style={{ width: "100%", height: "360px", border: 0 }}
                  loading="lazy"
                  referrerPolicy="no-referrer-when-downgrade"
                />
              </div>
              <div className="portal-chip-row" style={{ marginTop: "0.9rem" }}>
                {filtered.slice(0, 12).map((plot) => {
                  return (
                    <button
                      key={`map-${listingKey(plot)}`}
                      type="button"
                      className="portal-chip"
                      onClick={() => focusListingOnMap(plot)}
                    >
                      {plot.title || "Listing"} - Open map
                    </button>
                  );
                })}
              </div>
            </section>
          )}

          {(activeSection === "dashboard" || activeSection === "saved") && (
          <section className="card portal-listings-card reveal-card" id="saved">
            <div className="portal-filter-header">
              <div>
                <span className="pill">Saved</span>
                <h2 style={{ margin: "0.55rem 0 0.25rem" }}>Saved listings</h2>
                <p className="meta" style={{ margin: 0 }}>
                  Listings you saved from the search feed appear here.
                </p>
              </div>
              <span className="portal-results-count">{savedListings.length} saved</span>
            </div>
            {savedListings.length === 0 && <p className="meta">No saved listings yet. Tap Save on any listing card.</p>}
            {savedListings.length > 0 && (
              <div className="portal-listing-grid">
                {savedListings.map((plot) => {
                  const image = currentListingImage(plot) || listingImage(plot);
                  const images = listingImages(plot);
                  const imageCount = images.length;
                  const index = imageCount > 0 ? ((imageIndexByListing[listingKey(plot)] || 0) % imageCount + imageCount) % imageCount : 0;
                  return (
                    <article key={`saved-${listingKey(plot)}`} className="listing-card">
                      <div
                        className="listing-media"
                        style={image ? { backgroundImage: `linear-gradient(180deg, rgba(2, 8, 23, 0.08), rgba(2, 8, 23, 0.44)), url(${image})`, position: "relative" } : undefined}
                      >
                        <span className="listing-badge">{plot.category || "Property"}</span>
                        <div className="listing-price">{formatPrice(plot.price)}</div>
                        {imageCount > 1 && (
                          <>
                            <button
                              type="button"
                              className="listing-action"
                              style={{ position: "absolute", left: 8, top: "50%", transform: "translateY(-50%)", minWidth: 38, padding: "0.35rem 0.5rem" }}
                              onClick={() => shiftListingImage(plot, -1)}
                            >
                              ←
                            </button>
                            <button
                              type="button"
                              className="listing-action"
                              style={{ position: "absolute", right: 8, top: "50%", transform: "translateY(-50%)", minWidth: 38, padding: "0.35rem 0.5rem" }}
                              onClick={() => shiftListingImage(plot, 1)}
                            >
                              →
                            </button>
                            <span className="listing-badge" style={{ position: "absolute", bottom: 8, left: 8 }}>
                              {index + 1}/{imageCount}
                            </span>
                          </>
                        )}
                      </div>
                      <div className="listing-body">
                        <h3>{plot.title || "Listing"}</h3>
                        <p className="listing-location">
                          {[plot.area, plot.town || plot.county, plot.country].filter(Boolean).join(", ") || "Location not specified"}
                        </p>
                        <div className="listing-actions">
                          <button type="button" className="listing-action" onClick={() => openCall(plot)}>Call</button>
                          <button type="button" className="listing-action" onClick={() => openWhatsApp(plot)}>WhatsApp</button>
                          <button type="button" className="listing-action" onClick={() => openLocation(plot)}>Location</button>
                        </div>
                      </div>
                    </article>
                  );
                })}
              </div>
            )}
          </section>
          )}
    </AuthenticatedUserShell>
  );
}
