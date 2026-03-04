import React, { useEffect, useMemo, useRef, useState } from "https://esm.sh/react@18.2.0";
import { createRoot } from "https://esm.sh/react-dom@18.2.0/client";
import htm from "https://esm.sh/htm@3.1.1";

const html = htm.bind(React.createElement);
const DEFAULT_API_BASE = "https://tstplotconnect-2.onrender.com";
const DEFAULT_MAP_CENTER = [37.9062, -0.0236]; // [lng, lat]
const SUPPORTED_COUNTRIES = ["Kenya", "Uganda", "Tanzania", "Rwanda"];
const COUNTRY_COORDS = {
  Kenya: [37.9062, -0.0236],
  Uganda: [32.2903, 1.3733],
  Tanzania: [34.8888, -6.369],
  Rwanda: [29.8739, -1.9403]
};
const COUNTY_COORDS = {
  Machakos: [37.2634, -1.5177],
  Nairobi: [36.8219, -1.2921],
  Makueni: [37.6203, -2.2833],
  Kajiado: [36.7833, -1.85]
};
const AREA_COORDS = {
  "Machakos|Katungo": [37.281, -1.543],
  "Machakos|Mutituni": [37.26, -1.568],
  "Machakos|Town": [37.2634, -1.5177],
  "Nairobi|Rongai": [36.7417, -1.3933],
  "Nairobi|South B": [36.845, -1.3129],
  "Nairobi|Kasarani": [36.8913, -1.2281]
};

const SAMPLE_PLOTS = [
  { id: "sample-1", title: "Bedsitter - Katungo", price: 6500, country: "Kenya", county: "Machakos", town: "Machakos", area: "Katungo", images: ["https://images.unsplash.com/photo-1560448204-e02f11c3d0e2", "https://images.unsplash.com/photo-1580587771525-78b9dba3b914"], videos: [], caretaker: "Locked", whatsapp: "Locked", description: "" },
  { id: "sample-2", title: "One Bedroom - Katungo", price: 9000, country: "Kenya", county: "Machakos", town: "Machakos", area: "Katungo", images: ["https://images.unsplash.com/photo-1598928506311-6f37b1369d11"], videos: ["https://www.w3schools.com/html/mov_bbb.mp4"], caretaker: "Locked", whatsapp: "Locked", description: "" },
  { id: "sample-3", title: "Bedsitter - Mutituni", price: 7000, country: "Kenya", county: "Machakos", town: "Machakos", area: "Mutituni", images: ["https://images.unsplash.com/photo-1570129477492-45c003edd2be"], videos: [], caretaker: "Locked", whatsapp: "Locked", description: "" },
  { id: "sample-4", title: "Studio - Town", price: 8000, country: "Kenya", county: "Machakos", town: "Machakos", area: "Town", images: ["https://images.unsplash.com/photo-1580587771525-78b9dba3b914"], videos: [], caretaker: "Locked", whatsapp: "Locked", description: "" },
  { id: "sample-5", title: "One Bedroom - Rongai", price: 10000, country: "Kenya", county: "Nairobi", town: "Nairobi", area: "Rongai", images: ["https://images.unsplash.com/photo-1570129477492-3c3d1f7eb20a"], videos: ["https://www.w3schools.com/html/mov_bbb.mp4"], caretaker: "Locked", whatsapp: "Locked", description: "" },
  { id: "sample-6", title: "Bedsitter - South B", price: 6500, country: "Kenya", county: "Nairobi", town: "Nairobi", area: "South B", images: ["https://images.unsplash.com/photo-1600585154340-be6161a56a0c"], videos: [], caretaker: "Locked", whatsapp: "Locked", description: "" },
  { id: "sample-7", title: "One Bedroom - Kasarani", price: 9000, country: "Kenya", county: "Nairobi", town: "Nairobi", area: "Kasarani", images: ["https://images.unsplash.com/photo-1598928506311-6f37b1369d11"], videos: [], caretaker: "Locked", whatsapp: "Locked", description: "" },
  { id: "sample-8", title: "Studio - Kasarani", price: 8500, country: "Kenya", county: "Nairobi", town: "Nairobi", area: "Kasarani", images: ["https://images.unsplash.com/photo-1560448204-e02f11c3d0e2"], videos: [], caretaker: "Locked", whatsapp: "Locked", description: "" },
  { id: "sample-9", title: "Bedsitter - Katungo", price: 6000, country: "Kenya", county: "Machakos", town: "Machakos", area: "Katungo", images: ["https://images.unsplash.com/photo-1570129477492-45c003edd2be"], videos: [], caretaker: "Locked", whatsapp: "Locked", description: "" },
  { id: "sample-10", title: "One Bedroom - Town", price: 9500, country: "Kenya", county: "Machakos", town: "Machakos", area: "Town", images: ["https://images.unsplash.com/photo-1580587771525-78b9dba3b914"], videos: [], caretaker: "Locked", whatsapp: "Locked", description: "" }
];

