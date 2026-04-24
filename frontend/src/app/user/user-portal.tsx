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
};

const inputStyle: React.CSSProperties = {
  width: "100%",
  border: "1px solid #cbd5e1",
  borderRadius: 10,
  padding: "0.6rem 0.7rem",
  background: "#fff"
};

function sameValue(left: string, right: string): boolean {
  return left.trim().toLowerCase() === right.trim().toLowerCase();
}

export default function UserPortal({ initialCountry, initialCounty, initialTown }: Props) {
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
    country: initialCountry || "",
    county: initialCounty || "",
    town: initialTown || "",
    area: "",
    category: "",
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
    <main className="container" style={{ padding: "2rem 0 3rem" }}>
      <section className="card" style={{ marginBottom: "1rem" }}>
        <span className="pill">User Dashboard</span>
        <h1 style={{ margin: "0.8rem 0 0.4rem" }}>User Listings and Access</h1>
        <p className="meta" style={{ margin: 0 }}>
          Register or log in, activate your account, then browse filtered listings.
        </p>
      </section>

      <section className="card" style={{ marginBottom: "1rem" }}>
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
            <input style={inputStyle} placeholder="Phone" value={loginPhone} onChange={(e) => setLoginPhone(e.target.value)} />
            <input style={inputStyle} type="password" placeholder="Password" value={loginPassword} onChange={(e) => setLoginPassword(e.target.value)} />
          </div>
        ) : (
          <div className="grid" style={{ gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))" }}>
            <input style={inputStyle} placeholder="Full name" value={registerName} onChange={(e) => setRegisterName(e.target.value)} />
            <input style={inputStyle} placeholder="Country" value={registerCountry} onChange={(e) => setRegisterCountry(e.target.value)} />
            <input style={inputStyle} placeholder="Phone" value={registerPhone} onChange={(e) => setRegisterPhone(e.target.value)} />
            <input style={inputStyle} type="password" placeholder="Password" value={registerPassword} onChange={(e) => setRegisterPassword(e.target.value)} />
          </div>
        )}

        <div style={{ marginTop: "0.8rem", display: "flex", gap: "0.6rem", flexWrap: "wrap" }}>
          <button className="btn btn-primary" onClick={isLoginMode ? loginUser : registerUser} disabled={busy}>
            {busy ? "Please wait..." : isLoginMode ? "Login" : "Register"}
          </button>
          {isLoggedIn && (
            <button className="btn btn-secondary" onClick={pay} disabled={busy}>
              Pay Activation
            </button>
          )}
        </div>

        {isLoggedIn && (
          <p className="meta" style={{ marginTop: "0.7rem", marginBottom: 0 }}>
            Account: {user?.name || user?.phone} | Status: {status?.active ? "Active" : "Inactive"}
          </p>
        )}
      </section>

      <section className="card" style={{ marginBottom: "1rem" }}>
        <h2 style={{ marginTop: 0 }}>Forgot Password (OTP)</h2>
        <div className="grid" style={{ gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))" }}>
          <input style={inputStyle} placeholder="Phone" value={otpPhone} onChange={(e) => setOtpPhone(e.target.value)} />
          <input style={inputStyle} placeholder="OTP code" value={otpCode} onChange={(e) => setOtpCode(e.target.value)} />
          <input style={inputStyle} type="password" placeholder="New password" value={otpNewPassword} onChange={(e) => setOtpNewPassword(e.target.value)} />
        </div>
        <div style={{ marginTop: "0.8rem", display: "flex", gap: "0.6rem", flexWrap: "wrap" }}>
          <button className="btn btn-secondary" onClick={requestCode} disabled={busy}>
            Request OTP
          </button>
          <button className="btn btn-secondary" onClick={verifyCodeAndReset} disabled={busy}>
            Verify and Reset
          </button>
        </div>
      </section>

      <section className="card" style={{ marginBottom: "1rem" }}>
        <h2 style={{ marginTop: 0 }}>Listing Filters</h2>
        <div className="grid" style={{ gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))" }}>
          <input style={inputStyle} placeholder="Country" value={filters.country} onChange={(e) => setFilters((f) => ({ ...f, country: e.target.value }))} />
          <input style={inputStyle} placeholder="County" value={filters.county} onChange={(e) => setFilters((f) => ({ ...f, county: e.target.value }))} />
          <input style={inputStyle} placeholder="Town" value={filters.town} onChange={(e) => setFilters((f) => ({ ...f, town: e.target.value }))} />
          <input style={inputStyle} placeholder="Area" value={filters.area} onChange={(e) => setFilters((f) => ({ ...f, area: e.target.value }))} />
          <input style={inputStyle} placeholder="Category" value={filters.category} onChange={(e) => setFilters((f) => ({ ...f, category: e.target.value }))} />
          <input style={inputStyle} placeholder="Min price" value={filters.minPrice} onChange={(e) => setFilters((f) => ({ ...f, minPrice: e.target.value }))} />
          <input style={inputStyle} placeholder="Max price" value={filters.maxPrice} onChange={(e) => setFilters((f) => ({ ...f, maxPrice: e.target.value }))} />
        </div>
        <div style={{ marginTop: "0.8rem" }}>
          <button className="btn btn-primary" onClick={loadPlots} disabled={loading}>
            {loading ? "Loading..." : "Apply Filters"}
          </button>
        </div>
      </section>

      <section className="card">
        <h2 style={{ marginTop: 0 }}>Listings</h2>
        {loading && <p className="meta">Loading listings...</p>}
        {!loading && filtered.length === 0 && <p className="meta">No listings match the selected filters.</p>}
        {!loading && filtered.length > 0 && (
          <div className="grid" style={{ gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))" }}>
            {filtered.map((plot) => (
              <article key={plot.id || `${plot.title}-${plot.area}`} style={{ border: "1px solid #dbe4ee", borderRadius: 12, padding: "0.7rem" }}>
                <h3 style={{ margin: "0 0 0.35rem", fontSize: "1rem" }}>{plot.title || "Listing"}</h3>
                <p className="meta" style={{ margin: "0 0 0.25rem" }}>
                  {plot.county || plot.town || "County"}, {plot.area || "Area"}
                </p>
                <p className="meta" style={{ margin: "0 0 0.25rem" }}>{plot.category || "Property"}</p>
                <p className="meta" style={{ margin: "0 0 0.25rem" }}>
                  {typeof plot.price === "number" ? `KES ${plot.price.toLocaleString()}` : "Price on request"}
                </p>
                <p className="meta" style={{ margin: 0 }}>{plot.description || "Verified listing on AfricaRentalGrid."}</p>
              </article>
            ))}
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
