import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { countryDisplayNames, CountrySlug } from "@/main";

type Props = { params: Promise<{ country: string }> };

const countryList: CountrySlug[] = ["kenya", "uganda", "tanzania"];

function isCountry(value: string): value is CountrySlug {
  return countryList.includes(value as CountrySlug);
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { country } = await params;
  if (!isCountry(country)) return {};

  const name = countryDisplayNames[country];
  const seoCountyMap: Record<CountrySlug, string[]> = {
    kenya: ["Machakos", "Nairobi", "Kitui", "Kajiado", "Kakamega", "Makueni", "Mombasa"],
    uganda: ["Kampala", "Wakiso", "Mukono", "Jinja", "Mbarara"],
    tanzania: ["Dar es Salaam", "Arusha", "Mwanza", "Dodoma", "Mbeya"]
  };
  const countyList = seoCountyMap[country];
  const countySummary = countyList.join(", ");

  return {
    title: `${name} Counties | tstplotconnect`,
    description: `Browse SEO-optimized county landing pages for ${name}: ${countySummary}. Open filtered listings instantly on tstplotconnect.`,
    alternates: { canonical: `/main/${country}` },
    keywords: [
      `${name} counties`,
      `${name} rentals`,
      `${name} plots`,
      `tstplotconnect ${name}`,
      ...countyList.map((countyName) => `${countyName} ${name} listings`),
      ...countyList.map((countyName) => `${countyName} rentals`)
    ],
    openGraph: {
      title: `${name} Counties | tstplotconnect`,
      description: `Explore county-level listings in ${name}: ${countySummary}.`,
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

  const displayCountry = countryDisplayNames[country];
  const qp = new URLSearchParams({ country: displayCountry });
  redirect(`/user?${qp.toString()}`);
}
