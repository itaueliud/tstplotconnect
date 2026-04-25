import type { Metadata } from "next";
import Link from "next/link";
import Script from "next/script";
import AuthenticatedUserShell from "@/components/user/authenticated-user-shell";

export const metadata: Metadata = {
  title: "About africaRentalsGrind",
  description:
    "Learn how africaRentalsGrind helps renters, students, and travelers discover verified hostels, lodges, bedsitters, apartments, and plots across Kenya.",
  alternates: { canonical: "/about" },
  keywords: [
    "About africaRentalsGrind",
    "verified listings Kenya",
    "hostels and lodges Kenya",
    "property discovery platform",
    "africaRentalsGrind mission"
  ],
  robots: {
    index: true,
    follow: true
  },
  openGraph: {
    title: "About africaRentalsGrind",
    description: "Discover the mission, service focus, and trust model behind africaRentalsGrind.",
    url: "/about",
    type: "website",
    siteName: "africaRentalsGrind"
  },
  twitter: {
    card: "summary_large_image",
    title: "About africaRentalsGrind",
    description: "Learn what africaRentalsGrind offers and how it helps people find trusted listings."
  }
};

export default function AboutPage() {
  const schema = {
    "@context": "https://schema.org",
    "@type": "AboutPage",
    name: "About africaRentalsGrind",
    url: "https://www.tst-plotconnect.com/about",
    description:
      "About page describing africaRentalsGrind's mission, service areas, and trusted property discovery approach.",
    inLanguage: "en-KE"
  };

  return (
    <AuthenticatedUserShell active="about">
      <section className="card" style={{ padding: "1.4rem", background: "linear-gradient(135deg, rgba(7,17,30,0.96), rgba(15,118,110,0.82))", color: "#fff" }}>
        <span className="pill">About africaRentalsGrind</span>
        <h1 style={{ margin: "0.85rem 0 0.55rem", fontSize: "clamp(2rem, 4vw, 3.5rem)", lineHeight: 1, letterSpacing: "-0.04em" }}>
          Verified property discovery built for real people moving across Kenya.
        </h1>
        <p style={{ margin: 0, maxWidth: 760, color: "rgba(236,245,255,0.86)", lineHeight: 1.8 }}>
          africaRentalsGrind helps renters, students, travelers, and short-stay customers discover trusted hostels, bedsitters,
          apartments, lodges, guest houses, and plots through one modern search experience.
        </p>
      </section>

      <section className="grid" style={{ gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))", marginTop: "1rem" }}>
        <article className="card">
          <span className="pill">Mission</span>
          <h2 style={{ margin: "0.7rem 0 0.45rem" }}>Make property search faster and more trustworthy.</h2>
          <p className="meta" style={{ margin: 0 }}>
            We focus on clear categories, location-first search, and verified listing flows so users can compare options with less friction and more confidence.
          </p>
        </article>
        <article className="card">
          <span className="pill">Who We Serve</span>
          <h2 style={{ margin: "0.7rem 0 0.45rem" }}>Students, renters, travelers, and accommodation seekers.</h2>
          <p className="meta" style={{ margin: 0 }}>
            africaRentalsGrind is built for people looking for everyday rentals, temporary stays, and local accommodation opportunities across active Kenyan markets.
          </p>
        </article>
        <article className="card">
          <span className="pill">Coverage</span>
          <h2 style={{ margin: "0.7rem 0 0.45rem" }}>Search by county, town, area, and category.</h2>
          <p className="meta" style={{ margin: 0 }}>
            Our platform is designed around real location filters so users can narrow down listings quickly and move from browsing to contact faster.
          </p>
        </article>
      </section>

      <section className="card" style={{ marginTop: "1rem" }}>
        <h2 style={{ marginTop: 0 }}>What makes africaRentalsGrind useful</h2>
        <div className="grid" style={{ gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))" }}>
          <div>
            <strong>Verified listing flow</strong>
            <p className="meta">Listings are presented with clearer details, categories, prices, and location information so users can make quicker decisions.</p>
          </div>
          <div>
            <strong>Activation-based access</strong>
            <p className="meta">The account and activation flow is designed to unlock deeper access while keeping the browsing experience simple and consistent.</p>
          </div>
          <div>
            <strong>Support that stays reachable</strong>
            <p className="meta">Users can contact the team for listing help, account support, payment guidance, and general assistance when needed.</p>
          </div>
        </div>
      </section>

      <section className="card" style={{ marginTop: "1rem" }}>
        <h2 style={{ marginTop: 0 }}>Core categories on the platform</h2>
        <div className="chip-row">
          {["Hostels", "Bedsitters", "Apartments", "Lodges", "Guest Houses", "Rental Houses", "Plots for Sale"].map((item) => (
            <span key={item} className="chip">{item}</span>
          ))}
        </div>
      </section>

      <section className="card" style={{ marginTop: "1rem" }}>
        <h2 style={{ marginTop: 0 }}>Need help or want to partner?</h2>
        <p className="meta" style={{ marginTop: 0 }}>
          For support, listing guidance, activation help, or partnership inquiries, use the official africaRentalsGrind contact channels.
        </p>
        <div style={{ display: "flex", gap: "0.7rem", flexWrap: "wrap" }}>
          <Link href="/contact" className="btn btn-primary">Open Contact Page</Link>
          <Link href="/user" className="btn btn-secondary">Back to Dashboard</Link>
        </div>
      </section>

      <Script id="about-schema" type="application/ld+json" strategy="afterInteractive">
        {JSON.stringify(schema)}
      </Script>
    </AuthenticatedUserShell>
  );
}
