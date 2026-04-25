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
    <main className="container directory-shell" style={{ padding: "2rem 0 3rem" }}>
      <section className="directory-header">
        <span className="pill">{displayCountry}</span>
        <h1>{displayCountry} county index</h1>
        <p className="meta" style={{ margin: 0 }}>
          Lightweight SEO route directory for {displayCountry}. Use any county link below, or skip directly into the live listings page.
        </p>
        <div className="directory-actions">
          <Link href="/user" className="btn btn-primary">Open Listings Dashboard</Link>
        </div>
      </section>

      <section className="directory-links">
        {counties.map((county) => (
          <Link
            key={county}
            href={`/main/${country}/${slugify(county)}`}
            className="directory-link"
          >
            <strong>{county}</strong>
            <span>Open county landing page</span>
          </Link>
        ))}
      </section>
    </main>
  );
}
