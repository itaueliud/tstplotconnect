"use client";

import { useEffect, useMemo, useState } from "react";
import { getApiBase } from "@/lib/api";

type Plot = {
  id?: string;
  title?: string;
  country?: string;
  county?: string;
  town?: string;
  area?: string;
  category?: string;
  price?: number;
  images?: string[];
  description?: string;
};

type Props = {
  country: string;
  county: string;
};

function sameValue(left: string, right: string): boolean {
  return left.trim().toLowerCase() === right.trim().toLowerCase();
}

export default function UserResults({ country, county }: Props) {
  const [plots, setPlots] = useState<Plot[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    let active = true;

    async function run() {
      setLoading(true);
      setError("");
      try {
        const res = await fetch(`${getApiBase()}/api/plots`, { headers: { Accept: "application/json" } });
        if (!res.ok) throw new Error(`Unable to load plots (${res.status})`);
        const json = await res.json();
        if (!active) return;
        setPlots(Array.isArray(json) ? json : []);
      } catch (err) {
        if (!active) return;
        setError(err instanceof Error ? err.message : "Unable to reach the server.");
      } finally {
        if (active) setLoading(false);
      }
    }

    run();

    return () => {
      active = false;
    };
  }, []);

  const filtered = useMemo(() => {
    return plots.filter((plot) => {
      const plotCountry = String(plot.country || "");
      const plotCounty = String(plot.county || plot.town || "");
      const countryOk = country ? sameValue(plotCountry, country) : true;
      const countyOk = county ? sameValue(plotCounty, county) : true;
      return countryOk && countyOk;
    });
  }, [plots, country, county]);

  return (
    <section className="card">
      <h1 style={{ margin: "0 0 0.35rem" }}>User Listings</h1>
      <p className="meta" style={{ marginTop: 0 }}>
        Filtered to: <strong>{country || "All Countries"}</strong> / <strong>{county || "All Counties"}</strong>
      </p>

      {loading && <p className="meta">Loading listings...</p>}
      {error && <p style={{ color: "#b91c1c" }}>{error}</p>}

      {!loading && !error && filtered.length === 0 && (
        <p className="meta">No listings found for this filter. Try another county or return to main pages.</p>
      )}

      {!loading && !error && filtered.length > 0 && (
        <div className="grid" style={{ gridTemplateColumns: "repeat(auto-fit, minmax(250px, 1fr))" }}>
          {filtered.map((plot) => (
            <article key={plot.id || `${plot.title}-${plot.area}`} style={{ border: "1px solid #dbe4ee", borderRadius: "14px", padding: "0.75rem" }}>
              <h2 style={{ margin: "0 0 0.4rem", fontSize: "1rem" }}>{plot.title || "Listing"}</h2>
              <p className="meta" style={{ margin: "0 0 0.35rem" }}>
                {plot.county || plot.town || county}, {plot.area || "Area not provided"}
              </p>
              <p className="meta" style={{ margin: "0 0 0.35rem" }}>
                {plot.category || "Property"} {typeof plot.price === "number" ? `- KES ${plot.price.toLocaleString()}` : "- Price on request"}
              </p>
              <p className="meta" style={{ margin: 0 }}>{plot.description || "Verified listing on AfricaRentalGrid."}</p>
            </article>
          ))}
        </div>
      )}
    </section>
  );
}
