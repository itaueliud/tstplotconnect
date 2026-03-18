import React, { useEffect, useMemo, useRef, useState } from "https://esm.sh/react@18.2.0";
import { createRoot } from "https://esm.sh/react-dom@18.2.0/client";
import htm from "https://esm.sh/htm@3.1.1";

const html = htm.bind(React.createElement);
const DEFAULT_API_BASE = "https://tstplotconnect-2.onrender.com";
const SUPPORT_PHONE = "0768622994";
const SUPPORT_WHATSAPP = "254768622994";
const API = (typeof process !== "undefined" && process.env && process.env.NEXT_PUBLIC_API_URL)
  || (typeof window !== "undefined" && window.NEXT_PUBLIC_API_URL)
  || DEFAULT_API_BASE;
function inferApiBase() {
  if (typeof window === "undefined") return API;
  const loc = window.location;
  const isLocalHost = /^(localhost|127\.0\.0\.1|192\.168\.\d{1,3}\.\d{1,3}|10\.\d{1,3}\.\d{1,3}\.\d{1,3}|172\.(1[6-9]|2\d|3[0-1])\.\d{1,3}\.\d{1,3})$/i.test(loc.hostname);
  const isLocal = loc.protocol === "file:" || isLocalHost;
  if (isLocal) {
    try {
      localStorage.removeItem("apiBase");
    } catch (_err) {}
    return API;
  }
  let saved = "";
  try {
    saved = localStorage.getItem("apiBase") || "";
  } catch (_err) {
    saved = "";
  }
  if (saved) {
    const savedIsLocal = /^http:\/\/(localhost|127\.0\.0\.1|192\.168\.\d{1,3}\.\d{1,3}|10\.\d{1,3}\.\d{1,3}\.\d{1,3}|172\.(1[6-9]|2\d|3[0-1])\.\d{1,3}\.\d{1,3})(:\d+)?$/i.test(saved);
    const savedIsHttp = /^http:\/\//i.test(saved);
    if (savedIsLocal || savedIsHttp) {
      return API;
    }
  }
  return saved || API;
}
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

function MapLibreMap({ centerLngLat, markerLabel, enableFocusZoom = false }) {
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
          zoom: 6,
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
    const targetZoom = enableFocusZoom ? 18 : mapRef.current.getZoom();
    mapRef.current.easeTo({ center: [lng, lat], zoom: targetZoom, pitch: 58, bearing: -18, duration: 900 });

    if (markerRef.current) {
      markerRef.current.setLngLat([lng, lat]);
      markerRef.current.setPopup(
        new window.maplibregl.Popup({ offset: 16 }).setText(markerLabel || "Selected Plot")
      );
    }
  }, [centerLngLat, markerLabel, enableFocusZoom]);

  if (mapError) {
    return html`<div className="map-container rounded-2xl p-4 text-red-300">${mapError}</div>`;
  }
  return html`<div ref=${mapContainerRef} className="map-container rounded-2xl"></div>`;
}

function formatPhoneForWhatsApp(phone) {
  const digits = String(phone || "").replace(/\D/g, "");
  if (!digits) return "";
  if (digits.startsWith("0")) return `254${digits.slice(1)}`;
  if (digits.startsWith("254")) return digits;
  return digits;
}

  function formatPhoneForTel(phone) {
    const digits = String(phone || "").replace(/\D/g, "");
    if (!digits) return "";
  if (digits.startsWith("0")) return `+254${digits.slice(1)}`;
    if (digits.startsWith("254")) return `+${digits}`;
    return `+${digits}`;
  }

  function normalizePriority(plot) {
    const raw = String(plot?.priority || plot?.priorityLevel || plot?.tier || "").toLowerCase().trim();
    if (["top", "high", "vip", "featured"].includes(raw)) return "top";
    if (["bottom", "low"].includes(raw)) return "bottom";
    return "medium";
  }

  function sortByPriority(rows) {
    const order = { top: 0, medium: 1, bottom: 2 };
    return [...rows].sort((a, b) => {
      const pa = normalizePriority(a);
      const pb = normalizePriority(b);
      const diff = order[pa] - order[pb];
      if (diff !== 0) return diff;
      return 0;
    });
  }

  function groupByPriority(rows) {
    const grouped = { top: [], medium: [], bottom: [] };
    rows.forEach((plot) => {
      grouped[normalizePriority(plot)].push(plot);
    });
    return grouped;
  }

function getInitialFiltersFromUrl() {
  if (typeof window === "undefined") {
    return { country: "", county: "", area: "", minPrice: "", maxPrice: "" };
  }
  const params = new URLSearchParams(window.location.search || "");
  return {
    country: String(params.get("country") || "").trim(),
    county: String(params.get("county") || "").trim(),
    area: String(params.get("area") || "").trim(),
    minPrice: "",
    maxPrice: ""
  };
}

