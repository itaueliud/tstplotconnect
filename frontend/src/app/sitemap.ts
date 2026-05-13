import type { MetadataRoute } from "next";
import { promises as fs } from "fs";
import path from "path";
import { siteUrl } from "@/lib/site";
import { getCountryCountyPairs, slugify } from "@/lib/locations";

type ListingManifestEntry = {
  path?: string;
  lastmod?: string;
  changefreq?: MetadataRoute.Sitemap[number]["changeFrequency"];
  priority?: number;
};

const countries = ["kenya", "uganda", "tanzania"] as const;

function toDate(value?: string): Date {
  if (!value) return new Date();
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? new Date() : date;
}

async function readListingEntries(): Promise<MetadataRoute.Sitemap> {
  try {
    const manifestPath = path.join(process.cwd(), "public", "listings", "manifest.json");
    const raw = await fs.readFile(manifestPath, "utf8");
    const parsed = JSON.parse(raw) as { entries?: ListingManifestEntry[] };
    const entries = Array.isArray(parsed.entries) ? parsed.entries : [];

    return entries
      .filter((entry) => Boolean(entry.path))
      .map((entry) => ({
        url: `${siteUrl}${entry.path}`,
        lastModified: toDate(entry.lastmod),
        changeFrequency: entry.changefreq || "daily",
        priority: typeof entry.priority === "number" ? entry.priority : 0.6
      }));
  } catch {
    return [];
  }
}

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const now = new Date();

  const staticEntries: MetadataRoute.Sitemap = [
    { url: `${siteUrl}/`, lastModified: now, changeFrequency: "weekly", priority: 1.0 },
    { url: `${siteUrl}/user`, lastModified: now, changeFrequency: "weekly", priority: 0.95 },
    { url: `${siteUrl}/about`, lastModified: now, changeFrequency: "monthly", priority: 0.8 },
    { url: `${siteUrl}/contact`, lastModified: now, changeFrequency: "monthly", priority: 0.8 },
    { url: `${siteUrl}/privacy`, lastModified: now, changeFrequency: "monthly", priority: 0.6 },
    { url: `${siteUrl}/main/kenya`, lastModified: now, changeFrequency: "weekly", priority: 0.9 },
    { url: `${siteUrl}/main/uganda`, lastModified: now, changeFrequency: "weekly", priority: 0.9 },
    { url: `${siteUrl}/main/tanzania`, lastModified: now, changeFrequency: "weekly", priority: 0.9 }
  ];

  const countryEntries: MetadataRoute.Sitemap = countries.map((country) => ({
    url: `${siteUrl}/main/${country}`,
    lastModified: now,
    changeFrequency: "weekly",
    priority: 0.9
  }));

  const countyPairs = await getCountryCountyPairs();
  const countyEntries: MetadataRoute.Sitemap = countyPairs.map((pair) => ({
    url: `${siteUrl}/main/${pair.country}/${slugify(pair.county)}`,
    lastModified: now,
    changeFrequency: "weekly",
    priority: 0.85
  }));

  const listingEntries = await readListingEntries();

  const deduped = new Map<string, MetadataRoute.Sitemap[number]>();
  [...staticEntries, ...countryEntries, ...countyEntries, ...listingEntries].forEach((entry) => {
    deduped.set(entry.url, entry);
  });

  return [...deduped.values()];
}
