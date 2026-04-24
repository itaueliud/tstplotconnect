import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { countryDisplayNames, CountrySlug } from "@/main";
import { getCountiesForCountry, slugify } from "@/lib/locations";

type Props = { params: Promise<{ country: string }> };

const countryList: CountrySlug[] = ["kenya", "uganda", "tanzania"];

function isCountry(value: string): value is CountrySlug {
  return countryList.includes(value as CountrySlug);
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { country } = await params;
  if (!isCountry(country)) return {};

  const name = countryDisplayNames[country];

  return {
    title: `${name} Counties | AfricaRentalGrid`,
    description: `Browse SEO-optimized county landing pages for ${name} and open filtered listings instantly on AfricaRentalGrid.`,
    alternates: { canonical: `/main/${country}` },
    keywords: [`${name} counties`, `${name} rentals`, `${name} plots`, `AfricaRentalGrid ${name}`],
    openGraph: {
      title: `${name} Counties | AfricaRentalGrid`,
      description: `Explore county-level listings in ${name}.`,
      url: `/main/${country}`
    }
  };
}

export async function generateStaticParams() {
  return countryList.map((country) => ({ country }));
}

export default async function CountryPage({ params }: Props) {
  const { country } = await params;

  if (!isCountry(country)) {
    notFound();
  }

  const counties = await getCountiesForCountry(country);
  const displayCountry = countryDisplayNames[country];

  return (
    <main className="container" style={{ padding: "2rem 0 3rem" }}>
      <section className="card" style={{ marginBottom: "1rem" }}>
        <span className="pill">{displayCountry}</span>
        <h1 style={{ margin: "0.75rem 0 0.3rem" }}>{displayCountry} county pages</h1>
        <p className="meta" style={{ margin: 0 }}>
          Select any county to open a fully optimized county page with direct route into filtered user listings.
        </p>
      </section>

      <section className="grid" style={{ gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))" }}>
        {counties.map((county) => (
          <Link
            key={county}
            href={`/main/${country}/${slugify(county)}`}
            className="card"
            style={{ display: "block", padding: "0.9rem" }}
          >
            <h2 style={{ margin: "0 0 0.25rem", fontSize: "1.05rem" }}>{county}</h2>
            <p className="meta" style={{ margin: 0 }}>
              Open SEO page and jump to filtered listings in {county}, {displayCountry}.
            </p>
          </Link>
        ))}
      </section>
    </main>
  );
}
