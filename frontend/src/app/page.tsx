import Link from "next/link";

const FEATURED_PLACES = [
  { country: "Kenya", county: "Nairobi", town: "Kasarani", label: "Nairobi hostels" },
  { country: "Kenya", county: "Machakos", town: "Matuu", label: "Machakos lodges" },
  { country: "Kenya", county: "Mombasa", town: "Nyali", label: "Mombasa apartments" },
  { country: "Uganda", county: "Kampala", town: "Ntinda", label: "Kampala rentals" },
  { country: "Uganda", county: "Wakiso", town: "Entebbe", label: "Wakiso rooms" },
  { country: "Tanzania", county: "Dar es Salaam", town: "Mikocheni", label: "Dar es Salaam stays" }
] as const;

const CATEGORY_PRESETS = [
  "Rental Houses",
  "Bedsitters",
  "Hostels",
  "Apartments",
  "Lodges",
  "AirBnB"
] as const;

function searchUrl(country: string, county: string, town?: string, category?: string): string {
  const params = new URLSearchParams();
  if (country) params.set("country", country);
  if (county) params.set("county", county);
  if (town) params.set("town", town);
  if (category) params.set("category", category);
  return `/user?${params.toString()}`;
}

export default function HomePage() {
  return (
    <main className="market-shell" style={{ padding: "1rem 0 3rem" }}>
      <div className="container">
        <section className="hero-grid hero-grid-market" style={{ marginTop: "1rem" }}>
          <div className="hero-panel hero-panel-market">
            <div className="hero-copy">
              <span className="pill" style={{ width: "fit-content" }}>Verified listings across East Africa</span>
              <h1 className="hero-title hero-title-market">Find hostels, lodges, apartments, bedsitters, and plots fast.</h1>
              <p className="hero-subtitle">
                Search by country, county, town, and category, then open a cleaner listings dashboard with real images,
                prices, and backend-powered results.
              </p>
              <div className="hero-badges hero-badges-market">
                {CATEGORY_PRESETS.map((category) => (
                  <Link key={category} href={searchUrl("Kenya", "", "", category)} className="hero-badge hero-badge-soft">
                    {category}
                  </Link>
                ))}
              </div>
            </div>

            <div className="hero-metrics hero-metrics-market" style={{ marginTop: "1rem" }}>
              <div className="metric-card">
                <strong>Images first</strong>
                <span>Listings cards with photos and categories</span>
              </div>
              <div className="metric-card">
                <strong>Direct filters</strong>
                <span>Country, county, town, area, and price</span>
              </div>
              <div className="metric-card">
                <strong>Backend live</strong>
                <span>Listings load from your API, not mock cards</span>
              </div>
              <div className="metric-card">
                <strong>SEO hidden</strong>
                <span>County routes stay useful without taking over</span>
              </div>
            </div>
          </div>

          <form className="search-panel" action="/user" method="GET">
            <div>
              <span className="section-kicker" style={{ color: "#0f766e", marginBottom: 0 }}>Quick Search</span>
              <h2>Start with location, then refine inside the listings dashboard</h2>
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
                <span>Category</span>
                <select name="category" defaultValue="">
                  <option value="">All categories</option>
                  {CATEGORY_PRESETS.map((category) => (
                    <option key={category} value={category}>
                      {category}
                    </option>
                  ))}
                </select>
              </label>
            </div>

            <button className="btn btn-primary" type="submit" style={{ width: "100%", padding: "0.95rem 1rem" }}>
              Search listings
            </button>

            <div className="trust-strip">
              <span className="trust-pill">Images and prices visible</span>
              <span className="trust-pill">Useful category filters</span>
              <span className="trust-pill">SEO routes stay in the background</span>
            </div>
          </form>
        </section>

        <section style={{ marginTop: "1.25rem" }}>
          <p className="section-kicker">Popular Searches</p>
          <h2 className="section-title" style={{ color: "#fff" }}>Jump straight into active locations</h2>
          <p className="section-lead" style={{ maxWidth: 760 }}>
            These links open the real listings view directly, with country, county, town, and category hints already filled in.
          </p>
          <div className="quick-link-grid" style={{ marginTop: "1rem" }}>
            {FEATURED_PLACES.map((item) => (
              <Link
                key={`${item.country}-${item.county}-${item.town}`}
                href={searchUrl(item.country, item.county, item.town)}
                className="quick-link-card"
              >
                <span className="market-pill">{item.country}</span>
                <h3>{item.label}</h3>
                <p>{item.county}{item.town ? `, ${item.town}` : ""}</p>
              </Link>
            ))}
          </div>
        </section>

        <section style={{ marginTop: "1.5rem" }}>
          <p className="section-kicker">Browse By Category</p>
          <div className="chip-row">
            {CATEGORY_PRESETS.map((category) => (
              <Link key={category} href={searchUrl("Kenya", "", "", category)} className="chip">
                {category}
              </Link>
            ))}
          </div>
        </section>

        <section style={{ marginTop: "1.5rem" }}>
          <p className="section-kicker">How To Browse</p>
          <h2 className="section-title" style={{ color: "#fff" }}>Use the marketplace, not the SEO pages</h2>
          <div className="feature-grid" style={{ marginTop: "1rem" }}>
            <article className="feature-card">
              <h3>Search first</h3>
              <p>Start from the quick search form and land inside the full listings dashboard with live filters.</p>
            </article>
            <article className="feature-card">
              <h3>See real listings</h3>
              <p>Browse cards with plot images, clear categories, prices, and location details pulled from the backend.</p>
            </article>
            <article className="feature-card">
              <h3>Refine fast</h3>
              <p>Use category, county, area, and price controls without leaving the listings view.</p>
            </article>
            <article className="feature-card">
              <h3>Keep SEO quiet</h3>
              <p>The country and county pages still help indexing, but they no longer need to dominate the visual journey.</p>
            </article>
          </div>
        </section>

        <section className="grid" style={{ gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))", marginTop: "1.5rem" }}>
          <div className="card" style={{ background: "rgba(255,255,255,0.94)" }}>
            <p className="section-kicker" style={{ color: "#0f766e" }}>Listings</p>
            <h3 style={{ marginTop: 0 }}>Open the real dashboard experience.</h3>
            <p className="meta">The `/user` page is now the main search and browsing surface.</p>
          </div>
          <div className="card" style={{ background: "rgba(255,255,255,0.94)" }}>
            <p className="section-kicker" style={{ color: "#0f766e" }}>SEO</p>
            <h3 style={{ marginTop: 0 }}>County routes still exist quietly in the background.</h3>
            <p className="meta">Use them for indexing and deep links, not as the primary browsing UI.</p>
          </div>
          <div className="card" style={{ background: "rgba(255,255,255,0.94)" }}>
            <p className="section-kicker" style={{ color: "#0f766e" }}>Directory</p>
            <h3 style={{ marginTop: 0 }}>Need the location index?</h3>
            <p className="meta">
              <Link href="/main" style={{ color: "#0f766e", fontWeight: 700 }}>Open the country directory</Link> when you need the SEO location structure.
            </p>
          </div>
        </section>
      </div>
    </main>
  );
}