async function ensureMapLibreAssets() {
  if (window.maplibregl) return window.maplibregl;

  if (!document.getElementById("maplibre-css")) {
    const css = document.createElement("link");
    css.id = "maplibre-css";
    css.rel = "stylesheet";
    css.href = "https://unpkg.com/maplibre-gl@4.7.1/dist/maplibre-gl.css";
    document.head.appendChild(css);
  }

  await new Promise((resolve, reject) => {
    if (window.maplibregl) {
      resolve();
      return;
    }

    let script = document.getElementById("maplibre-js");
    if (!script) {
      script = document.createElement("script");
      script.id = "maplibre-js";
      script.src = "https://unpkg.com/maplibre-gl@4.7.1/dist/maplibre-gl.js";
      script.async = true;
      script.onload = () => resolve();
      script.onerror = () => reject(new Error("MapLibre script failed to load."));
      document.head.appendChild(script);
      return;
    }

    script.addEventListener("load", () => resolve(), { once: true });
    script.addEventListener("error", () => reject(new Error("MapLibre script failed to load.")), { once: true });
  });

  return window.maplibregl;
}

function add3DBuildings(map) {
  const layers = (map.getStyle() && map.getStyle().layers) || [];
  const labelLayerId = layers.find((layer) => layer.type === "symbol" && layer.layout && layer.layout["text-field"])?.id;
  const baseBuildingLayer = layers.find(
    (layer) => typeof layer["source-layer"] === "string" && layer["source-layer"].toLowerCase().includes("building")
  );
  if (!baseBuildingLayer) return;

  if (!map.getLayer("plotconnect-3d-buildings")) {
    map.addLayer(
      {
        id: "plotconnect-3d-buildings",
        type: "fill-extrusion",
        source: baseBuildingLayer.source,
        "source-layer": baseBuildingLayer["source-layer"],
        minzoom: 15,
        paint: {
          "fill-extrusion-color": "#cbd5e1",
          "fill-extrusion-opacity": 0.85,
          "fill-extrusion-height": ["coalesce", ["get", "render_height"], ["get", "height"], 8],
          "fill-extrusion-base": ["coalesce", ["get", "render_min_height"], ["get", "min_height"], 0]
        }
      },
      labelLayerId
    );
  }
}

