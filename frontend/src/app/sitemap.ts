import type { MetadataRoute } from "next";
import { siteUrl } from "@/lib/site";
import { getCountryCountyPairs, slugify } from "@/lib/locations";

const countries = ["kenya", "uganda", "tanzania"] as const;

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

  const deduped = new Map<string, MetadataRoute.Sitemap[number]>();
  [...staticEntries, ...countryEntries, ...countyEntries].forEach((entry) => {
    deduped.set(entry.url, entry);
  });

  return [...deduped.values()];
}
