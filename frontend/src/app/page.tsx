import Link from "next/link";
import { countryDisplayNames, type CountrySlug } from "@/main";
import { getCountiesForCountry, slugify } from "@/lib/locations";

const COUNTRIES: CountrySlug[] = ["kenya", "uganda", "tanzania"];
const FEATURED_COUNTRIES = [
  { country: "kenya", headline: "Kenya's rental pulse", blurb: "Nairobi, Mombasa, Kiambu, Machakos, Kisumu and more." },
  { country: "uganda", headline: "Uganda's fast-moving listings", blurb: "Kampala, Wakiso, Jinja, Mukono and growth corridors." },
  { country: "tanzania", headline: "Tanzania's property corridors", blurb: "Dar es Salaam, Arusha, Dodoma, Mwanza and beyond." }
] as const;

const QUICK_CHIPS = [
  { country: "kenya", county: "Nairobi", label: "Nairobi hostels" },
  { country: "kenya", county: "Machakos", label: "Machakos bedsitters" },
  { country: "kenya", county: "Mombasa", label: "Mombasa lodges" },
  { country: "uganda", county: "Kampala", label: "Kampala rentals" },
  { country: "uganda", county: "Wakiso", label: "Wakiso rooms" },
  { country: "tanzania", county: "Dar es Salaam", label: "Dar es Salaam apartments" }
] as const;

function searchUrl(country: string, county: string, town?: string): string {
  const params = new URLSearchParams({ country, county });
  if (town) params.set("town", town);
  return `/user?${params.toString()}`;
}

