import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
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
      title: "County Not Found | tstplotconnect",
      description: "The county page you requested does not exist.",
      robots: { index: false, follow: false }
    };
  }

  const towns = await getTownsForCounty(country, resolvedCounty);
  const description = countyMetaDescription(displayCountry, resolvedCounty, towns);
  const keywords = countySeoKeywords(displayCountry, resolvedCounty, towns);

  return {
    title: `${resolvedCounty} Listings in ${displayCountry} | tstplotconnect`,
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
      title: `${resolvedCounty} Listings in ${displayCountry} | tstplotconnect`,
      description,
      url: `/main/${country}/${county}`,
      type: "website",
      siteName: "tstplotconnect",
      locale: "en_KE"
    },
    twitter: {
      card: "summary_large_image",
      title: `${resolvedCounty} Listings in ${displayCountry} | tstplotconnect`,
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

  redirect(filteredUserUrl(displayCountry, resolvedCounty));
}