function MapLibreMap({ centerLngLat, markerLabel }) {
  const mapContainerRef = useRef(null);
  const mapRef = useRef(null);
  const markerRef = useRef(null);
  const [mapError, setMapError] = useState("");

  useEffect(() => {
    let mounted = true;
    if (!mapContainerRef.current || mapRef.current) return undefined;

    (async () => {
      try {
        const maplibregl = await ensureMapLibreAssets();
        if (!mounted || !mapContainerRef.current) return;

        const [lng, lat] = centerLngLat || DEFAULT_MAP_CENTER;
        const map = new maplibregl.Map({
          container: mapContainerRef.current,
          style: "https://tiles.openfreemap.org/styles/liberty",
          center: [lng, lat],
          zoom: 16,
          minZoom: 3,
          maxZoom: 22,
          pitch: 58,
          bearing: -18,
          antialias: true
        });

        map.addControl(new maplibregl.NavigationControl(), "top-left");
        map.addControl(new maplibregl.ScaleControl({ unit: "metric" }), "bottom-left");

        map.on("load", () => {
          if (!mounted) return;
          add3DBuildings(map);
          markerRef.current = new maplibregl.Marker({ color: "#ef233c" })
            .setLngLat([lng, lat])
            .setPopup(new maplibregl.Popup({ offset: 16 }).setText(markerLabel || "Selected Plot"))
            .addTo(map);
        });

        mapRef.current = map;
      } catch (err) {
        setMapError(err.message || "MapLibre failed to load.");
      }
    })();

    return () => {
      mounted = false;
      if (mapRef.current) {
        mapRef.current.remove();
        mapRef.current = null;
      }
      markerRef.current = null;
    };
  }, []);

  useEffect(() => {
    if (!mapRef.current) return;
    const [lng, lat] = centerLngLat || DEFAULT_MAP_CENTER;
    mapRef.current.easeTo({ center: [lng, lat], zoom: 18, pitch: 58, bearing: -18, duration: 900 });

    if (markerRef.current) {
      markerRef.current.setLngLat([lng, lat]);
      markerRef.current.setPopup(
        new window.maplibregl.Popup({ offset: 16 }).setText(markerLabel || "Selected Plot")
      );
    }
  }, [centerLngLat, markerLabel]);

  if (mapError) {
    return html`<div className="map-container rounded-2xl p-4 text-red-300">${mapError}</div>`;
  }
  return html`<div ref=${mapContainerRef} className="map-container rounded-2xl"></div>`;
}

