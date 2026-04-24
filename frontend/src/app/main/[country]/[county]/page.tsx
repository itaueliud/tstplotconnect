import type { Metadata } from "next";
import Link from "next/link";
import Script from "next/script";
import { notFound } from "next/navigation";
import { countryDisplayNames, CountrySlug } from "@/main";
import {
  countyMetaDescription,
  countySeoKeywords,
  getCountryCountyPairs,
  getCountiesForCountry,
  getTownsForCounty,
  slugify
} from "@/lib/locations";

type Props = { params: Promise<{ country: string; county: string }> };

const countryList: CountrySlug[] = ["kenya", "uganda", "tanzania"];

function isCountry(value: string): value is CountrySlug {
  return countryList.includes(value as CountrySlug);
}

function filteredUserUrl(country: string, county: string, town?: string): string {
  const qp = new URLSearchParams({ country, county });
  if (town) qp.set("town", town);
  return `/user?${qp.toString()}`;
}

export async function generateStaticParams() {
  const pairs = await getCountryCountyPairs();
  return pairs.map((pair) => ({ country: pair.country, county: slugify(pair.county) }));
}

export const revalidate = 1800;

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { country, county } = await params;
  if (!isCountry(country)) return {};

  const displayCountry = countryDisplayNames[country];
  const counties = await getCountiesForCountry(country);
  const resolvedCounty = counties.find((item) => slugify(item) === county);

  if (!resolvedCounty) {
    return {
      title: `County Not Found | AfricaRentalGrid`,
      description: `The county page you requested does not exist.`,
      robots: { index: false, follow: false }
    };
  }

  const towns = await getTownsForCounty(country, resolvedCounty);
  const description = countyMetaDescription(displayCountry, resolvedCounty, towns);
  const keywords = countySeoKeywords(displayCountry, resolvedCounty, towns);

  return {
    title: `${resolvedCounty} Listings in ${displayCountry} | AfricaRentalGrid`,
    description,
    alternates: { canonical: `/main/${country}/${county}` },
    keywords,
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
      title: `${resolvedCounty} Listings in ${displayCountry} | AfricaRentalGrid`,
      description,
      url: `/main/${country}/${county}`,
      type: "website",
      siteName: "AfricaRentalGrid",
      locale: "en_KE"
    },
    twitter: {
      card: "summary_large_image",
      title: `${resolvedCounty} Listings in ${displayCountry} | AfricaRentalGrid`,
      description
    }
  };
}

export default async function CountyPage({ params }: Props) {
  const { country, county } = await params;
  if (!isCountry(country)) notFound();

  const displayCountry = countryDisplayNames[country];

  const counties = await getCountiesForCountry(country);
  const resolvedCounty = counties.find((item) => slugify(item) === county);
  if (!resolvedCounty) notFound();

  const towns = await getTownsForCounty(country, resolvedCounty);
  const description = countyMetaDescription(displayCountry, resolvedCounty, towns);

  const displayCounty = resolvedCounty;

  const targetUrl = filteredUserUrl(displayCountry, displayCounty);

  const schema = {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "WebPage",
        name: `${displayCounty} Listings in ${displayCountry}`,
        description,
        url: `https://www.tst-plotconnect.com/main/${country}/${county}`,
        inLanguage: "en"
      },
      {
        "@type": "ItemList",
        name: `${displayCounty} rentals and plots by town`,
        itemListOrder: "https://schema.org/ItemListOrderAscending",
        numberOfItems: Math.max(towns.length, 1),
        itemListElement:
          towns.length > 0
            ? towns.slice(0, 12).map((town, index) => ({
                "@type": "ListItem",
                position: index + 1,
                name: `${town} listings in ${displayCounty}`,
                url: `https://www.tst-plotconnect.com${filteredUserUrl(displayCountry, displayCounty, town)}`
              }))
            : [
                {
                  "@type": "ListItem",
                  position: 1,
                  name: `Open ${displayCounty} filtered listings`,
                  url: `https://www.tst-plotconnect.com${targetUrl}`
                }
              ]
      }
    ]
  };

  return (
    <main className="container" style={{ padding: "2rem 0 3rem" }}>
      <section className="card" style={{ marginBottom: "1rem" }}>
        <span className="pill">{displayCountry}</span>
        <h1 style={{ margin: "0.75rem 0 0.4rem" }}>{displayCounty} listings and plots</h1>
        <p className="meta" style={{ margin: 0 }}>
          {description}
        </p>
        <div style={{ marginTop: "1rem", display: "flex", gap: "0.7rem", flexWrap: "wrap" }}>
          <Link href={targetUrl} className="btn btn-primary">
            Open Filtered User Listings
          </Link>
          <Link href={`/main/${country}`} className="btn btn-secondary">
            Back to {displayCountry} Counties
          </Link>
        </div>
      </section>

      <section className="card">
        <h2 style={{ marginTop: 0 }}>SEO focus keywords</h2>
        <div className="grid" style={{ gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))" }}>
          {countySeoKeywords(displayCountry, displayCounty, towns).map((keyword) => (
            <div key={keyword} style={{ border: "1px solid #dbe4ee", borderRadius: "12px", padding: "0.6rem 0.7rem" }}>
              {keyword}
            </div>
          ))}
        </div>
      </section>

      {towns.length > 0 && (
        <section className="card" style={{ marginTop: "1rem" }}>
          <h2 style={{ marginTop: 0 }}>Available towns in {displayCounty}</h2>
          <p className="meta" style={{ marginTop: 0 }}>
            Searchers can open any town below and land directly on user listings with county and town filters active.
          </p>
          <div className="grid" style={{ gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))" }}>
            {towns.map((town) => (
              <Link
                key={town}
                href={filteredUserUrl(displayCountry, displayCounty, town)}
                className="btn btn-secondary"
                style={{ justifyContent: "flex-start" }}
              >
                {town} listings
              </Link>
            ))}
          </div>
        </section>
      )}

      <Script id="county-schema" type="application/ld+json" strategy="afterInteractive">
        {JSON.stringify(schema)}
      </Script>
    </main>
  );
}
