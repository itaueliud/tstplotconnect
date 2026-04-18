(function () {
  const cfg = window.CITY_PAGE_CONFIG || {};
  const API_BASE_URL = /^(localhost|127\.0\.0\.1|192\.168\.\d{1,3}\.\d{1,3}|10\.\d{1,3}\.\d{1,3}\.\d{1,3}|172\.(1[6-9]|2\d|3[0-1])\.\d{1,3}\.\d{1,3})$/i.test(window.location.hostname)
    ? `http://${window.location.hostname}:10000`
    : "https://tstplotconnect-2.onrender.com";

  const COUNTY_COORDS = {
    Nairobi: [36.8219, -1.2921],
    Machakos: [37.2634, -1.5177],
    Kiambu: [36.8356, -1.1714],
    Thika: [37.0693, -1.0332],
    Mombasa: [39.6682, -4.0435],
    Kitui: [38.0106, -1.3670],
    Embu: [37.4570, -0.5396]
  };

  const AREA_COORDS = {
    "Machakos|CP": [37.2634, -1.5177],
    "Machakos|Machakos Town Centre": [37.2634, -1.5177],
    "Machakos|Mutituni": [37.2600, -1.5680],
    "Nairobi|Kasarani": [36.8913, -1.2281],
    "Nairobi|South B": [36.8450, -1.3129],
    "Nairobi|Rongai": [36.7417, -1.3933],
    "Kiambu|Thika Road": [36.8460, -1.2150]
  };

  const state = {
    allPlots: [],
    filteredPlots: [],
    filters: {
      area: "",
      category: cfg.category || "",
      minPrice: "",
      maxPrice: ""
    },
    map: null,
    layer: null
  };

  const els = {
    status: document.getElementById("city-status"),
    count: document.getElementById("city-count"),
    listings: document.getElementById("city-listings"),
    area: document.getElementById("city-area-filter"),
    category: document.getElementById("city-type-filter"),
    minPrice: document.getElementById("city-min-price"),
    maxPrice: document.getElementById("city-max-price"),
    map: document.getElementById("city-map"),
    related: document.getElementById("city-related-links"),
    recent: document.getElementById("city-recent-list")
  };

  function escapeHtml(value) {
    return String(value || "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#39;");
  }

  function formatPrice(value) {
    const num = Number(value);
    if (!Number.isFinite(num)) return "Price on request";
    return `Ksh ${num.toLocaleString()}`;
  }

  function listingHref(plot) {
    const params = new URLSearchParams();
    params.set("country", plot.country || cfg.country || "Kenya");
    params.set("county", plot.county || plot.town || cfg.city || "");
    if (plot.area) params.set("area", plot.area);
    if (plot.category) params.set("category", plot.category);
    return `/?${params.toString()}#user-listings`;
  }

  function getCoords(plot, index) {
    const county = String(plot.county || plot.town || cfg.city || "").trim();
    const area = String(plot.area || "").trim();
    const key = `${county}|${area}`;
    const direct = AREA_COORDS[key] || COUNTY_COORDS[county] || COUNTY_COORDS[cfg.city] || [37.9062, -0.0236];
    const offset = ((index % 6) - 2.5) * 0.004;
    return [direct[0] + offset, direct[1] + offset / 2];
  }

  function applyFilters() {
    const minRaw = String(state.filters.minPrice || "").trim();
    const maxRaw = String(state.filters.maxPrice || "").trim();
    const min = minRaw ? Number(minRaw) : null;
    const max = maxRaw ? Number(maxRaw) : null;

    state.filteredPlots = state.allPlots.filter((plot) => {
      if (state.filters.area && String(plot.area || "") !== state.filters.area) return false;
      if (state.filters.category && String(plot.category || "") !== state.filters.category) return false;
      const price = Number(plot.price);
      if (Number.isFinite(min) && Number.isFinite(price) && price < min) return false;
      if (Number.isFinite(max) && Number.isFinite(price) && price > max) return false;
      return true;
    });
  }

  function renderListings() {
    const rows = state.filteredPlots;
    els.count.textContent = `${rows.length} listing${rows.length === 1 ? "" : "s"}`;

    if (!rows.length) {
      els.status.textContent = `No ${String(state.filters.category || cfg.category || "accommodation").toLowerCase()} listings match the current filters in ${cfg.city}.`;
      els.listings.innerHTML = `<div class="city-empty">We are still building out verified listings for this page. Try the main app for nearby options.</div>`;
      renderRecent([]);
      return;
    }

    els.status.textContent = `Verified ${String(cfg.category || "property").toLowerCase()} listings in ${cfg.city} with live pricing and direct listing links.`;
    els.listings.innerHTML = rows.map((plot) => `
      <article class="city-listing-card">
        ${plot.images && plot.images[0]
          ? `<img class="city-listing-media" src="${escapeHtml(plot.images[0])}" alt="${escapeHtml(plot.title || `${cfg.category} in ${cfg.city}`)}">`
          : `<div class="city-listing-media"></div>`}
        <div class="city-listing-body">
          <h3>${escapeHtml(plot.title || `${cfg.category} in ${cfg.city}`)}</h3>
          <div class="city-listing-meta">${escapeHtml([plot.county || plot.town || cfg.city, plot.area || "Location not set"].filter(Boolean).join(" • "))}</div>
          <div class="city-price">${escapeHtml(formatPrice(plot.price))}</div>
          <div class="city-listing-meta">${escapeHtml(plot.description || "Verified listing available on PlotConnect.")}</div>
          <div class="city-listing-actions">
            <a class="primary" href="${listingHref(plot)}">Open Listing</a>
            <a class="secondary" href="/#user-search">Browse More</a>
          </div>
        </div>
      </article>
    `).join("");
    renderRecent(rows.slice(0, 3));
  }

  function renderRecent(rows) {
    if (!els.recent) return;
    if (!rows.length) {
      els.recent.innerHTML = "<p>No recent listings yet for this page.</p>";
      return;
    }
    els.recent.innerHTML = rows.map((plot) => `
      <p><strong>${escapeHtml(plot.title)}</strong> from ${escapeHtml(formatPrice(plot.price))} in ${escapeHtml(plot.area || plot.county || plot.town || cfg.city)}</p>
    `).join("");
  }

  function renderMap() {
    if (!window.L || !els.map) return;
    const center = COUNTY_COORDS[cfg.city] || [37.9062, -0.0236];
    if (!state.map) {
      state.map = window.L.map(els.map).setView([center[1], center[0]], 11);
      window.L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
        maxZoom: 19,
        attribution: "&copy; OpenStreetMap contributors"
      }).addTo(state.map);
      state.layer = window.L.layerGroup().addTo(state.map);
    }

    state.layer.clearLayers();
    const rows = state.filteredPlots.length ? state.filteredPlots : state.allPlots;
    const bounds = [];
    rows.forEach((plot, index) => {
      const [lng, lat] = getCoords(plot, index);
      bounds.push([lat, lng]);
      window.L.marker([lat, lng])
        .bindPopup(`<strong>${escapeHtml(plot.title)}</strong><br>${escapeHtml(plot.area || plot.county || cfg.city)}<br>${escapeHtml(formatPrice(plot.price))}`)
        .addTo(state.layer);
    });

    if (bounds.length) {
      state.map.fitBounds(bounds, { padding: [24, 24] });
    } else {
      state.map.setView([center[1], center[0]], 11);
    }
  }

  function updateFilters() {
    const areas = Array.from(new Set(state.allPlots.map((plot) => String(plot.area || "").trim()).filter(Boolean))).sort((a, b) => a.localeCompare(b));
    const categories = Array.from(new Set(state.allPlots.map((plot) => String(plot.category || "").trim()).filter(Boolean))).sort((a, b) => a.localeCompare(b));

    if (els.area) {
      els.area.innerHTML = `<option value="">All Areas</option>${areas.map((area) => `<option value="${escapeHtml(area)}">${escapeHtml(area)}</option>`).join("")}`;
      els.area.value = state.filters.area;
    }

    if (els.category) {
      const preferred = cfg.category && !categories.includes(cfg.category) ? [cfg.category, ...categories] : categories;
      els.category.innerHTML = `<option value="">All Property Types</option>${preferred.map((category) => `<option value="${escapeHtml(category)}">${escapeHtml(category)}</option>`).join("")}`;
      els.category.value = state.filters.category;
    }
  }

  function attachEvents() {
    if (els.area) {
      els.area.addEventListener("change", (event) => {
        state.filters.area = event.target.value;
        applyFilters();
        renderListings();
        renderMap();
      });
    }

    if (els.category) {
      els.category.addEventListener("change", (event) => {
        state.filters.category = event.target.value;
        applyFilters();
        renderListings();
        renderMap();
      });
    }

    if (els.minPrice) {
      els.minPrice.addEventListener("input", (event) => {
        state.filters.minPrice = event.target.value;
        applyFilters();
        renderListings();
        renderMap();
      });
    }

    if (els.maxPrice) {
      els.maxPrice.addEventListener("input", (event) => {
        state.filters.maxPrice = event.target.value;
        applyFilters();
        renderListings();
        renderMap();
      });
    }
  }

  function renderRelatedLinks() {
    if (!els.related || !Array.isArray(cfg.relatedPages)) return;
    els.related.innerHTML = cfg.relatedPages.map((item) => `<a href="${escapeHtml(item.href)}">${escapeHtml(item.label)}</a>`).join("");
  }

  function renderSchema() {
    const schemaEl = document.getElementById("city-page-schema");
    if (!schemaEl) return;
    const locationLabel = cfg.city || "Location";
    const pageTitle = `${cfg.category || "Accommodation"} in ${locationLabel}`;
    const pageDescription = `Browse ${String(cfg.category || "accommodation").toLowerCase()} options in ${locationLabel} on AfricaRentalGrid.`;
    schemaEl.textContent = JSON.stringify({
      "@context": "https://schema.org",
      "@graph": [
        {
          "@type": "WebPage",
          name: pageTitle,
          description: pageDescription,
          url: `https://www.tst-plotconnect.com${cfg.path || ""}`,
          inLanguage: "en-KE",
          isPartOf: {
            "@type": "WebSite",
            name: "AfricaRentalGrid",
            url: "https://www.tst-plotconnect.com"
          }
        },
        {
          "@type": "LodgingBusiness",
          name: pageTitle,
          address: {
            "@type": "PostalAddress",
            addressLocality: locationLabel,
            addressCountry: cfg.country || "Kenya"
          },
          url: `https://www.tst-plotconnect.com${cfg.path || ""}`
        },
        {
          "@type": "ItemList",
          name: pageTitle,
          description: pageDescription,
          numberOfItems: state.filteredPlots.length
        }
      ]
    });
  }

  async function init() {
    renderRelatedLinks();
    attachEvents();
    try {
      const url = `${API_BASE_URL}/api/plots?country=${encodeURIComponent(cfg.country || "Kenya")}&county=${encodeURIComponent(cfg.city || "")}`;
      const res = await fetch(url, { headers: { Accept: "application/json" } });
      if (!res.ok) throw new Error(`Failed to load listings (${res.status})`);
      const data = await res.json();
      state.allPlots = (Array.isArray(data) ? data : []).filter((plot) => {
        const cityMatch = String(plot.county || plot.town || "").trim().toLowerCase() === String(cfg.city || "").trim().toLowerCase();
        return cityMatch;
      });
      updateFilters();
      applyFilters();
      renderListings();
      renderMap();
      renderSchema();
    } catch (err) {
      if (els.status) {
        els.status.textContent = err && err.message ? err.message : "Unable to load listings right now.";
      }
      if (els.listings) {
        els.listings.innerHTML = `<div class="city-empty">Could not load live listings for ${escapeHtml(cfg.city || "this city")} right now.</div>`;
      }
    }
  }

  init();
})();
