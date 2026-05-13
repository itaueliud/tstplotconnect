import type { MetadataRoute } from "next";
import { siteUrl } from "@/lib/site";
import { getCountryCountyPairs, slugify } from "@/lib/locations";

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const now = new Date();
  const countyPairs = await getCountryCountyPairs();

  const base: MetadataRoute.Sitemap = [
    { url: `${siteUrl}/`, lastModified: now, changeFrequency: "weekly", priority: 1.0 },
    { url: `${siteUrl}/user`, lastModified: now, changeFrequency: "weekly", priority: 0.95 },
    { url: `${siteUrl}/about`, lastModified: now, changeFrequency: "monthly", priority: 0.8 },
    { url: `${siteUrl}/contact`, lastModified: now, changeFrequency: "monthly", priority: 0.8 },
    { url: `${siteUrl}/privacy`, lastModified: now, changeFrequency: "monthly", priority: 0.6 },
    { url: `${siteUrl}/main/kenya`, lastModified: now, changeFrequency: "weekly", priority: 0.9 },
    { url: `${siteUrl}/main/uganda`, lastModified: now, changeFrequency: "weekly", priority: 0.9 },
    { url: `${siteUrl}/main/tanzania`, lastModified: now, changeFrequency: "weekly", priority: 0.9 }
  ];

  const counties: MetadataRoute.Sitemap = countyPairs.map((pair) => ({
    url: `${siteUrl}/main/${pair.country}/${slugify(pair.county)}`,
    lastModified: now,
    changeFrequency: "weekly",
    priority: 0.85
  }));

  const deduped = new Map<string, MetadataRoute.Sitemap[number]>();
  [...base, ...counties].forEach((entry) => deduped.set(entry.url, entry));
  return [...deduped.values()];
}
