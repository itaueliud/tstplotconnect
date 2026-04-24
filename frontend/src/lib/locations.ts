import { countryDisplayNames, countrySeeds, CountrySlug } from "@/main";

type Plot = {
  id?: string;
  title?: string;
  country?: string;
  county?: string;
  town?: string;
  area?: string;
  category?: string;
  price?: number;
};

const COUNTRY_ALIASES: Record<string, CountrySlug> = {
  kenya: "kenya",
  ke: "kenya",
  uganda: "uganda",
  ug: "uganda",
  tanzania: "tanzania",
  tz: "tanzania"
};

export function slugify(input: string): string {
  return String(input || "")
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, " ")
    .replace(/[\s_-]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");
}

export function titleCase(input: string): string {
  return String(input || "")
    .split(/\s+/)
    .filter(Boolean)
    .map((part) =>
      part
        .split("-")
        .filter(Boolean)
        .map((segment) => segment.charAt(0).toUpperCase() + segment.slice(1).toLowerCase())
        .join("-")
    )
    .join(" ");
}

export function resolveCountrySlug(value: string): CountrySlug | null {
  const normalized = slugify(value).replace(/-/g, "");
  return COUNTRY_ALIASES[normalized] ?? null;
}

export function countryNameFromSlug(slug: CountrySlug): string {
  return countryDisplayNames[slug];
}

export function countyNameFromSlug(slug: string): string {
  return titleCase(String(slug).replace(/-/g, " "));
}

function valueMatches(left: string, right: string): boolean {
  return slugify(left) === slugify(right);
}

function apiBase(): string {
  const envBase =
    process.env.NEXT_PUBLIC_API_URL || process.env.PLOTCONNECT_API_BASE || "";
  return envBase.replace(/\/+$/, "");
}

async function fetchPlots(): Promise<Plot[]> {
  try {
    const res = await fetch(`${apiBase()}/api/plots`, {
      headers: { Accept: "application/json" },
      next: { revalidate: 1800 }
    });

    if (!res.ok) return [];

    const json = await res.json();
    return Array.isArray(json) ? json : [];
  } catch (_error) {
    return [];
  }
}

export async function getCountiesForCountry(country: CountrySlug): Promise<string[]> {
  const plots = await fetchPlots();
  const fromPlots = new Set<string>();

  for (const plot of plots) {
    const resolvedCountry = resolveCountrySlug(String(plot.country || ""));
    if (resolvedCountry !== country) continue;
    const county = String(plot.county || plot.town || "").trim();
    if (!county) continue;
    fromPlots.add(titleCase(county));
  }

  const merged = new Set<string>([...countrySeeds[country], ...fromPlots]);
  return [...merged].sort((a, b) => a.localeCompare(b));
}

export async function getTownsForCounty(country: CountrySlug, county: string): Promise<string[]> {
  const plots = await fetchPlots();
  const towns = new Set<string>();

  for (const plot of plots) {
    const resolvedCountry = resolveCountrySlug(String(plot.country || ""));
    if (resolvedCountry !== country) continue;

    const plotCounty = String(plot.county || plot.town || "").trim();
    if (!plotCounty || !valueMatches(plotCounty, county)) continue;

    const town = String(plot.town || "").trim();
    if (!town) continue;
    if (valueMatches(town, county)) continue;

    towns.add(titleCase(town));
  }

  return [...towns].sort((a, b) => a.localeCompare(b));
}

export async function getCountryCountyPairs(): Promise<Array<{ country: CountrySlug; county: string }>> {
  const countries: CountrySlug[] = ["kenya", "uganda", "tanzania"];
  const pairs: Array<{ country: CountrySlug; county: string }> = [];

  for (const country of countries) {
    const counties = await getCountiesForCountry(country);
    for (const county of counties) {
      pairs.push({ country, county });
    }
  }

  return pairs;
}

export function countyMetaDescription(country: string, county: string, towns: string[] = []): string {
  if (towns.length === 0) {
    return `Find verified plots, hostels, bedsitters, and lodges in ${county}, ${country}. Open filtered listings directly on AfricaRentalGrid.`;
  }

  const preview = towns.slice(0, 4).join(", ");
  const suffix = towns.length > 4 ? ` and ${towns.length - 4} more towns` : "";
  return `Find verified plots, hostels, bedsitters, and lodges in ${county}, ${country}, including ${preview}${suffix}. Open filtered listings directly on AfricaRentalGrid.`;
}

export function countySeoKeywords(country: string, county: string, towns: string[] = []): string[] {
  const countryLower = country.toLowerCase();
  const countyLower = county.toLowerCase();
  const townKeywords = towns.slice(0, 8).flatMap((town) => {
    const townLower = town.toLowerCase();
    return [`${townLower} rentals`, `${townLower} hostels`, `${townLower} plots`];
  });

  return Array.from(new Set([
    `${countyLower} plots`,
    `${countyLower} rentals`,
    `${countyLower} hostels`,
    `${countyLower} bedsitters`,
    `${countyLower} lodges`,
    `verified listings ${countyLower}`,
    `affordable housing ${countyLower}`,
    `property search ${countryLower}`,
    `AfricaRentalGrid ${countyLower}`,
    `AfricaRentalGrid ${countryLower}`,
    ...townKeywords
  ]));
}
