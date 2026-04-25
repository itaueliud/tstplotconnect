"use client";

import Link from "next/link";
import { ReactNode, useEffect, useState } from "react";
import { clearUserSession, readUserSession, type StoredUser } from "./user-session";

type Props = {
  active: "dashboard" | "listings" | "payments" | "profile" | "about" | "contact";
  children: ReactNode;
};

function NavLink({ href, label, active, onClick }: { href: string; label: string; active?: boolean; onClick?: () => void }) {
  return (
    <Link href={href} className={active ? "is-active" : undefined} onClick={onClick}>
      {label}
    </Link>
  );
}

export default function AuthenticatedUserShell({ active, children }: Props) {
  const [user, setUser] = useState<StoredUser | null>(null);
  const [menuOpen, setMenuOpen] = useState(false);

  useEffect(() => {
    const session = readUserSession();
    setUser(session?.user || null);
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
        <button
          type="button"
          className={`portal-mobile-menu-button ${menuOpen ? "is-open" : ""}`}
          aria-label={menuOpen ? "Close navigation menu" : "Open navigation menu"}
          aria-expanded={menuOpen}
          aria-controls="portal-mobile-drawer"
          onClick={() => setMenuOpen((open) => !open)}
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

      <div
        className={`portal-mobile-overlay ${menuOpen ? "is-visible" : ""}`}
        aria-hidden={!menuOpen}
        onClick={() => setMenuOpen(false)}
      />

      <div className="portal-dashboard-shell">
        <aside
          id="portal-mobile-drawer"
          className={`card portal-side-nav reveal-card ${menuOpen ? "is-mobile-open" : ""}`}
          aria-hidden={!menuOpen}
        >
          <div className="portal-side-brand">
            <span className="pill">africaRentalsGrind</span>
            <strong>{user?.name || "User dashboard"}</strong>
            <span className="portal-side-meta">{user?.phone || ""}</span>
          </div>
          <nav className="portal-side-links" aria-label="Dashboard side navigation">
            <NavLink href="/user" label="Dashboard" active={active === "dashboard"} onClick={() => setMenuOpen(false)} />
            <NavLink href="/user#listings" label="Listings" active={active === "listings"} onClick={() => setMenuOpen(false)} />
            <NavLink href="/payments" label="Payments" active={active === "payments"} onClick={() => setMenuOpen(false)} />
            <NavLink href="/profile" label="Profile" active={active === "profile"} onClick={() => setMenuOpen(false)} />
            <NavLink href="/about" label="About page" active={active === "about"} onClick={() => setMenuOpen(false)} />
            <NavLink href="/contact" label="Contact page" active={active === "contact"} onClick={() => setMenuOpen(false)} />
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
        <div>
          <strong>africaRentalsGrind</strong>
          <p>Built for location-first rental browsing, account management, and faster discovery across the marketplace.</p>
        </div>
        <nav className="portal-page-footer-links" aria-label="User page footer navigation">
          <Link href="/about">About</Link>
          <Link href="/contact">Contact</Link>
          <Link href="/privacy">Privacy</Link>
          <Link href="/user#listings">Browse listings</Link>
        </nav>
      </footer>
    </main>
  );
}
