import type { Metadata } from "next";
import Script from "next/script";

export const metadata: Metadata = {
  title: "Privacy Policy | AfricaRentalGrid",
  description:
    "Read the AfricaRentalGrid privacy policy for details on data collection, account information handling, cookies, and user rights.",
  alternates: { canonical: "/privacy" },
  keywords: [
    "AfricaRentalGrid privacy policy",
    "data protection property platform",
    "user data policy",
    "cookies policy",
    "privacy rights East Africa"
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
    title: "Privacy Policy | AfricaRentalGrid",
    description:
      "Understand how AfricaRentalGrid collects, uses, and protects user information.",
    url: "/privacy",
    type: "website",
    siteName: "AfricaRentalGrid"
  },
  twitter: {
    card: "summary_large_image",
    title: "Privacy Policy | AfricaRentalGrid",
    description: "Review AfricaRentalGrid's privacy and data handling policy."
  }
};

export default function PrivacyPage() {
  const schema = {
    "@context": "https://schema.org",
    "@type": "WebPage",
    name: "AfricaRentalGrid Privacy Policy",
    url: "https://www.tst-plotconnect.com/privacy",
    description: "Privacy policy page for AfricaRentalGrid users.",
    inLanguage: "en"
  };

  return (
    <main className="container" style={{ padding: "2rem 0 3rem" }}>
      <section className="card" style={{ padding: "1.2rem" }}>
        <span className="pill">Privacy</span>
        <h1 style={{ margin: "0.8rem 0 0.4rem" }}>Privacy Policy</h1>
        <p className="meta" style={{ margin: 0 }}>
          This policy explains what information AfricaRentalGrid collects and how it is used to provide listing and account services.
        </p>
      </section>

      <section className="card" style={{ marginTop: "1rem" }}>
        <h2 style={{ marginTop: 0 }}>Policy highlights</h2>
        <ul style={{ margin: 0, paddingLeft: "1.2rem", lineHeight: 1.7 }}>
          <li>Information collected for account, listing, and support workflows</li>
          <li>Usage of cookies and analytics for service improvement</li>
          <li>Security controls used to protect account data</li>
          <li>How users can request account updates or data deletion</li>
        </ul>
      </section>

      <Script id="privacy-schema" type="application/ld+json" strategy="afterInteractive">
        {JSON.stringify(schema)}
      </Script>
    </main>
  );
}
