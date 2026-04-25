"use client";

import Link from "next/link";
import { ReactNode, useEffect, useState } from "react";
import { apiRequest } from "@/lib/api";
import { clearUserSession, readUserSession, type StoredUser } from "./user-session";

type Props = {
  active: "dashboard" | "listings" | "payments" | "profile" | "about" | "contact";
  children: ReactNode;
};

type UserStatus = {
  active?: boolean;
};

function NavLink({
  href,
  label,
  active,
  onNavigate
}: {
  href: string;
  label: string;
  active?: boolean;
  onNavigate?: () => void;
}) {
  return (
    <Link href={href} className={active ? "is-active" : undefined} onClick={onNavigate}>
      {label}
    </Link>
  );
}

export default function AuthenticatedUserShell({ active, children }: Props) {
  const [user, setUser] = useState<StoredUser | null>(null);
  const [status, setStatus] = useState<UserStatus | null>(null);
  const [menuOpen, setMenuOpen] = useState(false);

  useEffect(() => {
    const session = readUserSession();
    setUser(session?.user || null);
    if (session?.token) {
      apiRequest<UserStatus>("/api/user/status", { token: session.token })
        .then((nextStatus) => setStatus(nextStatus || null))
        .catch(() => setStatus(null));
    }
  }, []);

  useEffect(() => {
    setMenuOpen(false);
  }, [active]);

  function logout() {
    clearUserSession();
    window.location.href = "/user";
  }

  return (
    <main className="container portal-shell" style={{ padding: "1.2rem 0 3rem" }}>
      <header className="portal-page-header reveal-card">
        <div className="portal-page-branding">
          <span className="pill">africaRentalsGrind</span>
          <div>
            <strong>Modern property search, payments, and account access in one place.</strong>
            <p>{user?.name ? `Signed in as ${user.name}` : "Explore your dashboard, profile, payments, and listings from one streamlined workspace."}</p>
          </div>
        </div>
        <div className="portal-page-summary" aria-label="Portal summary">
          <div className="portal-page-summary-item">
            <span>Workspace</span>
            <strong>User portal</strong>
          </div>
          <div className="portal-page-summary-item">
            <span>Signed in</span>
            <strong>{user?.phone || user?.name || "Active session"}</strong>
          </div>
          <div className="portal-page-summary-item">
            <span>Focus</span>
            <strong>Listings, profile, payments</strong>
          </div>
        </div>
        <button
          type="button"
          className={`portal-menu-toggle ${menuOpen ? "is-open" : ""}`}
          aria-label={menuOpen ? "Close navigation menu" : "Open navigation menu"}
          aria-expanded={menuOpen}
          aria-controls="portal-side-navigation"
          onClick={() => setMenuOpen((value) => !value)}
        >
          <span />
          <span />
          <span />
        </button>
        <nav className="portal-page-links" aria-label="User page header navigation">
          <Link href="/user">Dashboard</Link>
          <Link href="/user#listings">Listings</Link>
          <Link href="/profile">Profile</Link>
          <Link href="/payments">Payments</Link>
        </nav>
      </header>

      <div className="portal-dashboard-shell">
        <button
          type="button"
          className={`portal-drawer-backdrop ${menuOpen ? "is-open" : ""}`}
          aria-label="Close navigation menu"
          onClick={() => setMenuOpen(false)}
        />
        <aside
          id="portal-side-navigation"
          className={`card portal-side-nav reveal-card ${menuOpen ? "is-open" : ""}`}
        >
          <div className="portal-side-brand">
            <div className="portal-side-profile">
              <div className="portal-side-avatar" aria-hidden="true">
                <span className="portal-side-avatar-head" />
                <span className="portal-side-avatar-body" />
              </div>
              <div className="portal-side-identity">
                <span className="pill">africaRentalsGrind</span>
                <strong>{user?.name || "User dashboard"}</strong>
                <span className="portal-side-meta">{user?.displayId || user?.phone || "-"}</span>
              </div>
            </div>
            <div className="portal-side-detail-list" aria-label="User account summary">
              <div className="portal-side-detail-row">
                <span>User ID</span>
                <strong>{user?.displayId || "-"}</strong>
              </div>
              <div className="portal-side-detail-row">
                <span>Country</span>
                <strong>{user?.country || "-"}</strong>
              </div>
            </div>
            <div className="portal-side-status" aria-label="Account status">
              <label className="portal-status-check is-active">
                <input type="checkbox" checked={Boolean(status?.active)} readOnly />
                <span className="portal-status-dot" />
                <strong>Active</strong>
              </label>
              <label className="portal-status-check is-inactive">
                <input type="checkbox" checked={!status?.active} readOnly />
                <span className="portal-status-dot" />
                <strong>Inactive</strong>
              </label>
            </div>
          </div>
          <nav className="portal-side-links" aria-label="Dashboard side navigation">
            <NavLink href="/user" label="Dashboard" active={active === "dashboard"} onNavigate={() => setMenuOpen(false)} />
            <NavLink href="/user#listings" label="Listings" active={active === "listings"} onNavigate={() => setMenuOpen(false)} />
            <NavLink href="/payments" label="Payments" active={active === "payments"} onNavigate={() => setMenuOpen(false)} />
            <NavLink href="/profile" label="Profile" active={active === "profile"} onNavigate={() => setMenuOpen(false)} />
            <NavLink href="/about" label="About page" active={active === "about"} onNavigate={() => setMenuOpen(false)} />
            <NavLink href="/contact" label="Contact page" active={active === "contact"} onNavigate={() => setMenuOpen(false)} />
          </nav>
          <div className="portal-side-actions">
            <button className="btn btn-secondary" onClick={logout}>Logout</button>
          </div>
        </aside>

        <div className="portal-main-stack">
          {children}
        </div>
      </div>

      <footer className="portal-page-footer reveal-card">
        <div className="portal-page-footer-copy">
          <div>
            <strong>africaRentalsGrind</strong>
            <p>Built for location-first rental browsing, account management, and faster discovery across the marketplace.</p>
          </div>
          <div className="portal-page-footer-meta">
            <div className="portal-page-footer-block">
              <span>Inside this portal</span>
              <strong>Browse listings, manage profile, review payments, and keep your access in one place.</strong>
            </div>
            <div className="portal-page-footer-block">
              <span>Support</span>
              <strong>Use the contact page for help with access, listings, or account issues.</strong>
            </div>
          </div>
        </div>
        <nav className="portal-page-footer-links" aria-label="User page footer navigation">
          <Link href="/user">Dashboard</Link>
          <Link href="/about">About</Link>
          <Link href="/contact">Contact</Link>
          <Link href="/privacy">Privacy</Link>
          <Link href="/user#listings">Browse listings</Link>
        </nav>
      </footer>
    </main>
  );
}
