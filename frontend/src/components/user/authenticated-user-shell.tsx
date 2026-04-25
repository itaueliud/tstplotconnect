"use client";

import Link from "next/link";
import { ReactNode, useEffect, useState } from "react";
import { clearUserSession, readUserSession, type StoredUser } from "./user-session";

type Props = {
  active: "dashboard" | "listings" | "payments" | "profile" | "about" | "contact";
  children: ReactNode;
};

function NavLink({ href, label, active }: { href: string; label: string; active?: boolean }) {
  return (
    <Link href={href} className={active ? "is-active" : undefined}>
      {label}
    </Link>
  );
}

export default function AuthenticatedUserShell({ active, children }: Props) {
  const [user, setUser] = useState<StoredUser | null>(null);

  useEffect(() => {
    const session = readUserSession();
    setUser(session?.user || null);
  }, []);

  function logout() {
    clearUserSession();
    window.location.href = "/user";
  }

  return (
    <main className="container portal-shell" style={{ padding: "1.2rem 0 3rem" }}>
      <div className="portal-dashboard-shell">
        <aside className="card portal-side-nav reveal-card">
          <div className="portal-side-brand">
            <span className="pill">TST PlotConnect</span>
            <strong>{user?.name || "User dashboard"}</strong>
            <span className="portal-side-meta">{user?.phone || ""}</span>
          </div>
          <nav className="portal-side-links" aria-label="Dashboard side navigation">
            <NavLink href="/user" label="Dashboard" active={active === "dashboard"} />
            <NavLink href="/user#listings" label="Listings" active={active === "listings"} />
            <NavLink href="/payments" label="Payments" active={active === "payments"} />
            <NavLink href="/profile" label="Profile" active={active === "profile"} />
            <NavLink href="/about" label="About page" active={active === "about"} />
            <NavLink href="/contact" label="Contact page" active={active === "contact"} />
          </nav>
          <div className="portal-side-actions">
            <button className="btn btn-secondary" onClick={logout}>Logout</button>
          </div>
        </aside>

        <div className="portal-main-stack">
          {children}
        </div>
      </div>
    </main>
  );
}
