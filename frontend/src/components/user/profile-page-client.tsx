"use client";

import { useEffect, useState } from "react";
import AuthenticatedUserShell from "./authenticated-user-shell";
import PasswordField from "./password-field";
import { readUserSession, writeUserSession } from "./user-session";
import { apiRequest } from "@/lib/api";

type Profile = {
  id?: string;
  displayId?: string;
  name?: string;
  email?: string;
  phone?: string;
  country?: string;
  createdAt?: string | null;
};

function fmtDate(value?: string | null): string {
  if (!value) return "-";
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? "-" : date.toLocaleString();
}

export default function ProfilePageClient() {
  const [token, setToken] = useState("");
  const [sessionReady, setSessionReady] = useState(false);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [form, setForm] = useState({ name: "", email: "", phone: "", country: "Kenya" });
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [busyProfile, setBusyProfile] = useState(false);
  const [busyPassword, setBusyPassword] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  async function loadProfile(authToken: string) {
    try {
      const data = await apiRequest<Profile>("/api/user/profile", { token: authToken });
      setProfile(data || null);
      setForm({
        name: data?.name || "",
        email: data?.email || "",
        phone: data?.phone || "",
        country: data?.country || "Kenya"
      });
    } catch (e) {
      setError(e instanceof Error ? e.message : "Unable to load your profile.");
    }
  }

  async function saveProfile() {
    if (!token) return;
    setBusyProfile(true);
    setError("");
    try {
      const data = await apiRequest<{ message?: string; user?: Profile }>("/api/user/profile", {
        method: "PUT",
        token,
        body: JSON.stringify(form)
      });
      const nextUser = data?.user || null;
      setProfile(nextUser);
      const session = readUserSession();
      if (session?.token) {
        writeUserSession({
          token: session.token,
          user: {
            ...session.user,
            id: nextUser?.id || session.user?.id,
            displayId: nextUser?.displayId || session.user?.displayId,
            name: nextUser?.name || "",
            email: nextUser?.email || "",
            phone: nextUser?.phone || "",
            country: nextUser?.country || "Kenya"
          }
        });
      }
      setMessage(data?.message || "Profile updated successfully.");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Unable to update profile.");
    } finally {
      setBusyProfile(false);
    }
  }

  async function changePassword() {
    if (!token) return;
    if (newPassword !== confirmPassword) {
      setError("New password and confirmation do not match.");
      return;
    }
    setBusyPassword(true);
    setError("");
    try {
      const data = await apiRequest<{ message?: string }>("/api/user/change-password", {
        method: "PUT",
        token,
        body: JSON.stringify({ currentPassword, newPassword })
      });
      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
      setMessage(data?.message || "Password changed successfully.");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Unable to change password.");
    } finally {
      setBusyPassword(false);
    }
  }

  useEffect(() => {
    const session = readUserSession();
    if (session?.token) {
      setToken(session.token);
      loadProfile(session.token);
    }
    setSessionReady(true);
  }, []);

  useEffect(() => {
    if (!message && !error) return;
    const timeout = window.setTimeout(() => {
      setMessage("");
      setError("");
    }, 4000);
    return () => window.clearTimeout(timeout);
  }, [message, error]);

  return (
    <AuthenticatedUserShell active="profile">
      {(message || error) && (
        <div className={`portal-toast ${error ? "is-error" : "is-success"}`}>
          {error || message}
        </div>
      )}

      <section className="portal-hero portal-hero-surface reveal-card">
        <div className="portal-hero-copy">
          <span className="pill">Profile</span>
          <h1 style={{ margin: 0, fontSize: "2.1rem", fontWeight: 800, color: "#0f172a" }}>Manage your account details</h1>
          <p style={{ margin: "0.7rem 0 0.5rem", color: "#334155", fontSize: "1.04rem" }}>
            Update your name, email, phone, and country, then change your password securely from the same place.
          </p>
        </div>
        <div className="portal-hero-overview">
          <article className="portal-overview-card">
            <span>User ID</span>
            <strong>{profile?.displayId || profile?.id || "-"}</strong>
          </article>
          <article className="portal-overview-card">
            <span>Phone</span>
            <strong>{profile?.phone || "-"}</strong>
          </article>
          <article className="portal-overview-card">
            <span>Country</span>
            <strong>{profile?.country || "-"}</strong>
          </article>
          <article className="portal-overview-card">
            <span>Joined</span>
            <strong>{fmtDate(profile?.createdAt)}</strong>
          </article>
        </div>
      </section>

      {!sessionReady && (
        <section className="card portal-session-loading reveal-card">
          <span className="pill">Loading</span>
          <h2 style={{ margin: "0.65rem 0 0.35rem", color: "#0f172a" }}>Restoring your profile</h2>
          <p className="meta" style={{ margin: 0 }}>Checking your saved session before loading account details.</p>
        </section>
      )}

      {sessionReady && !token && (
        <section className="card reveal-card">
          <p className="meta" style={{ margin: 0 }}>Login from the user page to manage your profile.</p>
        </section>
      )}

      {sessionReady && token && (
        <div className="portal-profile-grid">
          <section className="card portal-auth-card reveal-card">
            <span className="pill">Profile details</span>
            <h2 style={{ marginBottom: "0.4rem" }}>Your account information</h2>
            <div className="grid" style={{ gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))" }}>
              <input className="portal-input" placeholder="Full name" value={form.name} onChange={(e) => setForm((prev) => ({ ...prev, name: e.target.value }))} />
              <input className="portal-input" placeholder="Email address" value={form.email} onChange={(e) => setForm((prev) => ({ ...prev, email: e.target.value }))} />
              <input className="portal-input" placeholder="Phone number" value={form.phone} onChange={(e) => setForm((prev) => ({ ...prev, phone: e.target.value }))} />
              <select className="portal-input" value={form.country} onChange={(e) => setForm((prev) => ({ ...prev, country: e.target.value }))}>
                <option>Kenya</option>
                <option>Uganda</option>
                <option>Tanzania</option>
              </select>
            </div>
            <div style={{ marginTop: "0.9rem", display: "flex", gap: "0.6rem", flexWrap: "wrap" }}>
              <button className="btn btn-primary" onClick={saveProfile} disabled={busyProfile}>
                {busyProfile ? "Saving..." : "Save profile"}
              </button>
            </div>
          </section>

          <section className="card portal-auth-card reveal-card">
            <span className="pill">Security</span>
            <h2 style={{ marginBottom: "0.4rem" }}>Change password</h2>
            <div className="grid" style={{ gridTemplateColumns: "1fr", gap: "0.9rem" }}>
              <PasswordField placeholder="Current password" value={currentPassword} onChange={setCurrentPassword} />
              <PasswordField placeholder="New password" value={newPassword} onChange={setNewPassword} />
              <PasswordField placeholder="Confirm new password" value={confirmPassword} onChange={setConfirmPassword} />
            </div>
            <div style={{ marginTop: "0.9rem", display: "flex", gap: "0.6rem", flexWrap: "wrap" }}>
              <button className="btn btn-primary" onClick={changePassword} disabled={busyPassword}>
                {busyPassword ? "Updating..." : "Change password"}
              </button>
            </div>
          </section>
        </div>
      )}
    </AuthenticatedUserShell>
  );
}