export default async function HomePage() {
  const countyCounts = await Promise.all(COUNTRIES.map((country) => getCountiesForCountry(country)));

  return (
    <main className="market-shell" style={{ padding: "1rem 0 3rem" }}>
      <div className="container">
        <header className="dashboard-topbar" style={{ marginTop: 0 }}>
          <div className="brand">
            <span className="pill" style={{ background: "rgba(255,255,255,0.12)", color: "#fff", borderColor: "rgba(255,255,255,0.1)" }}>
              AfricaRentalGrid
            </span>
            <strong>Airbnb-level discovery, Booking.com clarity, Jiji speed</strong>
          </div>
          <div className="chip-row" style={{ color: "#fff" }}>
            <Link href="/main" className="hero-badge" style={{ background: "rgba(255,255,255,0.08)", color: "#fff" }}>
              Browse counties
            </Link>
            <Link href="/user" className="hero-badge" style={{ background: "rgba(255,255,255,0.08)", color: "#fff" }}>
              Search listings
            </Link>
          </div>
        </header>

        <section className="hero-grid" style={{ marginTop: "1rem" }}>
          <div className="hero-panel">
            <div className="hero-copy">
              <span className="pill" style={{ width: "fit-content" }}>Trusted housing marketplace for East Africa</span>
              <h1 className="hero-title">Find housing with the ease of Booking.com and the local reach of Jiji.</h1>
              <p className="hero-subtitle">
                Search verified plots, hostels, bedsitters, lodges, apartments, and rooms across Kenya, Uganda, and Tanzania.
                Open county pages for SEO, then jump straight into filtered listings by county or town.
              </p>
              <div className="hero-badges">
                <span className="hero-badge">Verified listings</span>
                <span className="hero-badge">County-first discovery</span>
                <span className="hero-badge">Town filters active</span>
                <span className="hero-badge">Fast mobile search</span>
              </div>
            </div>

            <div className="hero-metrics" style={{ marginTop: "1rem" }}>
              <div className="metric-card">
                <strong>3 countries</strong>
                <span>Kenya, Uganda, Tanzania</span>
              </div>
              <div className="metric-card">
                <strong>{countyCounts.reduce((sum, list) => sum + list.length, 0)}+</strong>
                <span>SEO county pages</span>
              </div>
              <div className="metric-card">
                <strong>Live filters</strong>
                <span>County and town deep links</span>
              </div>
              <div className="metric-card">
                <strong>24/7</strong>
                <span>Searchable marketplace access</span>
              </div>
            </div>
          </div>

          <form className="search-panel" action="/user" method="GET">
            <div>
              <span className="section-kicker" style={{ color: "#0f766e", marginBottom: 0 }}>Quick Search</span>
              <h2>Search like a marketplace, land on a filtered listings page</h2>
            </div>

            <div className="search-grid">
              <label className="search-field">
                <span>Country</span>
                <select name="country" defaultValue="Kenya">
                  <option>Kenya</option>
                  <option>Uganda</option>
                  <option>Tanzania</option>
                </select>
              </label>
              <label className="search-field">
                <span>County</span>
                <input name="county" placeholder="e.g. Nairobi" />
              </label>
              <label className="search-field">
                <span>Town / Area</span>
                <input name="town" placeholder="e.g. Kasarani" />
              </label>
              <label className="search-field">
                <span>Category Hint</span>
                <input placeholder="Bedsitter, hostel, lodge..." readOnly value="Use county and town filters" />
              </label>
            </div>

            <button className="btn btn-primary" type="submit" style={{ width: "100%", padding: "0.95rem 1rem" }}>
              Search listings
            </button>

            <div className="trust-strip">
              <span className="trust-pill">No cluttered popups</span>
              <span className="trust-pill">Mobile-first browsing</span>
              <span className="trust-pill">SEO-safe county routing</span>
            </div>
          </form>
        </section>

        <section style={{ marginTop: "1.25rem" }}>
          <p className="section-kicker">Browse by market</p>
          <h2 className="section-title" style={{ color: "#fff" }}>Three country storefront, one fast experience</h2>
          <p className="section-lead" style={{ maxWidth: 760 }}>
            Airbnb-style presentation for browsing, Booking.com-style confidence for decision making, and Jiji-style speed for local discovery.
          </p>
          <div className="market-grid" style={{ marginTop: "1rem" }}>
            {FEATURED_COUNTRIES.map((item, index) => (
              <Link key={item.country} href={`/main/${item.country}`} className="market-card">
                <div className="market-swatch" />
                <div>
                  <span className="market-pill">{countryDisplayNames[item.country]}</span>
                  <h3 style={{ marginTop: "0.65rem" }}>{item.headline}</h3>
                  <p style={{ marginTop: "0.35rem" }}>{item.blurb}</p>
                  <div className="count-badge">{countyCounts[index].length} county pages ready</div>
                </div>
              </Link>
            ))}
          </div>
        </section>

        <section style={{ marginTop: "1.5rem" }}>
          <p className="section-kicker">Popular searches</p>
          <div className="chip-row">
            {QUICK_CHIPS.map((item) => (
              <Link key={item.label} href={searchUrl(countryDisplayNames[item.country], item.county)} className="chip">
                {item.label}
              </Link>
            ))}
          </div>
        </section>

        <section style={{ marginTop: "1.5rem" }}>
          <p className="section-kicker">Why it works</p>
          <h2 className="section-title" style={{ color: "#fff" }}>A polished marketplace flow from search to shortlist</h2>
          <div className="feature-grid" style={{ marginTop: "1rem" }}>
            <article className="feature-card">
              <h3>Airbnb-style visual browsing</h3>
              <p>Large, calm hero surfaces, strong imagery blocks, and quick category discovery for a premium first impression.</p>
            </article>
            <article className="feature-card">
              <h3>Booking.com-style confidence</h3>
              <p>Clear trust cues, verified labeling, and county-first route structure that makes users feel they are in control.</p>
            </article>
            <article className="feature-card">
              <h3>Jiji-style local speed</h3>
              <p>Fast search, simple filters, and direct county or town links that take users immediately into relevant listings.</p>
            </article>
            <article className="feature-card">
              <h3>SEO-first county routing</h3>
              <p>Every county page carries metadata, schema, and canonical links so the live site stays discoverable and organized.</p>
            </article>
          </div>
        </section>

        <section style={{ marginTop: "1.5rem" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "end", gap: "1rem", flexWrap: "wrap" }}>
            <div>
              <p className="section-kicker">Featured counties</p>
              <h2 className="section-title" style={{ color: "#fff" }}>Shortlist the places people search for most</h2>
            </div>
            <Link href="/main" className="btn btn-secondary">
              View all countries
            </Link>
          </div>

          <div className="county-grid" style={{ marginTop: "1rem" }}>
            {[
              { country: "kenya", county: "Nairobi", note: "High-intent city search" },
              { country: "kenya", county: "Machakos", note: "Fast-growing rental demand" },
              { country: "kenya", county: "Mombasa", note: "Coastal stays and rooms" },
              { country: "uganda", county: "Kampala", note: "Busy commuter housing" },
              { country: "tanzania", county: "Dar es Salaam", note: "Major urban rental market" },
              { country: "tanzania", county: "Arusha", note: "Tourism and residential mix" }
            ].map((item) => (
              <Link key={`${item.country}-${item.county}`} href={`/main/${item.country}/${slugify(item.county)}`} className="county-card">
                <div className="county-image" />
                <div className="county-copy">
                  <span className="pill">{countryDisplayNames[item.country as CountrySlug]}</span>
                  <h3 style={{ marginTop: "0.6rem" }}>{item.county}</h3>
                  <p style={{ marginTop: "0.35rem" }}>{item.note}</p>
                </div>
              </Link>
            ))}
          </div>
        </section>

        <section className="grid" style={{ gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))", marginTop: "1.5rem" }}>
          <div className="card" style={{ background: "rgba(255,255,255,0.94)" }}>
            <p className="section-kicker" style={{ color: "#0f766e" }}>For seekers</p>
            <h3 style={{ marginTop: 0 }}>Browse, compare, and open filtered results without friction.</h3>
            <p className="meta">Use county and town search to get straight to the listings that matter most.</p>
          </div>
          <div className="card" style={{ background: "rgba(255,255,255,0.94)" }}>
            <p className="section-kicker" style={{ color: "#0f766e" }}>For hosts</p>
            <h3 style={{ marginTop: 0 }}>Publish properties into a clean marketplace with strong local discovery.</h3>
            <p className="meta">County and town pages are structured for visibility, trust, and high-intent clicks.</p>
          </div>
          <div className="card" style={{ background: "rgba(255,255,255,0.94)" }}>
            <p className="section-kicker" style={{ color: "#0f766e" }}>For admins</p>
            <h3 style={{ marginTop: 0 }}>Manage listings and location metadata with a clear dashboard workflow.</h3>
            <p className="meta">Switch into admin and superadmin portals for operational control.</p>
          </div>
        </section>
      </div>
    </main>
  );
}