function App() {
  const USER_MOBILE_NAV_BREAKPOINT = 980;
  const initialFilters = getInitialFiltersFromUrl();
  const [apiBase, setApiBase] = useState(inferApiBase());
  const [msg, setMsg] = useState({ text: "", error: false });
  const [token, setToken] = useState("");
  const [userProfile, setUserProfile] = useState(null);
  const [authMode, setAuthMode] = useState("register");
  const [registerName, setRegisterName] = useState("");
  const [registerPhone, setRegisterPhone] = useState("");
  const [registerPassword, setRegisterPassword] = useState("");
  const [loginPhone, setLoginPhone] = useState("");
  const [loginPassword, setLoginPassword] = useState("");
  const [showForgotOptions, setShowForgotOptions] = useState(false);
  const [forgotPhone, setForgotPhone] = useState("");
  const [forgotCode, setForgotCode] = useState("");
  const [forgotNewPassword, setForgotNewPassword] = useState("");
  const [forgotStep, setForgotStep] = useState("request");
  const [forgotExpiresAt, setForgotExpiresAt] = useState("");
  const [forgotBusy, setForgotBusy] = useState(false);
  const [plots, setPlots] = useState([]);
  const [status, setStatus] = useState(null);
  const [loading, setLoading] = useState(false);
  const [confirmingPayment, setConfirmingPayment] = useState(false);
  const [filters, setFilters] = useState({ ...initialFilters, category: initialFilters.category || "" });
  const [countryInput, setCountryInput] = useState("");
  const [countyInput, setCountyInput] = useState("");
  const [areaInput, setAreaInput] = useState("");
  const [categoryInput, setCategoryInput] = useState("");
  const [openField, setOpenField] = useState("");
  const [countryConfirmed, setCountryConfirmed] = useState(Boolean(initialFilters.country));
  const [clickedField, setClickedField] = useState("");
  const [meta, setMeta] = useState({ countries: [], countiesByCountry: {}, areasByCounty: {} });
  const [selectedPlotId, setSelectedPlotId] = useState("");
  const [nowTs, setNowTs] = useState(Date.now());
  const [activeNav, setActiveNav] = useState("user-access");
  const [paymentLog, setPaymentLog] = useState([]);
  const [isMobileNavOpen, setIsMobileNavOpen] = useState(false);
  const lastKnownActiveRef = useRef(false);

  const counties = useMemo(
    () => (filters.country ? meta.countiesByCountry[filters.country] || [] : []),
    [meta, filters.country]
  );
  const areas = useMemo(
    () => (filters.county ? meta.areasByCounty[filters.county] || [] : []),
    [meta, filters.county]
  );
  const availableCountries = useMemo(() => {
    const source = Array.isArray(meta.countries) ? meta.countries : [];
    return Array.from(new Set(source.filter(Boolean)));
  }, [meta.countries]);

  function showMessage(text, error = false) {
    setMsg({ text, error });
  }

  function handleCountryInputChange(value, fromRemote = false) {
    const next = String(value || "");
    setCountryInput(next);
    setFilters((prev) => {
      if (!next) return { ...prev, country: "", county: "", area: "" };
      const source = fromRemote ? (remoteCountries.length ? remoteCountries : availableCountries) : availableCountries;
      const match = source.find((c) => String(c).toLowerCase() === next.toLowerCase());
      return { ...prev, country: match || "", county: "", area: "" };
    });
  }

  function handleCountyInputChange(value, fromRemote = false) {
    const next = String(value || "");
    setCountyInput(next);
    setFilters((prev) => {
      if (!next) return { ...prev, county: "", area: "" };
      const country = filters.country || prev.country || countryInput;
      const source = fromRemote ? (remoteCounties.length ? remoteCounties : (meta.countiesByCountry?.[country] || [])) : (meta.countiesByCountry?.[country] || []);
      const match = source.find((c) => String(c).toLowerCase() === next.toLowerCase());
      return { ...prev, county: match || "", area: "" };
    });
  }

  function handleAreaInputChange(value, fromRemote = false) {
    const next = String(value || "");
    setAreaInput(next);
    setFilters((prev) => {
      if (!next) {
        return { ...prev, area: "" };
      }
      const county = filters.county || prev.county || countyInput;
      const source = fromRemote ? (remoteAreas.length ? remoteAreas : (meta.areasByCounty?.[county] || [])) : (meta.areasByCounty?.[county] || []);
      const match = source.find((a) => String(a).toLowerCase() === next.toLowerCase());
      return { ...prev, area: match || "" };
    });
  }

  function handleCategoryInputChange(value) {
    const next = String(value || "");
    setCategoryInput(next);
    setFilters((prev) => {
      if (!next) return { ...prev, category: "" };
      const match = [
        "Rental Houses",
        "Bedsitters",
        "Hostels",
        "Apartments",
        "Lodges",
        "AirBnB",
        "Vacant Shops",
        "Office Spaces",
        "Guest Houses",
        "Plots for Sale"
      ].find((c) => String(c).toLowerCase() === next.toLowerCase());
      return { ...prev, category: match || "" };
    });
  }

  function clearFilters() {
    setFilters((prev) => ({
      ...prev,
      county: "",
      area: "",
      category: "",
      minPrice: "",
      maxPrice: ""
    }));
    setCountyInput("");
    setAreaInput("");
    setCategoryInput("");
  }

  function getActiveFiltersLabel() {
    const parts = [];
    if (filters.country) parts.push(`Country: ${filters.country}`);
    if (filters.county) parts.push(`County: ${filters.county}`);
    if (filters.area) parts.push(`Area: ${filters.area}`);
    if (filters.category) parts.push(`Category: ${filters.category}`);
    if (filters.minPrice) parts.push(`Min: ${filters.minPrice}`);
    if (filters.maxPrice) parts.push(`Max: ${filters.maxPrice}`);
    return parts.length ? parts.join(" | ") : "None";
  }

  function normalizeText(value) {
    return String(value || "").trim().toLowerCase();
  }

  function getFilteredOptions(options, inputValue, limit = 8) {
    const query = normalizeText(inputValue);
    const list = Array.isArray(options) ? options.filter(Boolean) : [];
    const filtered = query
      ? list.filter((item) => normalizeText(item).includes(query))
      : list;
    return filtered.slice(0, limit);
  }

  // --- New: debounce helper and server-backed fetchers for Option B endpoints ---
  function debounce(fn, wait = 300) {
    let t = null;
    return (...args) => {
      if (t) clearTimeout(t);
      t = setTimeout(() => fn(...args), wait);
    };
  }

  const [remoteCountries, setRemoteCountries] = useState([]);
  const [remoteCounties, setRemoteCounties] = useState([]);
  const [remoteAreas, setRemoteAreas] = useState([]);

  let latestCountryQuery = "";
  let latestCountyQuery = "";
  let latestAreaQuery = "";

  async function fetchCountries(query) {
    latestCountryQuery = String(query || "");
    try {
      const url = `${apiBase}/api/metadata/countries${query ? `?query=${encodeURIComponent(query)}` : ""}`;
      const res = await fetch(url);
      if (!res.ok) throw new Error("Failed to load countries");
      const data = await res.json();
      if (latestCountryQuery !== String(query || "")) return; // stale
      setRemoteCountries(Array.isArray(data) ? data : []);
    } catch (_err) {
      // fallback to local meta
      setRemoteCountries(availableCountries || []);
    }
  }

  async function fetchCounties(country, query) {
    latestCountyQuery = `${country}::${String(query || "")}`;
    try {
      const url = `${apiBase}/api/metadata/counties?country=${encodeURIComponent(country || "")}${query ? `&query=${encodeURIComponent(query)}` : ""}`;
      const res = await fetch(url);
      if (!res.ok) throw new Error("Failed to load counties");
      const data = await res.json();
      if (latestCountyQuery !== `${country}::${String(query || "")}`) return;
      setRemoteCounties(Array.isArray(data) ? data : []);
    } catch (_err) {
      setRemoteCounties(meta.countiesByCountry?.[country] || []);
    }
  }

  async function fetchAreas(county, query) {
    latestAreaQuery = `${county}::${String(query || "")}`;
    try {
      const url = `${apiBase}/api/metadata/areas?county=${encodeURIComponent(county || "")}${query ? `&query=${encodeURIComponent(query)}` : ""}`;
      const res = await fetch(url);
      if (!res.ok) throw new Error("Failed to load areas");
      const data = await res.json();
      if (latestAreaQuery !== `${county}::${String(query || "")}`) return;
      setRemoteAreas(Array.isArray(data) ? data : []);
    } catch (_err) {
      setRemoteAreas(meta.areasByCounty?.[county] || []);
    }
  }

  const debouncedFetchCountries = debounce((q) => fetchCountries(q), 300);
  const debouncedFetchCounties = debounce((country, q) => fetchCounties(country, q), 300);
  const debouncedFetchAreas = debounce((county, q) => fetchAreas(county, q), 300);

  // --- end new additions ---

  function renderSuggestions(field, options, inputValue, onSelect) {
    if (openField !== field) return null;
    const items = getFilteredOptions(options, inputValue);
    if (!items.length) {
      return html`
        <div className="combo-suggestions">
          <div style=${{ padding: "10px 12px", color: "#9ca3af", fontSize: "0.9rem" }}>
            No results found
          </div>
        </div>
      `;
    }
    return html`
      <div className="combo-suggestions">
        ${items.map(
          (item) => html`
            <button
              type="button"
              className="combo-suggestion"
              onMouseDown=${(e) => e.preventDefault()}
              onClick=${() => {
                onSelect(item);
                setOpenField("");
              }}
              key=${item}
            >
              ${item}
            </button>
          `
        )}
      </div>
    `;
  }

  function persistSession(nextToken, user) {
    setToken(nextToken || "");
    setUserProfile(user || null);
    if (nextToken) {
      localStorage.setItem("userToken", nextToken);
      if (user) localStorage.setItem("userProfile", JSON.stringify(user));
    } else {
      localStorage.removeItem("userToken");
      localStorage.removeItem("userProfile");
    }
  }

  function paymentHideKey(user) {
    const userId = user?.id || user?.displayId || "anon";
    return `hiddenPaymentIds:${userId}`;
  }

  function getHiddenPaymentIds() {
    try {
      const raw = localStorage.getItem(paymentHideKey(userProfile));
      const parsed = JSON.parse(raw || "[]");
      return Array.isArray(parsed) ? parsed : [];
    } catch (_err) {
      return [];
    }
  }

  function setHiddenPaymentIds(ids) {
    localStorage.setItem(paymentHideKey(userProfile), JSON.stringify(ids));
  }

  function hidePaymentInUi(paymentId) {
    const current = getHiddenPaymentIds();
    if (!current.includes(paymentId)) {
      current.push(paymentId);
      setHiddenPaymentIds(current);
    }
    setPaymentLog((prev) => prev.filter((p) => p.id !== paymentId));
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
      setMeta({
        countries: Array.isArray(incoming.countries) ? incoming.countries : [],
        countiesByCountry: incoming.countiesByCountry && typeof incoming.countiesByCountry === "object"
          ? incoming.countiesByCountry
          : {},
        areasByCounty: incoming.areasByCounty && typeof incoming.areasByCounty === "object"
          ? incoming.areasByCounty
          : {}
      });
    } catch (_err) {
      setMeta({ countries: [], countiesByCountry: {}, areasByCounty: {} });
      showMessage("Failed to load location metadata from server.", true);
    }
  }

  async function loadPlots() {
    setLoading(true);
    try {
      const query = new URLSearchParams();
      if (filters.country) query.set("country", filters.country);
      if (filters.county) query.set("county", filters.county);
      if (filters.area) query.set("area", filters.area);
      if (filters.minPrice) query.set("minPrice", filters.minPrice);
      if (filters.maxPrice) query.set("maxPrice", filters.maxPrice);
      const data = await api(`/api/plots${query.toString() ? `?${query.toString()}` : ""}`);
      const rows = Array.isArray(data) ? data : [];
      const category = String(filters.category || "").trim().toLowerCase();
      const categoryFiltered = category
        ? rows.filter((p) => String(p.category || "").trim().toLowerCase() === category)
        : rows;
      const minPriceValue = String(filters.minPrice ?? "").trim();
      const maxPriceValue = String(filters.maxPrice ?? "").trim();
      const hasMin = minPriceValue !== "";
      const hasMax = maxPriceValue !== "";
      const min = hasMin ? Number(minPriceValue) : null;
      const max = hasMax ? Number(maxPriceValue) : null;
      const priceFiltered = categoryFiltered.filter((p) => {
        const price = Number(p.price);
        if (!Number.isFinite(price)) return true;
        if (hasMin && Number.isFinite(min) && price < min) return false;
        if (hasMax && Number.isFinite(max) && price > max) return false;
        return true;
      });
      setPlots(priceFiltered);
    } catch (err) {
      setPlots([]);
      showMessage(`${err.message}. Failed to load plots from server.`, true);
    } finally {
      setLoading(false);
    }
  }

  async function loadPaymentLog(authToken = null) {
    if (!authToken && !token) {
      setPaymentLog([]);
      return;
    }
    try {
      const rows = await api("/api/user/payments", {}, authToken);
      const hidden = new Set(getHiddenPaymentIds());
      const mapped = (Array.isArray(rows) ? rows : [])
        .filter((p) => !hidden.has(p.id))
        .map((p) => ({
          id: p.id,
          timestamp: p.timestamp,
          amount: p.amount,
          status: p.status,
          note: p.validationError || p.validationWarning || (p.status === "Completed" ? "Payment confirmed." : ""),
          mpesaReceipt: p.mpesaReceipt
      }));
      setPaymentLog(mapped);
    } catch (_err) {}
  }

  async function registerUser() {
    try {
      if (!registerName.trim()) throw new Error("Enter your name.");
      if (!registerPhone.trim()) throw new Error("Enter your Safaricom phone.");
      if (!registerPassword.trim()) throw new Error("Enter a password.");

      const data = await api("/api/user/register", {
        method: "POST",
        body: JSON.stringify({
          name: registerName.trim(),
          phone: registerPhone.trim(),
          password: registerPassword
        })
      });

      persistSession(data.token, data.user);
      setRegisterPassword("");
      showMessage("Registration complete. Activate your account below.");
      await loadStatus(data.token);
      await loadPaymentLog(data.token);
      await loadPlots();
    } catch (err) {
      showMessage(err.message, true);
    }
  }

  async function loginUser() {
    try {
      if (!loginPhone.trim()) throw new Error("Enter your phone.");
      if (!loginPassword.trim()) throw new Error("Enter your password.");

      const data = await api("/api/user/login", {
        method: "POST",
        body: JSON.stringify({
          phone: loginPhone.trim(),
          password: loginPassword
        })
      });

      persistSession(data.token, data.user);
      setLoginPassword("");
      setShowForgotOptions(false);
      showMessage("Login successful. Activate your account.");
      const freshStatus = await loadStatus(data.token);
      setNowTs(Date.now());
      await loadPaymentLog(data.token);
      if (freshStatus && freshStatus.active) {
        showMessage("Login successful. Account is active and contacts are unlocked.");
      }
      await loadPlots();
    } catch (err) {
      showMessage(err.message, true);
    }
  }

  async function requestPasswordResetCode() {
    try {
      const phone = (forgotPhone || loginPhone || "").trim();
      if (!phone) throw new Error("Enter your phone number first.");
      setForgotBusy(true);
      const data = await api("/api/auth/request-code", {
        method: "POST",
        body: JSON.stringify({ phone })
      });
      setForgotPhone(phone);
      setForgotStep("verify");
      setForgotCode("");
      setForgotExpiresAt(data?.expiresAt || "");
      showMessage(data?.message || "OTP sent. Check your phone.");
    } catch (err) {
      showMessage(err.message || "Failed to send OTP.", true);
    } finally {
      setForgotBusy(false);
    }
  }

  async function verifyPasswordResetCode() {
    try {
      const phone = (forgotPhone || loginPhone || "").trim();
      if (!phone) throw new Error("Enter your phone number.");
      if (!forgotCode.trim()) throw new Error("Enter the OTP code.");
      if (!forgotNewPassword.trim()) throw new Error("Enter your new password.");
      setForgotBusy(true);
      const data = await api("/api/auth/verify-code", {
        method: "POST",
        body: JSON.stringify({
          phone,
          code: forgotCode.trim(),
          newPassword: forgotNewPassword
        })
      });
      setLoginPhone(phone);
      setLoginPassword("");
      setShowForgotOptions(false);
      setForgotStep("request");
      setForgotCode("");
      setForgotNewPassword("");
      setForgotExpiresAt("");
      showMessage(data?.message || "Password reset successful. Please log in.");
    } catch (err) {
      showMessage(err.message || "Failed to reset password.", true);
    } finally {
      setForgotBusy(false);
    }
  }

  function logoutUser() {
    persistSession("", null);
    setCountryConfirmed(false);
    setFilters({ country: "", county: "", area: "", category: "", minPrice: "", maxPrice: "" });
    setCountryInput("");
    setCountyInput("");
    setAreaInput("");
    setCategoryInput("");
    setStatus(null);
    setPaymentLog([]);
    lastKnownActiveRef.current = false;
    showMessage("Logged out.");
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
      if (!token) throw new Error("Register or log in first.");
      const authToken = token;

      const data = await api("/api/pay", {
        method: "POST",
      }, authToken);
      showMessage(data.message || "Payment initiated.");
      addPaymentLog("Pending", data.message || "Payment initiated.");
      await loadStatus(authToken);
      await loadPaymentLog(authToken);
      if (data.mode === "daraja") {
        const confirmed = await waitForActivation(120, authToken);
        if (!confirmed) {
          showMessage("Enter your pin to complete payment");
        } else {
          await loadPaymentLog(authToken);
        }
      } else {
        await loadPaymentLog(authToken);
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

  async function confirmPaymentNow() {
    if (!token) {
      showMessage("Register or log in first.", true);
      return;
    }
    setConfirmingPayment(true);
    try {
      const freshStatus = await loadStatus(token);
      await loadPaymentLog(token);
      if (freshStatus && freshStatus.active) {
        setNowTs(Date.now());
        await loadPlots();
        showMessage("Payment confirmed. Contacts unlocked for 24 hours.");
      } else {
        showMessage("Payment not confirmed yet. Complete STK on your phone, then tap Confirm Payment again.", true);
      }
    } catch (err) {
      showMessage(err.message || "Failed to confirm payment status.", true);
    } finally {
      setConfirmingPayment(false);
    }
  }

  async function loadStatus(authToken = null) {
    if (!authToken && !token) {
      setStatus(null);
      return;
    }
    try {
      const data = await api("/api/user/status", {}, authToken);
      setStatus(data);
      return data;
    } catch (_err) {}
    return null;
  }

  useEffect(() => {
    const savedToken = localStorage.getItem("userToken") || "";
    const savedProfileRaw = localStorage.getItem("userProfile") || "";
    if (savedToken) {
      setToken(savedToken);
      if (savedProfileRaw) {
        try {
          setUserProfile(JSON.parse(savedProfileRaw));
        } catch (_err) {
          setUserProfile(null);
        }
      }
    }
    loadMetadata();
    loadPlots();
  }, []);

  useEffect(() => {
    function syncApiBase(event) {
      if (event && event.key && event.key !== "apiBase") return;
      setApiBase(inferApiBase());
    }
    window.addEventListener("storage", syncApiBase);
    return () => window.removeEventListener("storage", syncApiBase);
  }, []);

  useEffect(() => {
    loadMetadata();
    loadPlots();
  }, [apiBase]);

  useEffect(() => {
    loadPlots();
  }, [filters.country, filters.county, filters.area, filters.category, filters.minPrice, filters.maxPrice, token, apiBase]);

  useEffect(() => {
    setSelectedPlotId("");
  }, [filters.country, filters.county, filters.area, filters.category, filters.minPrice, filters.maxPrice]);

  useEffect(() => {
    loadStatus();
    loadPaymentLog();
    const statusTimer = setInterval(loadStatus, 1000);
    const paymentTimer = setInterval(loadPaymentLog, 5000);
    return () => {
      clearInterval(statusTimer);
      clearInterval(paymentTimer);
    };
  }, [token]);

  useEffect(() => {
    const isActive = !!(status && status.active);
    if (token && isActive && !lastKnownActiveRef.current) {
      loadPlots();
      loadPaymentLog();
      showMessage("Payment received. Contacts unlocked for 24 hours.");
    }
    lastKnownActiveRef.current = isActive;
    if (!token) {
      lastKnownActiveRef.current = false;
    }
  }, [status, token]);

  useEffect(() => {
    const t = setInterval(() => setNowTs(Date.now()), 1000);
    return () => clearInterval(t);
  }, []);

  useEffect(() => {
    if (filters.area && areaInput !== filters.area) {
      setAreaInput(filters.area);
    }
  }, [filters.area, areaInput]);

  useEffect(() => {
    if (filters.country && countryInput !== filters.country) {
      setCountryInput(filters.country);
    }
  }, [filters.country, countryInput]);

  useEffect(() => {
    if (filters.county && countyInput !== filters.county) {
      setCountyInput(filters.county);
    }
  }, [filters.county, countyInput]);

  useEffect(() => {
    if (filters.category && categoryInput !== filters.category) {
      setCategoryInput(filters.category);
    }
  }, [filters.category, categoryInput]);

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

  // Close dropdown when clicking outside
  useEffect(() => {
    function onDocumentClick(e) {
      if (!e || !e.target) return;
      // If a combo input or suggestions container was clicked, keep it open
      const el = e.target instanceof Element ? e.target : null;
      if (!el) return;
      const combo = el.closest && el.closest('.combo-single');
      if (!combo) {
        setOpenField('');
      }
    }
    document.addEventListener('click', onDocumentClick);
    return () => document.removeEventListener('click', onDocumentClick);
  }, []);

  const remainingMs = status && status.active ? getRemainingMs(status.expiresAt) : 0;
  const countdown = formatRemaining(remainingMs);
  const currentYear = new Date().getFullYear();
  const orderedPlots = sortByPriority(plots);
  const groupedPlots = groupByPriority(orderedPlots);
  const selectedPlot = orderedPlots.find((p) => p.id === selectedPlotId) || orderedPlots[0] || null;
  const selectedCoords = selectedPlot ? getPlotLngLat(selectedPlot) : getFilterLngLat(filters);
  const selectedLabel = selectedPlot
    ? selectedPlot.title
    : (filters.area || filters.county || filters.country || "Selected Location");
  const isAuthenticated = Boolean(token);
  const hasChosenCountry = Boolean(filters.country) && countryConfirmed;
  const hasLockedCountryFilter = Boolean(filters.country);
  const searchGridClass = hasLockedCountryFilter ? "grid grid-cols-1 md:grid-cols-5 gap-3" : "grid grid-cols-1 md:grid-cols-6 gap-3";
  const userNavItems = isAuthenticated
    ? [
        { id: "user-access", label: "Access" },
        { id: "user-search", label: "Search" },
        { id: "user-listings", label: "Listings" },
        { id: "user-payments", label: "My Payments" },
        { id: "user-map", label: "Map" },
        { id: "user-support", label: "Support / FAQ" },
        { id: "user-about", label: "About" }
      ]
    : [{ id: "user-access", label: "Access" }];
  const isAboutOpen = isAuthenticated && activeNav === "user-about";

  if (!isAuthenticated && !hasChosenCountry) {
    return html`
      <div className="page-shell">
        <nav className="glass hero-nav mb-5">
          <h1 className="brand-title">TST PlotConnect</h1>
          <p className="brand-subtitle">Find your ideal accommodation</p>
        </nav>

        <main className="user-main">
          <section className="glass section-card w-full">
            <p className="section-kicker">Step 1 of 2</p>
            <h2 className="section-title">Select Country</h2>
            <p className="text-sm text-slate-300 mb-3">Choose your country to continue to registration or login.</p>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              <div className="combo-single md:col-span-2">
                <input
                  className="input-modern combo-single-input"
                  placeholder="Select country"
                  value=${countryInput}
                  onInput=${(e) => { handleCountryInputChange(e.target.value); setCountryConfirmed(false); }}
                  onFocus=${() => setOpenField("country")}
                  onClick=${() => setOpenField(openField === "country" ? "" : "country")}
                  onBlur=${() => setTimeout(() => setOpenField(""), 120)}
                  autoComplete="off"
                />
                ${renderSuggestions("country", availableCountries, countryInput, (value) => handleCountryInputChange(value))}
              </div>
              <button
                className="btn-success rounded-xl p-3"
                disabled=${!filters.country}
                onClick=${() => {
                  setCountryConfirmed(true);
                  setActiveNav("user-access");
                  showMessage("Country selected. Please register or log in.");
                }}
              >
                Continue
              </button>
            </div>
          </section>
        </main>
      </div>
    `;
  }

  return html`
    <div className="page-shell">
      <nav className="glass hero-nav mb-5">
        <h1 className="brand-title">TST PlotConnect</h1>
        <p className="brand-subtitle">Find your ideal accommodation</p>
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
                href=${item.id === "user-about" ? "#" : (item.href || `#${item.id}`)}
                className=${`sidebar-link ${activeNav === item.id ? "is-active" : ""}`}
                onClick=${(e) => {
                  if (item.id === "user-about") {
                    e.preventDefault();
                  }
                  if (!item.href) {
                    setActiveNav(item.id);
                  }
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
        ${token
          ? html`
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mb-3">
                <div className="input-modern rounded-xl p-3">
                  <p className="text-muted text-xs">User</p>
                  <p className="font-semibold">${userProfile?.name || "Registered User"}</p>
                </div>
                <div className="input-modern rounded-xl p-3">
                  <p className="text-muted text-xs">Phone</p>
                  <p className="font-semibold">${userProfile?.phone || "-"}</p>
                </div>
                <div className="input-modern rounded-xl p-3">
                  <p className="text-muted text-xs">User ID</p>
                  <p className="font-semibold">${userProfile?.displayId || userProfile?.id || "-"}</p>
                </div>
              </div>
              <div className="flex flex-col md:flex-row gap-3">
                ${status && status.active
                  ? null
                  : html`<button className="btn-success rounded-xl p-3" onClick=${pay} disabled=${loading}>Activate Account (Ksh 50)</button>`}
                ${status && status.active
                  ? null
                  : html`<button className="btn-soft rounded-xl p-3" onClick=${confirmPaymentNow} disabled=${confirmingPayment}>
                      ${confirmingPayment ? "Refreshing..." : "Refresh"}
                    </button>`}
                <button className="btn-soft rounded-xl p-3" onClick=${logoutUser}>Log Out</button>
              </div>
            `
          : html`
              <div className="flex gap-2 mb-3">
                <button
                  className=${`btn-chip ${authMode === "register" ? "btn-chip-edit" : ""}`}
                  onClick=${() => setAuthMode("register")}
                >
                  Register
                </button>
                <button
                  className=${`btn-chip ${authMode === "login" ? "btn-chip-edit" : ""}`}
                  onClick=${() => setAuthMode("login")}
                >
                  Login
                </button>
              </div>
              ${authMode === "register"
                ? html`
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                      <input
                        className="input-modern p-3 rounded-xl"
                        placeholder="Full name"
                        value=${registerName}
                        onInput=${(e) => setRegisterName(e.target.value)}
                      />
                      <input
                        className="input-modern p-3 rounded-xl"
                        placeholder="Safaricom phone e.g. 0700..."
                        value=${registerPhone}
                        onInput=${(e) => setRegisterPhone(e.target.value)}
                      />
                      <input
                        type="password"
                        className="input-modern p-3 rounded-xl"
                        placeholder="Password"
                        value=${registerPassword}
                        onInput=${(e) => setRegisterPassword(e.target.value)}
                      />
                      <button className="btn-success rounded-xl p-3 md:col-span-3" onClick=${registerUser} disabled=${loading}>
                        Register & Continue
                      </button>
                    </div>
                  `
                : html`
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                      <input
                        className="input-modern p-3 rounded-xl"
                        placeholder="Safaricom phone"
                        value=${loginPhone}
                        onInput=${(e) => setLoginPhone(e.target.value)}
                      />
                      <input
                        type="password"
                        className="input-modern p-3 rounded-xl"
                        placeholder="Password"
                        value=${loginPassword}
                        onInput=${(e) => setLoginPassword(e.target.value)}
                      />
                      <button className="btn-success rounded-xl p-3" onClick=${loginUser} disabled=${loading}>
                        Login
                      </button>
                    </div>
                    <div className="mt-2 flex flex-wrap items-center gap-3">
                      <button
                        type="button"
                        className="btn-soft rounded-xl p-2 text-sm"
                        onClick=${() => {
                          setShowForgotOptions((v) => !v);
                          setForgotPhone((prev) => prev || loginPhone);
                        }}
                      >
                        Forgot Password?
                      </button>
                    </div>
                    ${showForgotOptions
                      ? html`
                          <div className="mt-3 rounded-xl border border-slate-700/60 bg-slate-900/40 p-3">
                            <p className="text-sm text-slate-200">Reset password with OTP:</p>
                            <div className="mt-2 grid grid-cols-1 md:grid-cols-3 gap-2">
                              <input
                                className="input-modern p-2 rounded-xl"
                                placeholder="Phone e.g. 0700..."
                                value=${forgotPhone}
                                onInput=${(e) => setForgotPhone(e.target.value)}
                              />
                              <button
                                type="button"
                                className="btn-soft rounded-xl p-2 text-sm"
                                onClick=${requestPasswordResetCode}
                                disabled=${forgotBusy}
                              >
                                Send OTP
                              </button>
                              <button
                                type="button"
                                className="btn-soft rounded-xl p-2 text-sm"
                                onClick=${requestPasswordResetCode}
                                disabled=${forgotBusy}
                              >
                                Resend OTP
                              </button>
                            </div>
                            ${forgotStep === "verify"
                              ? html`
                                  <div className="mt-2 grid grid-cols-1 md:grid-cols-3 gap-2">
                                    <input
                                      className="input-modern p-2 rounded-xl"
                                      placeholder="Enter OTP code"
                                      value=${forgotCode}
                                      onInput=${(e) => setForgotCode(e.target.value)}
                                    />
                                    <input
                                      type="password"
                                      className="input-modern p-2 rounded-xl"
                                      placeholder="New password"
                                      value=${forgotNewPassword}
                                      onInput=${(e) => setForgotNewPassword(e.target.value)}
                                    />
                                    <button
                                      type="button"
                                      className="btn-success rounded-xl p-2 text-sm"
                                      onClick=${verifyPasswordResetCode}
                                      disabled=${forgotBusy}
                                    >
                                      Verify OTP & Reset
                                    </button>
                                  </div>
                                `
                              : null}
                            <p className="mt-2 text-xs text-slate-400">
                              ${forgotExpiresAt
                                ? `OTP expires at ${new Date(forgotExpiresAt).toLocaleTimeString()}.`
                                : "Enter your phone and tap Send OTP."}
                            </p>
                            <p className="mt-2 text-xs text-slate-400">
                              Need help? <a href=${`https://wa.me/${SUPPORT_WHATSAPP}?text=${encodeURIComponent(`Hello, I need help resetting my PlotConnect password. Phone: ${(forgotPhone || loginPhone).trim() || "-"}`)}`} target="_blank" rel="noopener noreferrer">WhatsApp Support</a> or <a href=${`tel:${SUPPORT_PHONE}`}>Call Support</a>.
                            </p>
                          </div>
                        `
                      : null}
                  `}
            `}
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

      ${isAuthenticated
        ? html`
      ${!isAboutOpen
        ? html`
      <section id="user-search" className="glass section-card mb-5">
        <p className="section-kicker">Filter</p>
        <h2 className="section-title">Search By Location</h2>
            <div className=${searchGridClass}>
              ${hasLockedCountryFilter
                ? null
                : html`
                    <div className="combo-single">
                      <input
                        className="input-modern combo-single-input"
                        placeholder="All Countries"
                        value=${countryInput}
                        onInput=${(e) => {
                          const v = e.target.value;
                          setCountryInput(v);
                          setCountryConfirmed(false);
                          debouncedFetchCountries(v);
                          setFilters((prev) => {
                            if (!v) return { ...prev, country: "", county: "", area: "" };
                            const match = availableCountries.find((c) => String(c).toLowerCase() === v.toLowerCase());
                            return { ...prev, country: match || "", county: "", area: "" };
                          });
                        }}
                        onFocus=${() => { setOpenField("country"); debouncedFetchCountries(countryInput || ""); }}
                        onClick=${() => { setOpenField(openField === "country" ? "" : "country"); debouncedFetchCountries(countryInput || ""); }}
                        onBlur=${() => setTimeout(() => setOpenField(""), 120)}
                        autoComplete="off"
                      />
                      ${renderSuggestions("country", remoteCountries.length ? remoteCountries : availableCountries, countryInput, (value) => { handleCountryInputChange(value); setRemoteCounties([]); debouncedFetchCounties(value, ""); })}
                    </div>
                  `}
              <div className="combo-single">
                <input
                  className="input-modern combo-single-input"
                  placeholder="All Counties"
                  value=${countyInput}
                  onInput=${(e) => {
                    const v = e.target.value;
                    setCountyInput(v);
                    // fetch remote counties for selected country
                    const country = filters.country || countryInput;
                    debouncedFetchCounties(country, v);
                    setFilters((prev) => {
                      if (!v) return { ...prev, county: "", area: "" };
                      const match = (meta.countiesByCountry?.[country] || []).find((c) => String(c).toLowerCase() === v.toLowerCase());
                      return { ...prev, county: match || "", area: "" };
                    });
                  }}
                  onFocus=${() => { setOpenField("county"); debouncedFetchCounties(filters.country || countryInput, countyInput || ""); }}
                  onClick=${() => { setOpenField(openField === "county" ? "" : "county"); debouncedFetchCounties(filters.country || countryInput, countyInput || ""); }}
                  onBlur=${() => setTimeout(() => setOpenField(""), 120)}
                  autoComplete="off"
                />
                ${renderSuggestions("county", remoteCounties.length ? remoteCounties : counties, countyInput, (value) => { handleCountyInputChange(value); debouncedFetchAreas(value, ""); })}
              </div>
              <div className="combo-single">
                <input
                  className="input-modern combo-single-input"
                  placeholder="Type or select area"
                  value=${areaInput}
                  onInput=${(e) => {
                    const v = e.target.value;
                    setAreaInput(v);
                    const county = filters.county || countyInput;
                    debouncedFetchAreas(county, v);
                    setFilters((prev) => {
                      if (!v) return { ...prev, area: "" };
                      const match = (meta.areasByCounty?.[county] || []).find((a) => String(a).toLowerCase() === v.toLowerCase());
                      return { ...prev, area: match || "" };
                    });
                  }}
                  onFocus=${() => { setOpenField("area"); debouncedFetchAreas(filters.county || countyInput, areaInput || ""); }}
                  onClick=${() => { setOpenField(openField === "area" ? "" : "area"); debouncedFetchAreas(filters.county || countyInput, areaInput || ""); }}
                  onBlur=${() => setTimeout(() => setOpenField(""), 120)}
                  autoComplete="off"
                />
                ${renderSuggestions("area", remoteAreas.length ? remoteAreas : areas, areaInput, (value) => { handleAreaInputChange(value); })}
              </div>
              <div className="combo-single">
                <input
                  className="input-modern combo-single-input"
                  placeholder="All Categories"
                  value=${categoryInput}
                  onInput=${(e) => handleCategoryInputChange(e.target.value)}
                  onFocus=${() => setOpenField("category")}
                  onClick=${() => setOpenField(openField === "category" ? "" : "category")}
                  onBlur=${() => setTimeout(() => setOpenField(""), 120)}
                  autoComplete="off"
                />
                ${renderSuggestions(
                  "category",
                  [
                    "Rental Houses",
                    "Bedsitters",
                    "Hostels",
                    "Apartments",
                    "Lodges",
                    "AirBnB",
                    "Vacant Shops",
                    "Office Spaces",
                    "Guest Houses",
                    "Plots for Sale"
                  ],
                  categoryInput,
                  (value) => handleCategoryInputChange(value)
                )}
              </div>
              <input
                className="input-modern p-3 rounded-xl"
                type="number"
            inputMode="numeric"
            min="0"
            placeholder="Min price"
            value=${filters.minPrice}
            onInput=${(e) => setFilters({ ...filters, minPrice: e.target.value })}
          />
          <input
            className="input-modern p-3 rounded-xl"
            type="number"
            inputMode="numeric"
            min="0"
            placeholder="Max price"
            value=${filters.maxPrice}
            onInput=${(e) => setFilters({ ...filters, maxPrice: e.target.value })}
          />
        </div>
      </section>

      <section id="user-listings" className="mb-5">
        <div className="flex items-end justify-between mb-3">
          <div>
            <p className="section-kicker">Listings</p>
            <h2 className="section-title mb-0">Available Plots</h2>
            <p className="text-xs text-muted">Active filters: ${getActiveFiltersLabel()}</p>
          </div>
          <div className="flex items-center gap-2">
            <p className="text-xs text-muted">${orderedPlots.length} result${orderedPlots.length === 1 ? "" : "s"}</p>
            <button className="btn-soft px-3 py-1 rounded-lg" onClick=${clearFilters}>Clear Filters</button>
          </div>
        </div>

        ${loading
          ? html`<p className="text-slate-300">Loading plots...</p>`
          : html`
              ${(["top", "medium", "bottom"]).map((tier) => {
                const rows = groupedPlots[tier] || [];
                if (!rows.length) return null;
                return html`
                  <div className="mb-4">
                    <div className="plot-grid">
                      ${rows.map((plot, idx) => html`
                      ${(() => {
                          const mediaUnlocked = !!(status && status.active);
                          const caretakerDisplay = mediaUnlocked
                            ? (plot.caretaker && plot.caretaker !== "Locked" ? plot.caretaker : "0756734298")
                            : "Locked";
                          const whatsappDisplay = mediaUnlocked
                            ? (plot.whatsapp && plot.whatsapp !== "Locked" ? plot.whatsapp : "0756734298")
                            : "Locked";
                          const contactPhone = caretakerDisplay !== "Locked" ? caretakerDisplay : whatsappDisplay;
                          const whatsappPhone = formatPhoneForWhatsApp(contactPhone);
                          const callPhone = formatPhoneForTel(contactPhone);
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
                          ${mediaUnlocked
                            ? html`
                                <p className="mt-2 text-sm">Caretaker: ${contactPhone}</p>
                                <div className="mt-2 flex flex-wrap gap-2">
                                  <a
                                    className="rounded-lg px-3 py-2 text-xs font-semibold text-white bg-emerald-600 hover:bg-emerald-700"
                                    href=${whatsappPhone ? `https://wa.me/${whatsappPhone}` : "#"}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    onClick=${(e) => {
                                      e.stopPropagation();
                                      if (!whatsappPhone) e.preventDefault();
                                    }}
                                  >
                                    whatsapp
                                  </a>
                                  <a
                                    className="rounded-lg px-3 py-2 text-xs font-semibold text-white bg-blue-600 hover:bg-blue-700"
                                    href=${callPhone ? `tel:${callPhone}` : "#"}
                                    onClick=${(e) => {
                                      e.stopPropagation();
                                      if (!callPhone) e.preventDefault();
                                    }}
                                  >
                                    phone
                                  </a>
                                </div>
                              `
                            : html`<p className="mt-2 text-sm text-amber-700">Contacts hidden until account activation.</p>`}
                        </article>
                      `})()}
                      `)}
                    </div>
                  </div>
                `;
              })}
            `}
      </section>

      <section id="user-map" className="glass section-card mb-2">
        <p className="section-kicker">Map</p>
        <h2 className="section-title">Selected Plot Location</h2>
        <${MapLibreMap}
          centerLngLat=${selectedCoords}
          markerLabel=${selectedLabel}
          enableFocusZoom=${!!selectedPlotId}
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
                      <button
                        type="button"
                        className="btn-chip btn-chip-danger"
                        onClick=${() => hidePaymentInUi(p.id)}
                        aria-label="Remove payment from view"
                      >
                        Delete
                      </button>
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
            <p className="faq-a">Register or log in first. Then tap Activate Account to receive the STK prompt on your phone.</p>
          </div>
          <div className="faq-item">
            <p className="faq-q">How long does access last?</p>
            <p className="faq-a">Access lasts for 24 hours after successful payment confirmation.</p>
          </div>
          <div className="faq-item">
            <p className="faq-q">What if payment is delayed?</p>
            <p className="faq-a">Wait for the STK confirmation on your registered phone. The status will update automatically.</p>
          </div>
        </div>
      </section>
          `
        : null}

      ${isAboutOpen
        ? html`
            <section id="user-about" className="glass section-card mb-2">
              <div className="flex items-center justify-between mb-3">
                <div>
                  <p className="section-kicker">About</p>
                  <h2 className="section-title mb-0">About TST PlotConnect</h2>
                </div>
                <button
                  type="button"
                  className="btn-soft rounded-xl px-3 py-2"
                  onClick=${() => setActiveNav("user-access")}
                >
                  Close About
                </button>
              </div>
              <iframe
                src="/about"
                title="About TST PlotConnect"
                className="w-full rounded-xl border border-slate-700/60"
                style=${{ minHeight: "75vh", background: "#fff" }}
              ></iframe>
            </section>
          `
        : null}

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
            <p className="footer-note">0768622994</p>
            <div className="footer-social" aria-label="Social links">
              <a href="https://web.facebook.com/profile.php?id=61586345377148" target="_blank" rel="noopener noreferrer" className="social-icon" aria-label="Facebook">
                <svg viewBox="0 0 24 24" role="img" aria-hidden="true">
                  <path fill="currentColor" d="M13.5 8.5V6.8c0-.8.5-1.3 1.4-1.3h1.6V2.4h-2.8C10.9 2.4 9.7 4 9.7 6.4v2.1H7.3v3.2h2.4v9h3.8v-9h2.7l.4-3.2h-3.1z"/>
                </svg>
              </a>
              <a href="https://www.instagram.com/techswifttrix/?hl=en" target="_blank" rel="noopener noreferrer" className="social-icon" aria-label="Instagram">
                <svg viewBox="0 0 24 24" role="img" aria-hidden="true">
                  <path fill="currentColor" d="M7.5 2h9A5.5 5.5 0 0 1 22 7.5v9a5.5 5.5 0 0 1-5.5 5.5h-9A5.5 5.5 0 0 1 2 16.5v-9A5.5 5.5 0 0 1 7.5 2zm0 1.8A3.7 3.7 0 0 0 3.8 7.5v9a3.7 3.7 0 0 0 3.7 3.7h9a3.7 3.7 0 0 0 3.7-3.7v-9a3.7 3.7 0 0 0-3.7-3.7h-9zm9.3 1.4a1.1 1.1 0 1 1 0 2.2 1.1 1.1 0 0 1 0-2.2zM12 7a5 5 0 1 1 0 10 5 5 0 0 1 0-10zm0 1.8A3.2 3.2 0 1 0 12 15.2 3.2 3.2 0 0 0 12 8.8z"/>
                </svg>
              </a>
              <a href="https://wa.me/254768622994" target="_blank" rel="noopener noreferrer" className="social-icon" aria-label="WhatsApp">
                <svg viewBox="0 0 24 24" role="img" aria-hidden="true">
                  <path fill="currentColor" d="M20.5 3.5A11 11 0 0 0 3.2 16.7L2 22l5.4-1.2A11 11 0 1 0 20.5 3.5zM12 20a8.8 8.8 0 0 1-4.5-1.2l-.3-.2-3.2.7.7-3.1-.2-.3A8.8 8.8 0 1 1 12 20zm4.8-6.6c-.3-.1-1.7-.8-2-.9-.3-.1-.5-.1-.7.2l-.6.9c-.2.3-.4.3-.7.1a7.3 7.3 0 0 1-3.6-3.2c-.2-.3 0-.5.1-.7l.5-.6c.2-.2.2-.4.3-.6l-.5-1.3c-.1-.3-.3-.3-.5-.3h-.5c-.2 0-.6.1-.9.4-.3.3-1.1 1.1-1.1 2.7s1.1 3 1.2 3.2c.2.2 2.2 3.4 5.4 4.7.8.3 1.4.5 1.9.6.8.2 1.5.2 2.1.1.6-.1 1.7-.7 2-1.4.2-.7.2-1.2.1-1.3-.1-.1-.3-.2-.6-.3z"/>
                </svg>
              </a>
            </div>
          </div>
        </div>
        <div className="footer-bottom">
          <p className="footer-copy">(c) ${currentYear} TST PlotConnect. All rights reserved. A TechSwiftTrix platform.</p>
          <a href="#user-access" className="back-to-top">Back to top</a>
        </div>
      </footer>
      `
        : null}
        </div>
      </main>
    </div>
  `;
}

createRoot(document.getElementById("app")).render(html`<${App} />`);
