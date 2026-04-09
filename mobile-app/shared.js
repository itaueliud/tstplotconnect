export const DEFAULT_API_BASE = "https://tstplotconnect-2.onrender.com";
export const SUPPORT_PHONE = "0768622994";
export const SUPPORT_WHATSAPP = "254768622994";

export const LISTING_CATEGORIES = [
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
];

export const SUPPORTED_COUNTRIES = ["Kenya", "Uganda", "Tanzania", "Rwanda"];

const LOCAL_HOST_PATTERN = /^(localhost|127\.0\.0\.1|192\.168\.\d{1,3}\.\d{1,3}|10\.\d{1,3}\.\d{1,3}\.\d{1,3}|172\.(1[6-9]|2\d|3[0-1])\.\d{1,3}\.\d{1,3})$/i;
const LOCAL_HTTP_PATTERN = /^http:\/\/(localhost|127\.0\.0\.1|192\.168\.\d{1,3}\.\d{1,3}|10\.\d{1,3}\.\d{1,3}\.\d{1,3}|172\.(1[6-9]|2\d|3[0-1])\.\d{1,3}\.\d{1,3})(:\d+)?$/i;

export function isLocalHostName(hostname = "") {
  return LOCAL_HOST_PATTERN.test(String(hostname || "").trim());
}

export function inferApiBase(runtimeApiBase = DEFAULT_API_BASE, options = {}) {
  const locationObject = options.locationObject ?? (typeof window !== "undefined" ? window.location : null);
  const storageObject = options.storageObject ?? (typeof localStorage !== "undefined" ? localStorage : null);

  if (!locationObject) return runtimeApiBase;

  const isLocal = locationObject.protocol === "file:" || isLocalHostName(locationObject.hostname);
  if (isLocal) {
    try {
      storageObject?.removeItem("apiBase");
    } catch (_err) {}
    return runtimeApiBase;
  }

  let saved = "";
  try {
    saved = storageObject?.getItem("apiBase") || "";
  } catch (_err) {
    saved = "";
  }

  if (saved) {
    const savedIsLocal = LOCAL_HTTP_PATTERN.test(saved);
    const savedIsHttp = /^http:\/\//i.test(saved);
    if (savedIsLocal || savedIsHttp) {
      return runtimeApiBase;
    }
  }

  return saved || runtimeApiBase;
}

export function formatPhoneForWhatsApp(phone) {
  const digits = String(phone || "").replace(/\D/g, "");
  if (!digits) return "";
  if (digits.startsWith("0")) return `254${digits.slice(1)}`;
  if (digits.startsWith("254")) return digits;
  return digits;
}

export function formatPhoneForTel(phone) {
  const digits = String(phone || "").replace(/\D/g, "");
  if (!digits) return "";
  if (digits.startsWith("0")) return `+254${digits.slice(1)}`;
  if (digits.startsWith("254")) return `+${digits}`;
  return `+${digits}`;
}

export function normalizePriority(plot) {
  const raw = String(plot?.priority || plot?.priorityLevel || plot?.tier || "").toLowerCase().trim();
  if (["top", "high", "vip", "featured"].includes(raw)) return "top";
  if (["bottom", "low"].includes(raw)) return "bottom";
  return "medium";
}

export function sortByPriority(rows) {
  const order = { top: 0, medium: 1, bottom: 2 };
  return [...rows].sort((a, b) => {
    const diff = order[normalizePriority(a)] - order[normalizePriority(b)];
    return diff !== 0 ? diff : 0;
  });
}

export function buildPlotsQuery(filters = {}) {
  const query = new URLSearchParams();
  const entries = [
    ["country", filters.country],
    ["county", filters.county],
    ["area", filters.area],
    ["category", filters.category],
    ["minPrice", filters.minPrice],
    ["maxPrice", filters.maxPrice]
  ];

  entries.forEach(([key, value]) => {
    const normalized = String(value ?? "").trim();
    if (normalized) query.set(key, normalized);
  });

  return query;
}

export function buildPlotsUrl(apiBase, filters = {}) {
  const query = buildPlotsQuery(filters);
  const suffix = query.toString() ? `?${query.toString()}` : "";
  return `${String(apiBase || DEFAULT_API_BASE).replace(/\/+$/, "")}/api/plots${suffix}`;
}
