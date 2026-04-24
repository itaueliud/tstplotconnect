import type { Metadata } from "next";
import Script from "next/script";

export const metadata: Metadata = {
  title: "Contact AfricaRentalGrid",
  description:
    "Contact AfricaRentalGrid for listing support, account help, partnership inquiries, and general customer assistance across Kenya, Uganda, and Tanzania.",
  alternates: { canonical: "/contact" },
  keywords: [
    "AfricaRentalGrid contact",
    "property listing support",
    "rental platform support",
    "Kenya Uganda Tanzania rentals",
    "customer help AfricaRentalGrid"
  ],
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      "max-image-preview": "large",
      "max-snippet": -1,
      "max-video-preview": -1
    }
  },
  openGraph: {
    title: "Contact AfricaRentalGrid",
    description:
      "Reach the AfricaRentalGrid team for account, listings, and partnership support.",
    url: "/contact",
    type: "website",
    siteName: "AfricaRentalGrid"
  },
  twitter: {
    card: "summary_large_image",
    title: "Contact AfricaRentalGrid",
    description: "Talk to AfricaRentalGrid support for listing and account assistance."
  }
};

export default function ContactPage() {
  const schema = {
    "@context": "https://schema.org",
    "@type": "ContactPage",
    name: "Contact AfricaRentalGrid",
    url: "https://www.tst-plotconnect.com/contact",
    description:
      "Official contact page for AfricaRentalGrid support, partnerships, and listing help.",
    inLanguage: "en"
  };

  return (
    <main className="container" style={{ padding: "2rem 0 3rem" }}>
      <section className="card" style={{ padding: "1.2rem" }}>
        <span className="pill">Contact</span>
        <h1 style={{ margin: "0.8rem 0 0.4rem" }}>Contact AfricaRentalGrid</h1>
        <p className="meta" style={{ margin: 0 }}>
          Reach our team for listing support, account issues, and partnerships in Kenya, Uganda, and Tanzania.
        </p>
      </section>

      <section className="card" style={{ marginTop: "1rem" }}>
        <h2 style={{ marginTop: 0 }}>Support channels</h2>
        <p className="meta" style={{ marginBottom: "0.6rem" }}>
          Use your official support email and phone contacts here. Keeping this page accurate improves trust signals and local SEO.
        </p>
        <ul style={{ margin: 0, paddingLeft: "1.2rem", lineHeight: 1.7 }}>
          <li>Email: support@africarentalgrid.com</li>
          <li>Partnerships: partnerships@africarentalgrid.com</li>
          <li>Hours: Monday to Saturday, 8:00 AM to 6:00 PM EAT</li>
        </ul>
      </section>

      <Script id="contact-schema" type="application/ld+json" strategy="afterInteractive">
        {JSON.stringify(schema)}
      </Script>
    </main>
  );
}
