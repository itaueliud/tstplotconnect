import type { Metadata } from "next";
import Link from "next/link";
import Script from "next/script";
import AuthenticatedUserShell from "@/components/user/authenticated-user-shell";

export const metadata: Metadata = {
  title: "Contact africaRentalsGrind",
  description:
    "Contact africaRentalsGrind for listing support, account help, payment guidance, WhatsApp support, and partnership inquiries across Kenya.",
  alternates: { canonical: "/contact" },
  keywords: [
    "Contact africaRentalsGrind",
    "africaRentalsGrind support",
    "listing support Kenya",
    "WhatsApp africaRentalsGrind",
    "support@tst-plotconnect.com"
  ],
  robots: {
    index: true,
    follow: true
  },
  openGraph: {
    title: "Contact africaRentalsGrind",
    description: "Reach africaRentalsGrind for support, listings help, and partnership inquiries.",
    url: "/contact",
    type: "website",
    siteName: "africaRentalsGrind"
  },
  twitter: {
    card: "summary_large_image",
    title: "Contact africaRentalsGrind",
    description: "Official support contacts for africaRentalsGrind."
  }
};

export default function ContactPage() {
  const schema = [
    {
      "@context": "https://schema.org",
      "@type": "ContactPage",
      name: "Contact africaRentalsGrind",
      url: "https://www.tst-plotconnect.com/contact",
      description: "Official contact page for africaRentalsGrind support, partnerships, and user assistance.",
      inLanguage: "en-KE"
    },
    {
      "@context": "https://schema.org",
      "@type": "LocalBusiness",
      name: "africaRentalsGrind",
      description: "africaRentalsGrind helps people discover verified hostels, bedsitters, lodges, apartments, and plots across Kenya.",
      url: "https://www.tst-plotconnect.com",
      telephone: "+254768622994",
      email: "support@tst-plotconnect.com",
      address: {
        "@type": "PostalAddress",
        addressCountry: "KE",
        addressLocality: "Kenya",
        addressRegion: "Kenya"
      },
      areaServed: ["KE"],
      sameAs: [
        "https://web.facebook.com/profile.php?id=61586345377148",
        "https://www.instagram.com/techswifttrix/?hl=en",
        "https://wa.me/254768622994"
      ],
      contactPoint: {
        "@type": "ContactPoint",
        telephone: "+254768622994",
        contactType: "customer support",
        email: "support@tst-plotconnect.com",
        areaServed: "KE",
        availableLanguage: ["en", "sw"]
      }
    }
  ];

  return (
    <AuthenticatedUserShell active="contact">
      <section className="card" style={{ padding: "1.4rem", background: "linear-gradient(135deg, rgba(7,17,30,0.96), rgba(13,88,122,0.86))", color: "#fff" }}>
        <span className="pill">Contact africaRentalsGrind</span>
        <h1 style={{ margin: "0.85rem 0 0.55rem", fontSize: "clamp(2rem, 4vw, 3.4rem)", lineHeight: 1, letterSpacing: "-0.04em" }}>
          Reach support quickly when you need listing, login, or activation help.
        </h1>
        <p style={{ margin: 0, maxWidth: 760, color: "rgba(236,245,255,0.86)", lineHeight: 1.8 }}>
          We support account access issues, listing questions, payment guidance, and general help through official africaRentalsGrind channels.
        </p>
      </section>

      <section className="grid" style={{ gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", marginTop: "1rem" }}>
        <article className="card">
          <span className="pill">Email</span>
          <h2 style={{ margin: "0.7rem 0 0.35rem" }}>Support inbox</h2>
          <a href="mailto:support@tst-plotconnect.com" style={{ color: "#0f766e", fontWeight: 800 }}>support@tst-plotconnect.com</a>
          <p className="meta" style={{ marginBottom: 0 }}>Best for account support, listing issues, activation questions, and detailed follow-up.</p>
        </article>
        <article className="card">
          <span className="pill">Phone</span>
          <h2 style={{ margin: "0.7rem 0 0.35rem" }}>Call support</h2>
          <a href="tel:0768622994" style={{ color: "#0f766e", fontWeight: 800 }}>0768622994</a>
          <p className="meta" style={{ marginBottom: 0 }}>Use this line for faster help during support hours when you need direct assistance.</p>
        </article>
        <article className="card">
          <span className="pill">WhatsApp</span>
          <h2 style={{ margin: "0.7rem 0 0.35rem" }}>Chat support</h2>
          <a href="https://wa.me/254768622994" target="_blank" rel="noopener noreferrer" style={{ color: "#0f766e", fontWeight: 800 }}>
            +254 768 622 994
          </a>
          <p className="meta" style={{ marginBottom: 0 }}>Great for quick troubleshooting, clarifications, and support follow-up.</p>
        </article>
      </section>

      <section className="grid" style={{ gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))", marginTop: "1rem" }}>
        <article className="card">
          <h2 style={{ marginTop: 0 }}>Support hours</h2>
          <p className="meta" style={{ marginTop: 0 }}>Monday to Saturday, 8:00 AM to 6:00 PM EAT</p>
          <p className="meta" style={{ marginBottom: 0 }}>
            If you contact us outside support hours, leave your phone number and the issue you need help with and we will follow up.
          </p>
        </article>
        <article className="card">
          <h2 style={{ marginTop: 0 }}>What we can help with</h2>
          <ul style={{ margin: 0, paddingLeft: "1.1rem", lineHeight: 1.8, color: "#475569" }}>
            <li>Login and password reset assistance</li>
            <li>Account activation and payment guidance</li>
            <li>Listing questions and property contact details</li>
            <li>Partnership and business inquiries</li>
          </ul>
        </article>
      </section>

      <section className="card" style={{ marginTop: "1rem" }}>
        <h2 style={{ marginTop: 0 }}>Quick actions</h2>
        <div style={{ display: "flex", gap: "0.7rem", flexWrap: "wrap" }}>
          <a className="btn btn-primary" href="mailto:support@tst-plotconnect.com?subject=Support%20Request%20-%20africaRentalsGrind">Email Support</a>
          <a className="btn btn-secondary" href="https://wa.me/254768622994" target="_blank" rel="noopener noreferrer">Chat on WhatsApp</a>
          <Link href="/user" className="btn btn-secondary">Back to Dashboard</Link>
        </div>
      </section>

      <Script id="contact-schema" type="application/ld+json" strategy="afterInteractive">
        {JSON.stringify(schema)}
      </Script>
    </AuthenticatedUserShell>
  );
}
