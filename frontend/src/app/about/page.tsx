import type { Metadata } from "next";
import Script from "next/script";

export const metadata: Metadata = {
  title: "About AfricaRentalGrid",
  description:
    "Learn how AfricaRentalGrid helps users discover verified plots, hostels, bedsitters, and lodges with county-level search across East Africa.",
  alternates: { canonical: "/about" },
  keywords: [
    "about AfricaRentalGrid",
    "East Africa property platform",
    "verified rental listings",
    "county property search",
    "real estate marketplace Kenya Uganda Tanzania"
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
    title: "About AfricaRentalGrid",
    description:
      "Discover AfricaRentalGrid's mission to simplify trusted property discovery in East Africa.",
    url: "/about",
    type: "website",
    siteName: "AfricaRentalGrid"
  },
  twitter: {
    card: "summary_large_image",
    title: "About AfricaRentalGrid",
    description: "Learn the mission and values behind AfricaRentalGrid."
  }
};

export default function AboutPage() {
  const schema = {
    "@context": "https://schema.org",
    "@type": "AboutPage",
    name: "About AfricaRentalGrid",
    url: "https://www.tst-plotconnect.com/about",
    description:
      "About page describing AfricaRentalGrid's mission, service scope, and trusted listing approach.",
    inLanguage: "en"
  };

  return (
    <main className="container" style={{ padding: "2rem 0 3rem" }}>
      <section className="card" style={{ padding: "1.2rem" }}>
        <span className="pill">About</span>
        <h1 style={{ margin: "0.8rem 0 0.4rem" }}>About AfricaRentalGrid</h1>
        <p className="meta" style={{ margin: 0 }}>
          AfricaRentalGrid is built to make location-first property discovery faster and clearer across Kenya, Uganda, and Tanzania.
        </p>
      </section>

      <section className="card" style={{ marginTop: "1rem" }}>
        <h2 style={{ marginTop: 0 }}>What we focus on</h2>
        <ul style={{ margin: 0, paddingLeft: "1.2rem", lineHeight: 1.7 }}>
          <li>County-level pages designed for strong search visibility</li>
          <li>Direct links into pre-filtered user listing results</li>
          <li>Clear listing categories such as plots, hostels, bedsitters, and lodges</li>
          <li>Consistent metadata and structured data across high-intent landing pages</li>
        </ul>
      </section>

      <Script id="about-schema" type="application/ld+json" strategy="afterInteractive">
        {JSON.stringify(schema)}
      </Script>
    </main>
  );
}
