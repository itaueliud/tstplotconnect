import Link from "next/link";
import { countryDisplayNames, CountrySlug } from "@/main";
import { getCountiesForCountry } from "@/lib/locations";

export const revalidate = 1800;

export default async function MainPage() {
  const countries: CountrySlug[] = ["kenya", "uganda", "tanzania"];
  const counts = await Promise.all(countries.map((country) => getCountiesForCountry(country)));

  return (
    <main className="container directory-shell" style={{ padding: "2rem 0 3rem" }}>
      <section className="directory-header">
        <span className="pill">Location directory</span>
        <h1>Country index for search engines and deep links.</h1>
        <p className="meta" style={{ margin: 0 }}>
          This page exists for structured location discovery. Most visitors should go straight to the listings dashboard.
        </p>
        <div className="directory-actions">
          <Link href="/user" className="btn btn-primary">Open Listings Dashboard</Link>
        </div>
      </section>

      <section className="directory-country-grid">
        {countries.map((country, index) => (
          <Link key={country} href={`/main/${country}`} className="directory-country-card">
            <span className="pill">{countryDisplayNames[country]}</span>
            <h2>{countryDisplayNames[country]}</h2>
            <p>{counts[index].length} counties available as SEO landing routes.</p>
          </Link>
        ))}
      </section>
    </main>
  );
}
