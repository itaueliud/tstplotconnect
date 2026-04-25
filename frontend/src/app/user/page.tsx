import type { Metadata } from "next";
import UserPortal from "./user-portal";

type Props = {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

function pick(value: string | string[] | undefined): string {
  if (Array.isArray(value)) return value[0] || "";
  return value || "";
}

export async function generateMetadata({ searchParams }: Props): Promise<Metadata> {
  const params = await searchParams;
  const country = pick(params.country);
  const county = pick(params.county);
  const town = pick(params.town);

  const place = [town || county, country].filter(Boolean).join(", ");
  const title = place ? `${place} User Listings | AfricaRentalGrid` : "User Listings | AfricaRentalGrid";
  const description = place
    ? `Open user listing results filtered for ${place}, including plots, hostels, bedsitters, and lodges.`
    : "Open user listing results with country, county, town, and category filters for plots, hostels, bedsitters, and lodges.";

  return {
    title,
    description,
    alternates: { canonical: "/user" }
  };
}

export default async function UserPage({ searchParams }: Props) {
  const params = await searchParams;
  const country = pick(params.country);
  const county = pick(params.county);
  const town = pick(params.town);
  const category = pick(params.category);

  return <UserPortal initialCountry={country} initialCounty={county} initialTown={town} initialCategory={category} />;
}