function App() {
  const USER_MOBILE_NAV_BREAKPOINT = 980;
  const [apiBase, setApiBase] = useState(DEFAULT_API_BASE);
  const [msg, setMsg] = useState({ text: "", error: false });
  const [phone, setPhone] = useState("");
  const [token, setToken] = useState("");
  const [plots, setPlots] = useState([]);
  const [status, setStatus] = useState(null);
  const [loading, setLoading] = useState(false);
  const [filters, setFilters] = useState({ country: "", county: "", area: "" });
  const [meta, setMeta] = useState({ countries: [], countiesByCountry: {}, areasByCounty: {} });
  const [selectedPlotId, setSelectedPlotId] = useState("");
  const [nowTs, setNowTs] = useState(Date.now());
  const [activeNav, setActiveNav] = useState("user-access");
  const [paymentLog, setPaymentLog] = useState([]);
  const [isMobileNavOpen, setIsMobileNavOpen] = useState(false);

  const counties = useMemo(
    () => (filters.country ? meta.countiesByCountry[filters.country] || [] : []),
    [meta, filters.country]
  );
  const areas = useMemo(
    () => (filters.county ? meta.areasByCounty[filters.county] || [] : []),
    [meta, filters.county]
  );

  function showMessage(text, error = false) {
    setMsg({ text, error });
  }

  function addPaymentLog(statusValue, note) {
    setPaymentLog((prev) => [
      {
        id: `${Date.now()}-${Math.random().toString(16).slice(2, 8)}`,
        timestamp: new Date().toISOString(),
        amount: 50,
        status: statusValue,
        note: note || ""
      },
      ...prev
    ]);
  }

  function sleep(ms) {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  function getRemainingMs(expiresAt) {
    if (!expiresAt) return 0;
    const end = new Date(expiresAt).getTime();
    if (Number.isNaN(end)) return 0;
    return Math.max(0, end - nowTs);
  }

  function formatRemaining(ms) {
    const total = Math.floor(ms / 1000);
    const hours = Math.floor(total / 3600);
    const minutes = Math.floor((total % 3600) / 60);
    const seconds = total % 60;
    return {
      hours,
      minutes,
      seconds,
      text: `${hours}h ${String(minutes).padStart(2, "0")}m ${String(seconds).padStart(2, "0")}s`
    };
  }

  function getPlotLngLat(plot) {
    if (typeof plot.lng === "number" && typeof plot.lat === "number") return [plot.lng, plot.lat];
    const county = plot.county || plot.town || "";
    const area = plot.area || "";
    const key = `${county}|${area}`;
    if (AREA_COORDS[key]) return AREA_COORDS[key];
    if (COUNTY_COORDS[county]) return COUNTY_COORDS[county];
    if (COUNTRY_COORDS[plot.country]) return COUNTRY_COORDS[plot.country];
    return DEFAULT_MAP_CENTER;
  }

  function getFilterLngLat(currentFilters) {
    if (currentFilters.county && currentFilters.area) {
      const key = `${currentFilters.county}|${currentFilters.area}`;
      if (AREA_COORDS[key]) return AREA_COORDS[key];
    }
    if (currentFilters.county && COUNTY_COORDS[currentFilters.county]) {
      return COUNTY_COORDS[currentFilters.county];
    }
    if (currentFilters.country && COUNTRY_COORDS[currentFilters.country]) {
      return COUNTRY_COORDS[currentFilters.country];
    }
    return DEFAULT_MAP_CENTER;
  }

  async function api(path, options = {}, authToken = null) {
    const url = `${apiBase.replace(/\/+$/, "")}${path.startsWith("/") ? path : `/${path}`}`;
    const res = await fetch(url, {
      headers: {
        "Content-Type": "application/json",
        ...((authToken || token) ? { Authorization: `Bearer ${authToken || token}` } : {}),
        ...(options.headers || {})
      },
      ...options
    });
    if (res.status === 204) return null;
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data.error || `Request failed (${res.status})`);
    return data;
  }

  async function loadMetadata() {
    try {
      const data = await api("/api/metadata/locations");
      const incoming = data || { countries: [], countiesByCountry: {}, areasByCounty: {} };
      const countries = Array.from(new Set([...(incoming.countries || []), ...SUPPORTED_COUNTRIES]));
      setMeta({ ...incoming, countries });
    } catch (_err) {}
  }

  async function loadPlots() {
    setLoading(true);
    try {
      const query = new URLSearchParams();
      if (filters.country) query.set("country", filters.country);
      if (filters.county) query.set("county", filters.county);
      if (filters.area) query.set("area", filters.area);
      const data = await api(`/api/plots${query.toString() ? `?${query.toString()}` : ""}`);
      const rows = Array.isArray(data) ? data : [];
      if (rows.length > 0) {
        setPlots(rows);
      } else {
        const fallback = SAMPLE_PLOTS.filter((p) =>
          (!filters.country || p.country === filters.country) &&
          (!filters.county || (p.county || p.town) === filters.county) &&
          (!filters.area || p.area === filters.area)
        );
        setPlots(fallback);
      }
    } catch (err) {
      const fallback = SAMPLE_PLOTS.filter((p) =>
        (!filters.country || p.country === filters.country) &&
        (!filters.county || (p.county || p.town) === filters.county) &&
        (!filters.area || p.area === filters.area)
      );
      setPlots(fallback);
      showMessage(`${err.message}. Showing sample plots.`, true);
    } finally {
      setLoading(false);
    }
  }

  async function startUserSession() {
    try {
      if (!phone.trim()) throw new Error("Enter phone number first.");
      const data = await api("/api/user/session", {
        method: "POST",
        body: JSON.stringify({ phone: phone.trim() })
      });
      setToken(data.token);
      showMessage("Session started. You can now activate account.");
      await loadStatus(data.token);
      await loadPlots();
      return data.token;
    } catch (err) {
      showMessage(err.message, true);
      return "";
    }
  }

  async function waitForActivation(maxSeconds = 120, authToken = null) {
    for (let i = 0; i < maxSeconds; i += 1) {
      const s = await api("/api/user/status", {}, authToken);
      setStatus(s);
      if (s.active) {
        await loadPlots();
        showMessage("Payment received. Contacts unlocked for 24 hours.");
        return true;
      }
      await sleep(1000);
    }
    return false;
  }

  async function pay() {
    try {
      if (!phone.trim()) throw new Error("Enter your phone number first.");
      if (!window.confirm("Proceed to pay Ksh 50 to unlock contacts for 24 hours?")) return;

      const authToken = token || await startUserSession();
      if (!authToken) return;

      const data = await api("/api/pay", {
        method: "POST",
        body: JSON.stringify({ phone: phone.trim() })
      }, authToken);
      showMessage(data.message || "Payment initiated.");
      addPaymentLog("Pending", data.message || "Payment initiated.");
      await loadStatus(authToken);
      if (data.mode === "daraja") {
        const confirmed = await waitForActivation(120, authToken);
        if (!confirmed) {
          showMessage("STK sent. Complete payment on your phone; contacts unlock after confirmation.");
        } else {
          addPaymentLog("Completed", "Contacts unlocked for 24 hours.");
        }
      } else {
        addPaymentLog("Completed", "Contacts unlocked for 24 hours.");
        await loadPlots();
      }
    } catch (err) {
      addPaymentLog("Failed", err.message || "Payment failed.");
      showMessage(err.message, true);
    }
  }

  async function activateFromCard() {
    await pay();
  }

  async function loadStatus(authToken = null) {
    if (!authToken && !token) {
      setStatus(null);
      return;
    }
    try {
      const data = await api("/api/user/status", {}, authToken);
      setStatus(data);
    } catch (_err) {}
  }

  useEffect(() => {
    loadMetadata();
    loadPlots();
  }, []);

  useEffect(() => {
    loadPlots();
  }, [filters.country, filters.county, filters.area, token]);

  useEffect(() => {
    setSelectedPlotId("");
  }, [filters.country, filters.county, filters.area]);

  useEffect(() => {
    loadStatus();
    const t = setInterval(loadStatus, 1000);
    return () => clearInterval(t);
  }, [token]);

  useEffect(() => {
    const t = setInterval(() => setNowTs(Date.now()), 1000);
    return () => clearInterval(t);
  }, []);

  useEffect(() => {
    function syncHash() {
      const hash = (window.location.hash || "").replace(/^#/, "");
      setActiveNav(hash || "user-access");
      setIsMobileNavOpen(false);
    }
    syncHash();
    window.addEventListener("hashchange", syncHash);
    return () => window.removeEventListener("hashchange", syncHash);
  }, []);

  useEffect(() => {
    function syncMobileNavState() {
      if (window.innerWidth > USER_MOBILE_NAV_BREAKPOINT) {
        setIsMobileNavOpen(false);
      }
    }
    syncMobileNavState();
    window.addEventListener("resize", syncMobileNavState);
    return () => window.removeEventListener("resize", syncMobileNavState);
  }, []);

  const remainingMs = status && status.active ? getRemainingMs(status.expiresAt) : 0;
  const countdown = formatRemaining(remainingMs);
  const currentYear = new Date().getFullYear();
  const selectedPlot = plots.find((p) => p.id === selectedPlotId) || plots[0] || null;
  const selectedCoords = selectedPlot ? getPlotLngLat(selectedPlot) : getFilterLngLat(filters);
  const selectedLabel = selectedPlot
    ? selectedPlot.title
    : (filters.area || filters.county || filters.country || "Selected Location");
  const userNavItems = [
    { id: "user-access", label: "Access" },
    { id: "user-search", label: "Search" },
    { id: "user-listings", label: "Listings" },
    { id: "user-payments", label: "My Payments" },
    { id: "user-map", label: "Map" },
    { id: "user-support", label: "Support / FAQ" }
  ];

  return html`
    <div className="page-shell">
      <nav className="glass hero-nav mb-5">
        <h1 className="brand-title">TST PlotConnect</h1>
        <p className="brand-subtitle">Discover Verified Rentals Faster</p>
      </nav>

      <main className="user-main">
        <button
          type="button"
          className="mobile-nav-toggle"
          onClick=${() => setIsMobileNavOpen((v) => !v)}
          aria-expanded=${isMobileNavOpen ? "true" : "false"}
          aria-controls="user-sidebar-nav"
        >
          <span aria-hidden="true">${isMobileNavOpen ? "X" : "☰"}</span>
          <span>${isMobileNavOpen ? "Close Menu" : "Menu"}</span>
        </button>

        <aside id="user-sidebar-nav" className=${`glass user-sidebar ${isMobileNavOpen ? "is-mobile-open" : ""}`}>
          <div className="sidebar-brand">
            <img src="/favicon.svg" alt="Tstplotsconnect" className="sidebar-brand-icon" />
            <p className="sidebar-title">Tstplotsconnect</p>
          </div>
          <p className="sidebar-subtitle">User Page</p>
          <div className="sidebar-list">
            ${userNavItems.map((item) => html`
              <a
                href=${`#${item.id}`}
                className=${`sidebar-link ${activeNav === item.id ? "is-active" : ""}`}
                onClick=${() => {
                  setActiveNav(item.id);
                  setIsMobileNavOpen(false);
                }}
              >
                <span>${item.label}</span>
                <span className="sidebar-chevron" aria-hidden="true">></span>
              </a>
            `)}
          </div>
        </aside>

        <div className="user-content">
      <section id="user-access" className="glass section-card mb-5">
        <p className="section-kicker">Access</p>
        <h2 className="section-title">Unlock Contacts</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <input className="input-modern p-3 rounded-xl" placeholder="Phone e.g. 0700..." value=${phone} onInput=${(e) => setPhone(e.target.value)} />
          <button className="btn-success rounded-xl p-3" onClick=${pay} disabled=${!phone.trim()}>Pay Ksh 50</button>
        </div>
        ${msg.text ? html`<p className=${`mt-3 text-sm ${msg.error ? "text-red-300" : "text-emerald-300"}`}>${msg.text}</p>` : null}
        ${status
          ? html`
              <div className="mt-3 rounded-xl border border-slate-700/60 bg-slate-900/40 p-3">
                <p className="text-sm text-slate-300">Activation: ${status.active ? "Active" : "Inactive"}</p>
                <p className="text-sm ${status.active ? "text-emerald-300" : "text-slate-400"}">
                  Countdown: ${status.active ? countdown.text : "0h 00m 00s"}
                </p>
              </div>
            `
          : null}
      </section>

      <section id="user-search" className="glass section-card mb-5">
        <p className="section-kicker">Filter</p>
        <h2 className="section-title">Search By Location</h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          <select className="input-modern p-3 rounded-xl" value=${filters.country} onChange=${(e) => setFilters({ country: e.target.value, county: "", area: "" })}>
            <option value="">All Countries</option>
            ${(meta.countries || []).map((c) => html`<option value=${c} key=${c}>${c}</option>`)}
          </select>
          <select className="input-modern p-3 rounded-xl" value=${filters.county} onChange=${(e) => setFilters({ ...filters, county: e.target.value, area: "" })}>
            <option value="">All Counties</option>
            ${counties.map((c) => html`<option value=${c} key=${c}>${c}</option>`)}
          </select>
          <select className="input-modern p-3 rounded-xl" value=${filters.area} onChange=${(e) => setFilters({ ...filters, area: e.target.value })}>
            <option value="">All Areas</option>
            ${areas.map((a) => html`<option value=${a} key=${a}>${a}</option>`)}
          </select>
        </div>
      </section>

      <section id="user-listings" className="mb-5">
        <div className="flex items-end justify-between mb-3">
          <div>
            <p className="section-kicker">Listings</p>
            <h2 className="section-title mb-0">Available Plots</h2>
          </div>
          <p className="text-xs text-muted">${plots.length} result${plots.length === 1 ? "" : "s"}</p>
        </div>

        ${loading
          ? html`<p className="text-slate-300">Loading plots...</p>`
          : html`
              <div className="plot-grid">
                ${plots.map((plot, idx) => html`
                  ${(() => {
                    const mediaUnlocked = !!(status && status.active);
                    return html`
                  <article
                    key=${plot.id}
                    className=${`glass plot-card ${selectedPlot && selectedPlot.id === plot.id ? "is-selected" : ""}`}
                    style=${{ animationDelay: `${Math.min(idx * 45, 240)}ms` }}
                    onClick=${() => setSelectedPlotId(plot.id)}
                  >
                    <div className="media-wrap mb-3">
                      ${plot.images && plot.images.length
                        ? html`<img
                            src=${plot.images[0]}
                            alt=${plot.title}
                            className=${`plot-image ${mediaUnlocked ? "" : "media-locked"}`}
                            onError=${(e) => { e.currentTarget.src = "https://images.unsplash.com/photo-1560185127-6ed189bf02f4"; }}
                          />`
                        : html`<div className=${`plot-image media-empty ${mediaUnlocked ? "" : "media-locked"}`}>No Image</div>`}
                    </div>
                    ${plot.videos && plot.videos.length
                      ? html`<video controls className=${`plot-image mb-3 ${mediaUnlocked ? "" : "media-locked"}`}><source src=${plot.videos[0]} type="video/mp4" /></video>`
                      : null}
                    ${mediaUnlocked ? null : html`<p className="media-lock-note">Activate account</p>`}
                    <h3 className="text-lg font-semibold leading-tight">${plot.title}</h3>
                    <p className="plot-meta mt-1">${plot.country || "Kenya"} | ${plot.county || plot.town || "-"} | ${plot.area}</p>
                    <p className="mt-2 font-bold text-lg">Ksh ${plot.price}</p>
                    <p className="mt-2 text-sm text-slate-300">${plot.description || "No description added yet."}</p>
                    <p className="mt-2 text-sm">Caretaker: ${plot.caretaker}</p>
                    <p className="text-sm">WhatsApp: ${plot.whatsapp}</p>
                  </article>
                `})()}
                `)}
              </div>
            `}
      </section>

      <section id="user-map" className="glass section-card mb-2">
        <p className="section-kicker">Map</p>
        <h2 className="section-title">Selected Plot Location</h2>
        <${MapLibreMap}
          centerLngLat=${selectedCoords}
          markerLabel=${selectedLabel}
        />
      </section>

      <section id="user-payments" className="glass section-card mb-5">
        <p className="section-kicker">Payments</p>
        <h2 className="section-title">My Payments</h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mb-3">
          <div className="input-modern rounded-xl p-3">
            <p className="text-muted text-xs">Access Status</p>
            <p className="font-semibold">${status && status.active ? "Active" : "Inactive"}</p>
          </div>
          <div className="input-modern rounded-xl p-3">
            <p className="text-muted text-xs">Amount</p>
            <p className="font-semibold">Ksh 50</p>
          </div>
          <div className="input-modern rounded-xl p-3">
            <p className="text-muted text-xs">Remaining Time</p>
            <p className="font-semibold">${status && status.active ? countdown.text : "0h 00m 00s"}</p>
          </div>
        </div>
        ${paymentLog.length === 0
          ? html`<p className="text-sm text-muted">No payment activity yet. Use Access section to start and pay.</p>`
          : html`
              <div className="payment-log">
                ${paymentLog.map((p) => html`
                  <div key=${p.id} className="payment-log-item">
                    <p className="payment-log-main">
                      <span className=${`pay-pill pay-${String(p.status || "").toLowerCase()}`}>${p.status}</span>
                      <span>Ksh ${p.amount}</span>
                      <span>${new Date(p.timestamp).toLocaleString()}</span>
                    </p>
                    <p className="payment-log-note">${p.note}</p>
                  </div>
                `)}
              </div>
            `}
      </section>

      <section id="user-support" className="glass section-card mb-2">
        <p className="section-kicker">Support</p>
        <h2 className="section-title">Support / FAQ</h2>
        <div className="faq-list">
          <div className="faq-item">
            <p className="faq-q">How do I unlock contacts?</p>
            <p className="faq-a">Go to Access, enter your phone, tap Continue, then Pay Ksh 50.</p>
          </div>
          <div className="faq-item">
            <p className="faq-q">How long does access last?</p>
            <p className="faq-a">Access lasts for 24 hours after successful payment confirmation.</p>
          </div>
          <div className="faq-item">
            <p className="faq-q">What if payment is delayed?</p>
            <p className="faq-a">Wait for STK confirmation on your phone. The status will update automatically.</p>
          </div>
        </div>
      </section>

      <footer className="user-footer">
        <div className="footer-grid">
          <div>
            <p className="footer-brand">TST PlotConnect</p>
            <p className="footer-note">Find trusted plots and rentals faster across East Africa.</p>
          </div>
          <div>
            <p className="footer-heading">Quick Links</p>
            <div className="footer-links">
              <a href="#user-search">Search</a>
              <a href="#user-listings">Listings</a>
              <a href="#user-map">Map</a>
            </div>
          </div>
          <div>
            <p className="footer-heading">Contact</p>
            <p className="footer-note">support@tst-plotconnect.com</p>
            <p className="footer-note">+254 796 675 724</p>
            <div className="footer-social" aria-label="Social links">
              <a href="https://www.facebook.com/" target="_blank" rel="noopener noreferrer" className="social-icon" aria-label="Facebook">
                <svg viewBox="0 0 24 24" role="img" aria-hidden="true">
                  <path fill="currentColor" d="M13.5 8.5V6.8c0-.8.5-1.3 1.4-1.3h1.6V2.4h-2.8C10.9 2.4 9.7 4 9.7 6.4v2.1H7.3v3.2h2.4v9h3.8v-9h2.7l.4-3.2h-3.1z"/>
                </svg>
              </a>
              <a href="https://www.instagram.com/" target="_blank" rel="noopener noreferrer" className="social-icon" aria-label="Instagram">
                <svg viewBox="0 0 24 24" role="img" aria-hidden="true">
                  <path fill="currentColor" d="M7.5 2h9A5.5 5.5 0 0 1 22 7.5v9a5.5 5.5 0 0 1-5.5 5.5h-9A5.5 5.5 0 0 1 2 16.5v-9A5.5 5.5 0 0 1 7.5 2zm0 1.8A3.7 3.7 0 0 0 3.8 7.5v9a3.7 3.7 0 0 0 3.7 3.7h9a3.7 3.7 0 0 0 3.7-3.7v-9a3.7 3.7 0 0 0-3.7-3.7h-9zm9.3 1.4a1.1 1.1 0 1 1 0 2.2 1.1 1.1 0 0 1 0-2.2zM12 7a5 5 0 1 1 0 10 5 5 0 0 1 0-10zm0 1.8A3.2 3.2 0 1 0 12 15.2 3.2 3.2 0 0 0 12 8.8z"/>
                </svg>
              </a>
              <a href="https://x.com/" target="_blank" rel="noopener noreferrer" className="social-icon" aria-label="X">
                <svg viewBox="0 0 24 24" role="img" aria-hidden="true">
                  <path fill="currentColor" d="M18.2 3h2.9l-6.3 7.2L22 21h-5.6l-4.4-5.8L6.9 21H4l6.7-7.7L3.7 3h5.7l4 5.3L18.2 3zm-1 16.3h1.6L8.6 4.6H7z"/>
                </svg>
              </a>
              <a href="https://wa.me/254700000000" target="_blank" rel="noopener noreferrer" className="social-icon" aria-label="WhatsApp">
                <svg viewBox="0 0 24 24" role="img" aria-hidden="true">
                  <path fill="currentColor" d="M20.5 3.5A11 11 0 0 0 3.2 16.7L2 22l5.4-1.2A11 11 0 1 0 20.5 3.5zM12 20a8.8 8.8 0 0 1-4.5-1.2l-.3-.2-3.2.7.7-3.1-.2-.3A8.8 8.8 0 1 1 12 20zm4.8-6.6c-.3-.1-1.7-.8-2-.9-.3-.1-.5-.1-.7.2l-.6.9c-.2.3-.4.3-.7.1a7.3 7.3 0 0 1-3.6-3.2c-.2-.3 0-.5.1-.7l.5-.6c.2-.2.2-.4.3-.6l-.5-1.3c-.1-.3-.3-.3-.5-.3h-.5c-.2 0-.6.1-.9.4-.3.3-1.1 1.1-1.1 2.7s1.1 3 1.2 3.2c.2.2 2.2 3.4 5.4 4.7.8.3 1.4.5 1.9.6.8.2 1.5.2 2.1.1.6-.1 1.7-.7 2-1.4.2-.7.2-1.2.1-1.3-.1-.1-.3-.2-.6-.3z"/>
                </svg>
              </a>
            </div>
          </div>
        </div>
        <div className="footer-bottom">
          <p className="footer-copy">(c) ${currentYear} TST PlotConnect. All rights reserved. Created by Fluxbyte.</p>
          <a href="#user-access" className="back-to-top">Back to top</a>
        </div>
      </footer>
        </div>
      </main>
    </div>
  `;
}

createRoot(document.getElementById("app")).render(html`<${App} />`);









