import Link from "next/link";
import { countryDisplayNames, CountrySlug } from "@/main";
import { getCountiesForCountry } from "@/lib/locations";

export const revalidate = 1800;

export default async function MainPage() {
  const countries: CountrySlug[] = ["kenya", "uganda", "tanzania"];
  const counts = await Promise.all(countries.map((country) => getCountiesForCountry(country)));

  return (
    <main className="container" style={{ padding: "2rem 0 3rem" }}>
      <section className="card" style={{ marginBottom: "1rem" }}>
        <span className="pill">Main</span>
        <h1 style={{ margin: "0.75rem 0 0.35rem" }}>Choose a country</h1>
        <p className="meta" style={{ margin: 0 }}>
          Each country page contains SEO-optimized county pages. Clicking a county opens filtered listings for that county.
        </p>
      </section>

      <section className="grid" style={{ gridTemplateColumns: "repeat(auto-fit, minmax(230px, 1fr))" }}>
        {countries.map((country, index) => (
          <Link key={country} href={`/main/${country}`} className="card" style={{ display: "block" }}>
            <span className="pill">{countryDisplayNames[country]}</span>
            <h2 style={{ margin: "0.7rem 0 0.25rem" }}>{countryDisplayNames[country]}</h2>
            <p className="meta" style={{ margin: 0 }}>
              {counts[index].length} county pages ready for SEO and filtered user listing routes.
            </p>
          </Link>
        ))}
      </section>
    </main>
  );
}
