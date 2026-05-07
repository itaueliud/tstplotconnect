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
  navKey,
  active,
  onNavigate
}: {
  href: string;
  label: string;
  navKey: string;
  active?: boolean;
  onNavigate?: () => void;
}) {
  return (
    <Link href={href} className={active ? "is-active" : undefined} onClick={onNavigate}>
      <span className={`nav-dot nav-dot-${navKey}`} aria-hidden="true" />
      <span>{label}</span>
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

  useEffect(() => {
    if (!menuOpen) {
      document.body.style.overflow = "";
      return;
    }

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    return () => {
      document.body.style.overflow = previousOverflow;
    };
  }, [menuOpen]);

  useEffect(() => {
    if (!menuOpen) {
      return;
    }

    function handleEsc(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setMenuOpen(false);
      }
    }

    window.addEventListener("keydown", handleEsc);
    return () => window.removeEventListener("keydown", handleEsc);
  }, [menuOpen]);

  function logout() {
    clearUserSession();
    window.location.href = "/user";
  }

  return (
    <main className="portal-workspace">
      <div className="portal-dashboard-shell portal-dashboard-shell-fixed">
        <button
          type="button"
          className={`portal-drawer-backdrop ${menuOpen ? "is-open" : ""}`}
          aria-label="Close navigation menu"
          onClick={() => setMenuOpen(false)}
        />
        <aside
          id="portal-side-navigation"
          className={`card portal-side-nav ${menuOpen ? "is-open" : ""}`}
        >
          <button
            type="button"
            className="portal-side-close"
            aria-label="Close side navigation"
            onClick={() => setMenuOpen(false)}
          >
            Close
          </button>
          <div className="portal-side-brand">
            <div className="portal-side-profile">
              <div className="portal-side-avatar" aria-hidden="true">
                <span className="portal-side-avatar-head" />
                <span className="portal-side-avatar-body" />
              </div>
              <div className="portal-side-identity">
                <span className="pill">tstplotconnect</span>
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
            <NavLink href="/user" label="Overview" navKey="overview" active={active === "dashboard"} onNavigate={() => setMenuOpen(false)} />
            <NavLink href="/user#listings" label="My Listings" navKey="listings" active={active === "listings"} onNavigate={() => setMenuOpen(false)} />
            <NavLink href="/payments" label="Payments" navKey="payments" active={active === "payments"} onNavigate={() => setMenuOpen(false)} />
            <NavLink href="/profile" label="Profile" navKey="profile" active={active === "profile"} onNavigate={() => setMenuOpen(false)} />
            <NavLink href="/about" label="About" navKey="about" active={active === "about"} onNavigate={() => setMenuOpen(false)} />
            <NavLink href="/contact" label="Support" navKey="support" active={active === "contact"} onNavigate={() => setMenuOpen(false)} />
          </nav>
          <div className="portal-side-actions">
            <button className="btn btn-secondary" onClick={logout}>Logout</button>
          </div>
        </aside>

        <div className="portal-main-stack portal-main-stack-fixed">
          <header className="portal-inline-topbar">
            <div className="portal-inline-topbar-left">
              <div>
                <strong>{active === "listings" ? "Listings Workspace" : "User Dashboard"}</strong>
              </div>
            </div>
            <div className="portal-inline-topbar-right">
              <Link href="/profile" className="portal-inline-profile" onClick={() => setMenuOpen(false)}>
                <span className="avatar">{(user?.name || "U").slice(0, 1).toUpperCase()}</span>
                <div>
                  <strong>{user?.name || "User"}</strong>
                  <span>{user?.phone || "-"}</span>
                </div>
              </Link>
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
              </button>
            </div>
          </header>
          {children}
          {!menuOpen && (
          <nav className="portal-mobile-bottom-nav" aria-label="Mobile quick navigation">
            <Link href="/user" className={active === "dashboard" ? "is-active" : ""}>
              <span>Home</span>
            </Link>
            <Link href="/user#listings" className={active === "listings" ? "is-active" : ""}>
              <span>Search</span>
            </Link>
            <Link href="/main">
              <span>Map</span>
            </Link>
            <Link href="/user#saved">
              <span>Saved</span>
            </Link>
            <Link href="/profile" className={active === "profile" ? "is-active" : ""}>
              <span>Profile</span>
            </Link>
          </nav>
          )}
        </div>
      </div>
    </main>
  );
}
