const path = require("path");
const { randomUUID, randomInt, createHash } = require("crypto");
require("dotenv").config({ path: path.join(__dirname, "..", ".env") });
const express = require("express");
const cors = require("cors");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const { initDb, getDb } = require("./db");
const { signToken, requireAuth, requireAdmin, requireSuperAdmin } = require("./auth");
const { normalizePhone, initiateStkPush, isDarajaConfigured } = require("./daraja");

const app = express();
const PORT = Number(process.env.PORT) || 10000;
const HOST = process.env.HOST || "0.0.0.0";
const JWT_SECRET = process.env.JWT_SECRET || "tstplotconnect-dev-secret";
const PAYMENT_MODE = (process.env.PAYMENT_MODE || "mock").toLowerCase();
const TEMP_FREE_ACCESS = (process.env.TEMP_FREE_ACCESS || "false").toLowerCase() === "true";
const TEMP_FREE_ACCESS_DAYS = Math.max(1, Number(process.env.TEMP_FREE_ACCESS_DAYS || 28));
const GOOGLE_MAPS_API_KEY = process.env.GOOGLE_MAPS_API_KEY || "";
const REQUIRE_HTTPS_ADMIN = (process.env.REQUIRE_HTTPS_ADMIN || "false").toLowerCase() === "true";
const ADMIN_MAX_LOGIN_ATTEMPTS = Number(process.env.ADMIN_MAX_LOGIN_ATTEMPTS || 5);
const ADMIN_LOCK_MINUTES = Number(process.env.ADMIN_LOCK_MINUTES || 15);
const OTP_TTL_MINUTES = Number(process.env.OTP_TTL_MINUTES || 10);
const OTP_RESEND_SECONDS = Number(process.env.OTP_RESEND_SECONDS || 60);
const OTP_MAX_ATTEMPTS = Number(process.env.OTP_MAX_ATTEMPTS || 5);
const OTP_DEBUG_RESPONSE = (process.env.OTP_DEBUG_RESPONSE || "false").toLowerCase() === "true";
const SMS_MODE = (process.env.SMS_MODE || "mock").toLowerCase();
const AFRICASTALKING_API_KEY = String(process.env.AFRICASTALKING_API_KEY || "").trim();
const AFRICASTALKING_USERNAME = String(process.env.AFRICASTALKING_USERNAME || "sandbox").trim();
const AFRICASTALKING_SENDER_ID = String(process.env.AFRICASTALKING_SENDER_ID || "").trim();
const MONGODB_RETRY_DELAY_MS = Math.max(1000, Number(process.env.MONGODB_RETRY_DELAY_MS || 5000));
const EXTRA_ALLOWED_ORIGINS = String(process.env.EXTRA_ALLOWED_ORIGINS || "")
  .split(",")
  .map((origin) => origin.trim())
  .filter(Boolean);
const ALLOWED_CATEGORIES = new Set([
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
]);

const ALLOWED_ORIGINS = new Set([
  "https://tstplotconnect.vercel.app",
  "https://tstplotsconnect.vercel.app",
  "https://tstplotconnect-admin.vercel.app",
  "https://tstplotsconnect-admin.vercel.app",
  "https://tstplotconnect-84rw.vercel.app",
  "https://tstplotsconnect-84rw.vercel.app",
  "https://tst-plotconnect.com",
  "https://www.tst-plotconnect.com",
  "https://tstplotconnect.com",
  "https://www.tstplotconnect.com",
  "https://tstplotsconnect.com",
  "https://www.tstplotsconnect.com",
  "http://localhost:5500",
  "http://localhost:5501",
  "http://localhost:5502",
  "http://localhost:5503",
  "http://127.0.0.1:5500",
  "http://127.0.0.1:5501",
  "http://127.0.0.1:5502",
  "http://127.0.0.1:5503"
]);

let dbReady = false;
let dbInitAttempts = 0;

for (const origin of EXTRA_ALLOWED_ORIGINS) {
  ALLOWED_ORIGINS.add(origin);
}

function isPrivateLanOrigin(origin) {
  return /^https?:\/\/(192\.168\.\d{1,3}\.\d{1,3}|10\.\d{1,3}\.\d{1,3}\.\d{1,3}|172\.(1[6-9]|2\d|3[0-1])\.\d{1,3}\.\d{1,3})(:\d+)?$/i.test(origin);
}

function isTrustedVercelOrigin(origin) {
  return /^https:\/\/tstplots?connect([a-z0-9-]*)\.vercel\.app$/i.test(origin);
}

app.use(cors({
  origin(origin, callback) {
    if (!origin) return callback(null, true);
    if (ALLOWED_ORIGINS.has(origin) || isPrivateLanOrigin(origin) || isTrustedVercelOrigin(origin)) {
      return callback(null, true);
    }
    return callback(new Error("Not allowed by CORS"));
  },
  methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
  allowedHeaders: ["Content-Type", "Authorization"],
  credentials: true
}));

// Ensure CORS headers are always sent back for allowed origins (including errors)
app.use((req, res, next) => {
  const origin = req.headers.origin;
  if (origin && (ALLOWED_ORIGINS.has(origin) || isPrivateLanOrigin(origin) || isTrustedVercelOrigin(origin))) {
    res.setHeader("Access-Control-Allow-Origin", origin);
    res.setHeader("Access-Control-Allow-Credentials", "true");
  }
  next();
});

app.options("*", cors());
app.use(express.json());

app.use((req, res, next) => {
  if (dbReady) {
    return next();
  }

  const isHealthRoute = req.path === "/api/health" || req.path === "/";
  const isPublicConfigRoute = req.path === "/api/public/config";
  if (isHealthRoute || isPublicConfigRoute) {
    return next();
  }

  return res.status(503).json({
    error: "Service temporarily unavailable. Database is still connecting.",
    dbReady: false
  });
});

function usersCol() {
  return getDb().collection("users");
}

function plotsCol() {
  return getDb().collection("plots");
}

function paymentsCol() {
  return getDb().collection("payments");
}

function blogsCol() {
  return getDb().collection("blogs");
}

function locationMetadataCol() {
  return getDb().collection("location_metadata");
}

function otpCodesCol() {
  return getDb().collection("otp_codes");
}

function accountDeletionRequestsCol() {
  return getDb().collection("account_deletion_requests");
}

async function getLocationMetadata() {
  const meta = await locationMetadataCol().findOne({ key: "default" });
  if (meta) {
    const normalized = normalizeLocationMetadata(meta);
    if (normalized.changed) {
      await locationMetadataCol().updateOne(
        { key: "default" },
        { $set: normalized.value, $setOnInsert: { key: "default", createdAt: new Date() } },
        { upsert: true }
      );
    }
    return normalized.value;
  }
  return {
    countries: ["Kenya", "Tanzania", "Uganda", "Ethiopia"],
    countiesByCountry: { Kenya: ["Machakos", "Makueni", "Nairobi", "Kajiado"], Tanzania: [], Uganda: [], Ethiopia: [] },
    areasByCounty: {
      Machakos: [
        "Katoloni",
        "Diaspora",
        "CP",
        "Queens",
        "Kathemboni",
        "eastleigh",
        "Katungo",
        "Mutituni",
        "Muthini",
        "Kathaleyoni",
        "Machakos Town Centre",
        "Miwani",
        "Kenya Israel"
      ],
      Makueni: [],
      Nairobi: [],
      Kajiado: []
    }
  };
}

async function syncPlotLocationMetadata(country, county, area) {
  const countryName = String(country || "").trim() || "Kenya";
  const countyName = String(county || "").trim();
  const areaName = String(area || "").trim();
  if (!countyName) return;

  const meta = await getLocationMetadata();
  const countries = new Set(Array.isArray(meta.countries) ? meta.countries : []);
  countries.add(countryName);

  const countiesByCountry = { ...(meta.countiesByCountry || {}) };
  const countySet = new Set(Array.isArray(countiesByCountry[countryName]) ? countiesByCountry[countryName] : []);
  countySet.add(countyName);
  countiesByCountry[countryName] = Array.from(countySet).sort((a, b) => a.localeCompare(b));

  const areasByCounty = { ...(meta.areasByCounty || {}) };
  const areaSet = new Set(Array.isArray(areasByCounty[countyName]) ? areasByCounty[countyName] : []);
  if (areaName) {
    areaSet.add(areaName);
  }
  areasByCounty[countyName] = Array.from(areaSet).sort((a, b) => a.localeCompare(b));

  await locationMetadataCol().updateOne(
    { key: "default" },
    {
      $set: {
        countries: Array.from(countries),
        countiesByCountry,
        areasByCounty,
        updatedAt: new Date()
      },
      $setOnInsert: { key: "default", createdAt: new Date() }
    },
    { upsert: true }
  );
}

function normalizeLocationMetadata(meta) {
  const countries = Array.isArray(meta.countries) ? meta.countries : [];
  const countiesByCountry = meta.countiesByCountry && typeof meta.countiesByCountry === "object"
    ? meta.countiesByCountry
    : {};
  const areasByCounty = meta.areasByCounty && typeof meta.areasByCounty === "object"
    ? meta.areasByCounty
    : {};

  let changed = false;

  if (Array.isArray(countiesByCountry.Kenya)) {
    const kenya = countiesByCountry.Kenya.map((c) => (String(c).trim() === "KITUI COUNTY" ? "kitui county" : c));
    if (kenya.join("|") !== countiesByCountry.Kenya.join("|")) {
      countiesByCountry.Kenya = kenya;
      changed = true;
    }
  }

  if (Array.isArray(countiesByCountry.Ethiopia)) {
    const filtered = countiesByCountry.Ethiopia.filter((c) => String(c).trim().toLowerCase() !== "taita taveta county");
    if (filtered.length !== countiesByCountry.Ethiopia.length) {
      countiesByCountry.Ethiopia = filtered;
      changed = true;
    }
  }

  if (changed) {
    return {
      changed: true,
      value: {
        countries,
        countiesByCountry,
        areasByCounty,
        updatedAt: new Date()
      }
    };
  }

  return {
    changed: false,
    value: {
      countries,
      countiesByCountry,
      areasByCounty
    }
  };
}

function mapPlot(plot, unlocked) {
  const county = plot.county || plot.town || "";
  return {
    id: plot.id,
    title: plot.title,
    price: plot.price,
    category: plot.category || "",
    country: plot.country || "Kenya",
    county,
    town: county,
    area: plot.area,
    description: plot.description || "",
    images: Array.isArray(plot.images) ? plot.images : [],
    videos: Array.isArray(plot.videos) ? plot.videos : [],
    lat: typeof plot.lat === "number" ? plot.lat : null,
    lng: typeof plot.lng === "number" ? plot.lng : null,
    mapLink: plot.mapLink || "",
    priority: plot.priority || "medium",
    createdAt: plot.createdAt || null,
    updatedAt: plot.updatedAt || plot.createdAt || null,
    caretaker: unlocked ? plot.caretaker : "Locked",
    whatsapp: unlocked ? plot.whatsapp : "Locked",
    unlocked
  };
}

function toOptionalNumber(value) {
  if (value === null || value === undefined || value === "") return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function escapeRegex(value) {
  return String(value).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function isRequestSecure(req) {
  const forwardedProto = req.headers["x-forwarded-proto"];
  if (typeof forwardedProto === "string" && forwardedProto.split(",")[0].trim() === "https") {
    return true;
  }
  return req.secure || req.protocol === "https";
}

function requireSecureAdmin(req, res, next) {
  if (!REQUIRE_HTTPS_ADMIN) {
    return next();
  }
  if (!isRequestSecure(req)) {
    return res.status(403).json({ error: "HTTPS required for admin operations" });
  }
  return next();
}

async function getUserActiveActivation(userId) {
  const now = new Date();
  return paymentsCol().findOne(
    { userId: String(userId), status: "Completed", expiresAt: { $gt: now } },
    { sort: { timestamp: -1, _id: -1 } }
  );
}

async function syncUserActivationStatus(userId, payment) {
  if (!payment) {
    await usersCol().updateOne(
      { id: userId },
      { $set: { activatedAt: null, expiresAt: null, paymentStatus: false } }
    );
    return;
  }
  await usersCol().updateOne(
    { id: userId },
    {
      $set: {
        activatedAt: payment.activatedAt || null,
        expiresAt: payment.expiresAt || null,
        paymentStatus: payment.status === "Completed"
      }
    }
  );
}

async function syncUserActivationStatusToLatest(userId) {
  const latestActive = await getUserActiveActivation(userId);
  await syncUserActivationStatus(userId, latestActive || null);
}

async function getUnlockedFromRequest(req) {
  if (TEMP_FREE_ACCESS) return true;
  const authHeader = req.headers.authorization || "";
  const [type, token] = authHeader.split(" ");
  if (type !== "Bearer" || !token) {
    return false;
  }
  try {
    const payload = jwt.verify(token, JWT_SECRET);
    const active = await getUserActiveActivation(payload.id);
    if (active) return true;
    const user = await usersCol().findOne(
      { id: String(payload.id) },
      { projection: { expiresAt: 1, paymentStatus: 1 } }
    );
    if (user && user.paymentStatus && user.expiresAt) {
      const expMs = new Date(user.expiresAt).getTime();
      if (expMs > Date.now()) return true;
    }
    return false;
  } catch (_err) {
    return false;
  }
}

function generateTemporaryPassword(length = 10) {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789";
  let out = "";
  for (let i = 0; i < length; i += 1) {
    out += chars[Math.floor(Math.random() * chars.length)];
  }
  return out;
}

async function generateUserDisplayId() {
  const users = usersCol();
  for (let i = 0; i < 10; i += 1) {
    const candidate = `U${Math.floor(100000 + Math.random() * 900000)}`;
    const exists = await users.findOne({ displayId: candidate }, { projection: { _id: 1 } });
    if (!exists) return candidate;
  }
  return `U${Date.now().toString().slice(-6)}`;
}

function getPhoneVariants(phoneInput) {
  const raw = String(phoneInput || "").trim();
  const digits = raw.replace(/\D/g, "");
  const variants = new Set();
  if (raw) variants.add(raw);

  if (digits) variants.add(digits);
  if (digits.startsWith("0") && digits.length === 10) {
    variants.add(`254${digits.slice(1)}`);
    variants.add(digits);
  } else if (digits.startsWith("254") && digits.length === 12) {
    variants.add(`0${digits.slice(3)}`);
    variants.add(digits);
  } else if (digits.startsWith("7") && digits.length === 9) {
    variants.add(`0${digits}`);
    variants.add(`254${digits}`);
  }

  return Array.from(variants);
}

function canonicalPhone(phoneInput) {
  const variants = getPhoneVariants(phoneInput);
  const normalized = variants.find((p) => /^254\d{9}$/.test(p));
  return normalized || variants[0] || String(phoneInput || "").trim();
}

function hashOtpCode(phone, code) {
  return createHash("sha256").update(`${phone}:${code}:${JWT_SECRET}`).digest("hex");
}

function generateOtpCode() {
  return String(randomInt(0, 1000000)).padStart(6, "0");
}

function isSmsConfigured() {
  if (SMS_MODE !== "africastalking") return true;
  return Boolean(AFRICASTALKING_API_KEY && AFRICASTALKING_USERNAME);
}

async function sendOtpSms(phone, code) {
  if (SMS_MODE !== "africastalking") {
    return { mode: "mock" };
  }

  if (!isSmsConfigured()) {
    throw new Error("SMS service not configured");
  }

  const message = `Your TST PlotConnect reset code is ${code}. It expires in ${OTP_TTL_MINUTES} minutes.`;
  const body = new URLSearchParams({
    username: AFRICASTALKING_USERNAME,
    to: `+${phone}`,
    message
  });
  if (AFRICASTALKING_SENDER_ID) {
    body.set("from", AFRICASTALKING_SENDER_ID);
  }

  const response = await fetch("https://api.africastalking.com/version1/messaging", {
    method: "POST",
    headers: {
      apiKey: AFRICASTALKING_API_KEY,
      Accept: "application/json",
      "Content-Type": "application/x-www-form-urlencoded"
    },
    body: body.toString()
  });

  const raw = await response.text();
  let data = {};
  try {
    data = raw ? JSON.parse(raw) : {};
  } catch (_err) {
    data = {};
  }
  const recipients = data?.SMSMessageData?.Recipients;
  const firstRecipient = Array.isArray(recipients) ? recipients[0] : null;
  const status = String(firstRecipient?.status || "").toLowerCase();
  const accepted = status.includes("success");
  if (!response.ok || !accepted) {
    const details = firstRecipient?.status
      || data?.SMSMessageData?.Message
      || data?.errorMessage
      || data?.error
      || raw
      || JSON.stringify(data);
    throw new Error(`Failed to send OTP SMS: ${details} (status ${response.status})`);
  }

  return { mode: "africastalking" };
}

function slugify(input) {
  return String(input || "")
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9\s-]/g, "")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-+|-+$/g, "");
}

async function createUserIfMissing(phone) {
  const existing = await usersCol().findOne({ phone });
  if (existing) {
    return existing;
  }

  const user = {
    id: randomUUID(),
    displayId: await generateUserDisplayId(),
    phone,
    name: "",
    password: null,
    is_admin: 0,
    is_super_admin: 0,
    role: "user",
    failedLoginAttempts: 0,
    lockUntil: null,
    activatedAt: null,
    expiresAt: null,
    paymentStatus: false,
    createdAt: new Date()
  };
  await usersCol().insertOne(user);
  return user;
}

app.get("/api/health", (_req, res) => {
  const statusCode = dbReady ? 200 : 503;
  res.status(statusCode).json({
    ok: dbReady,
    dbReady,
    mongoRetryDelayMs: MONGODB_RETRY_DELAY_MS,
    dbInitAttempts
  });
});

app.get("/", (_req, res) => {
  res.json({ ok: true, message: "API only. Use /api/* routes." });
});

app.get("/api/public/config", (_req, res) => {
  res.json({
    googleMapsApiKey: GOOGLE_MAPS_API_KEY
  });
});

app.post("/api/account-deletion-request", async (req, res) => {
  const { name, phone, email, reason, source } = req.body || {};
  const trimmedName = String(name || "").trim();
  const trimmedPhone = String(phone || "").trim();
  const trimmedEmail = String(email || "").trim();
  const trimmedReason = String(reason || "").trim();
  const trimmedSource = String(source || "web").trim().toLowerCase();

  if (!trimmedName || trimmedName.length < 2) {
    return res.status(400).json({ error: "Full name is required." });
  }
  if (!trimmedPhone) {
    return res.status(400).json({ error: "Phone number is required." });
  }

  const normalizedPhone = canonicalPhone(trimmedPhone);
  const existingUser = await usersCol().findOne(
    { phone: { $in: getPhoneVariants(normalizedPhone) } },
    { projection: { id: 1, phone: 1, name: 1 } }
  );

  const requestDoc = {
    id: randomUUID(),
    name: trimmedName,
    phone: normalizedPhone,
    email: trimmedEmail || "",
    reason: trimmedReason || "",
    source: trimmedSource || "web",
    userId: existingUser?.id || "",
    matchedUserPhone: existingUser?.phone || "",
    status: "Pending",
    createdAt: new Date()
  };

  await accountDeletionRequestsCol().insertOne(requestDoc);

  return res.status(201).json({
    message: "Your account deletion request has been received. Our team will review and process it."
  });
});

app.post("/api/register", (_req, res) => {
  return res.status(410).json({
    error: "Registration disabled. Use /api/user/session."
  });
});

app.post("/api/user/session", async (req, res) => {
  return res.status(410).json({
    error: "User session endpoint deprecated. Please register or log in."
  });
});

app.post("/api/user/register", async (req, res) => {
  const { name, country, phone, password } = req.body || {};
  if (!name || String(name).trim().length < 2) {
    return res.status(400).json({ error: "Name is required" });
  }
  if (!phone) {
    return res.status(400).json({ error: "Safaricom phone number is required" });
  }
  if (!password || String(password).length < 4) {
    return res.status(400).json({ error: "Password must be at least 4 characters" });
  }

  let normalizedPhone = "";
  try {
    normalizedPhone = normalizePhone(phone);
  } catch (_err) {
    return res.status(400).json({ error: "Invalid Kenyan phone number" });
  }

  const existing = await usersCol().findOne({ phone: normalizedPhone });
  if (existing && (existing.is_admin || existing.is_super_admin)) {
    return res.status(403).json({ error: "Admin accounts cannot register here." });
  }

  if (existing && existing.password) {
    return res.status(409).json({ error: "Account already exists. Please log in." });
  }

  const displayId = existing?.displayId || await generateUserDisplayId();
  const hash = bcrypt.hashSync(String(password), 10);
  const normalizedCountry = String(country || existing?.country || "Kenya").trim() || "Kenya";

  const userDoc = {
    name: String(name).trim(),
    country: normalizedCountry,
    phone: normalizedPhone,
    password: hash,
    displayId,
    role: "user",
    is_admin: 0,
    is_super_admin: 0,
    failedLoginAttempts: 0,
    lockUntil: null
  };

  let user = existing;
  if (existing) {
    await usersCol().updateOne({ _id: existing._id }, { $set: userDoc });
    user = await usersCol().findOne({ _id: existing._id });
  } else {
    user = {
      id: randomUUID(),
      ...userDoc,
      activatedAt: null,
      expiresAt: null,
      paymentStatus: false,
      createdAt: new Date()
    };
    await usersCol().insertOne(user);
  }

  const token = signToken(user);
  return res.status(201).json({
    token,
    user: {
      id: user.id,
      displayId: user.displayId,
      name: user.name || "",
      country: user.country || "Kenya",
      phone: user.phone,
      isAdmin: !!user.is_admin,
      isSuperAdmin: !!user.is_super_admin,
      role: user.role || "user"
    }
  });
});

app.post("/api/user/login", async (req, res) => {
  const { phone, password } = req.body || {};
  if (!phone || !password) {
    return res.status(400).json({ error: "Phone and password are required" });
  }

  const variants = getPhoneVariants(phone);
  const user = await usersCol().findOne({ phone: { $in: variants }, is_admin: 0 });
  if (!user) {
    return res.status(401).json({ error: "Account not found. Please register first." });
  }
  if (!user.password || !bcrypt.compareSync(String(password), user.password)) {
    return res.status(401).json({
      error: "Wrong password. Please try again or use Forgot Password.",
      code: "WRONG_PASSWORD"
    });
  }

  const token = signToken(user);
  return res.json({
    token,
    user: {
      id: user.id,
      displayId: user.displayId || user.id,
      name: user.name || "",
      country: user.country || "Kenya",
      phone: user.phone,
      isAdmin: !!user.is_admin,
      isSuperAdmin: !!user.is_super_admin,
      role: user.role || "user"
    }
  });
});

app.post("/api/auth/request-code", async (req, res) => {
  const { phone } = req.body || {};
  if (!phone) {
    return res.status(400).json({ error: "Phone is required" });
  }

  let normalizedPhone = "";
  try {
    normalizedPhone = normalizePhone(phone);
  } catch (_err) {
    return res.status(400).json({ error: "Invalid Kenyan phone number" });
  }

  const user = await usersCol().findOne({ phone: normalizedPhone, is_admin: 0, is_super_admin: 0 });
  if (!user) {
    return res.status(404).json({ error: "Account not found for this phone number." });
  }

  if (!isSmsConfigured()) {
    return res.status(502).json({ error: "SMS service is not configured." });
  }

  const now = new Date();
  const resendCutoff = new Date(now.getTime() - OTP_RESEND_SECONDS * 1000);
  const existingRecent = await otpCodesCol().findOne(
    {
      phone: normalizedPhone,
      purpose: "password_reset",
      used: false,
      expiresAt: { $gt: now },
      createdAt: { $gte: resendCutoff }
    },
    { sort: { createdAt: -1, _id: -1 } }
  );
  if (existingRecent) {
    const retryAt = existingRecent.createdAt
      ? new Date(existingRecent.createdAt).getTime() + OTP_RESEND_SECONDS * 1000
      : now.getTime() + OTP_RESEND_SECONDS * 1000;
    const retryIn = Math.max(1, Math.ceil((retryAt - now.getTime()) / 1000));
    return res.status(429).json({ error: `Please wait ${retryIn} seconds before requesting another code.` });
  }

  const code = generateOtpCode();
  const expiresAt = new Date(now.getTime() + OTP_TTL_MINUTES * 60 * 1000);

  try {
    await sendOtpSms(normalizedPhone, code);
  } catch (err) {
    return res.status(502).json({ error: err.message || "Failed to send OTP." });
  }

  await otpCodesCol().insertOne({
    id: randomUUID(),
    userId: user.id,
    phone: normalizedPhone,
    purpose: "password_reset",
    codeHash: hashOtpCode(normalizedPhone, code),
    attempts: 0,
    used: false,
    createdAt: now,
    expiresAt
  });

  return res.json({
    message: "OTP sent successfully.",
    expiresAt: expiresAt.toISOString(),
    ...(OTP_DEBUG_RESPONSE ? { otp: code } : {})
  });
});

app.post("/api/auth/verify-code", async (req, res) => {
  const { phone, code, newPassword } = req.body || {};
  if (!phone || !code || !newPassword) {
    return res.status(400).json({ error: "Phone, OTP code, and new password are required." });
  }
  if (String(newPassword).length < 4) {
    return res.status(400).json({ error: "Password must be at least 4 characters." });
  }

  let normalizedPhone = "";
  try {
    normalizedPhone = normalizePhone(phone);
  } catch (_err) {
    return res.status(400).json({ error: "Invalid Kenyan phone number" });
  }

  const now = new Date();
  const otpDoc = await otpCodesCol().findOne(
    {
      phone: normalizedPhone,
      purpose: "password_reset",
      used: false,
      expiresAt: { $gt: now }
    },
    { sort: { createdAt: -1, _id: -1 } }
  );

  if (!otpDoc) {
    return res.status(400).json({ error: "OTP is invalid or expired. Request a new one." });
  }

  if (Number(otpDoc.attempts || 0) >= OTP_MAX_ATTEMPTS) {
    await otpCodesCol().updateOne({ _id: otpDoc._id }, { $set: { used: true } });
    return res.status(429).json({ error: "Too many incorrect attempts. Request a new OTP." });
  }

  const expectedHash = hashOtpCode(normalizedPhone, String(code).trim());
  if (expectedHash !== otpDoc.codeHash) {
    await otpCodesCol().updateOne(
      { _id: otpDoc._id },
      { $inc: { attempts: 1 } }
    );
    return res.status(400).json({ error: "Incorrect OTP code." });
  }

  const user = await usersCol().findOne({ id: otpDoc.userId, phone: normalizedPhone, is_admin: 0, is_super_admin: 0 });
  if (!user) {
    return res.status(404).json({ error: "Account not found." });
  }

  await usersCol().updateOne(
    { _id: user._id },
    {
      $set: {
        password: bcrypt.hashSync(String(newPassword), 10),
        failedLoginAttempts: 0,
        lockUntil: null
      }
    }
  );
  await otpCodesCol().updateOne({ _id: otpDoc._id }, { $set: { used: true, verifiedAt: new Date() } });

  return res.json({ message: "Password reset successful. Please log in." });
});

app.post("/api/admin/forgot-password/request-code", async (req, res) => {
  return res.status(410).json({
    error: "Admin self-service reset is disabled. Contact super admin."
  });
});

app.post("/api/admin/forgot-password/verify-code", async (req, res) => {
  return res.status(410).json({
    error: "Admin self-service reset is disabled. Contact super admin."
  });
});

app.post("/api/super-admin/forgot-password/request-code", async (req, res) => {
  return res.status(410).json({
    error: "SMS verification removed. Contact super admin directly."
  });
});

app.post("/api/super-admin/forgot-password/verify-code", async (req, res) => {
  return res.status(410).json({
    error: "SMS verification removed. Contact super admin directly."
  });
});

app.post("/api/login", async (req, res) => {
  const { phone, password } = req.body || {};
  if (!phone || !password) {
    return res.status(400).json({ error: "Phone and password are required" });
  }

  const variants = getPhoneVariants(phone);
  const user = await usersCol().findOne({ is_admin: 1, phone: { $in: variants } });
  if (!user) {
    return res.status(401).json({ error: "Invalid credentials" });
  }

  const now = Date.now();
  const lockUntilMs = user.lockUntil ? new Date(user.lockUntil).getTime() : 0;
  if (lockUntilMs && lockUntilMs > now) {
    const retryInMinutes = Math.max(1, Math.ceil((lockUntilMs - now) / 60000));
    return res.status(423).json({
      error: `Account temporarily locked. Try again in about ${retryInMinutes} minute(s).`
    });
  }

  if (!user.password || !bcrypt.compareSync(password, user.password)) {
    const nextAttempts = Number(user.failedLoginAttempts || 0) + 1;
    if (nextAttempts >= ADMIN_MAX_LOGIN_ATTEMPTS) {
      const lockUntil = new Date(now + ADMIN_LOCK_MINUTES * 60 * 1000);
      await usersCol().updateOne(
        { _id: user._id },
        { $set: { failedLoginAttempts: 0, lockUntil } }
      );
      return res.status(423).json({
        error: `Account temporarily locked after ${ADMIN_MAX_LOGIN_ATTEMPTS} failed attempts. Try again in about ${ADMIN_LOCK_MINUTES} minute(s).`
      });
    }

    await usersCol().updateOne(
      { _id: user._id },
      { $set: { failedLoginAttempts: nextAttempts, lockUntil: null } }
    );
    return res.status(401).json({
      error: "Invalid credentials",
      failedAttempts: nextAttempts
    });
  }

  await usersCol().updateOne(
    { _id: user._id },
    { $set: { failedLoginAttempts: 0, lockUntil: null } }
  );

  const token = signToken({
    id: user.id,
    phone: user.phone,
    is_admin: user.is_admin,
    is_super_admin: user.is_super_admin
  });

  return res.json({
    token,
    user: {
      id: user.id,
      phone: user.phone,
      isAdmin: !!user.is_admin,
      isSuperAdmin: !!user.is_super_admin,
      role: user.role || (user.is_super_admin ? "super_admin" : "admin")
    }
  });
});

app.get("/api/user/status", requireAuth, async (req, res) => {
  if (TEMP_FREE_ACCESS) {
    const nowMs = Date.now();
    const user = await usersCol().findOne(
      { id: String(req.user.id) },
      { projection: { tempAccessActivatedAt: 1, tempAccessExpiresAt: 1 } }
    );

    let activatedAt = user?.tempAccessActivatedAt ? new Date(user.tempAccessActivatedAt) : null;
    let tempExpiresAt = user?.tempAccessExpiresAt ? new Date(user.tempAccessExpiresAt) : null;

    const hasValidWindow = activatedAt
      && tempExpiresAt
      && Number.isFinite(activatedAt.getTime())
      && Number.isFinite(tempExpiresAt.getTime())
      && tempExpiresAt.getTime() > activatedAt.getTime();

    if (!hasValidWindow) {
      activatedAt = new Date();
      tempExpiresAt = new Date(activatedAt.getTime() + TEMP_FREE_ACCESS_DAYS * 24 * 60 * 60 * 1000);
      await usersCol().updateOne(
        { id: String(req.user.id) },
        { $set: { tempAccessActivatedAt: activatedAt, tempAccessExpiresAt: tempExpiresAt } }
      );
    }

    const remainingSeconds = Math.max(0, Math.floor((tempExpiresAt.getTime() - nowMs) / 1000));
    return res.json({
      active: tempExpiresAt.getTime() > nowMs,
      activatedAt: activatedAt.toISOString(),
      expiresAt: tempExpiresAt.toISOString(),
      remainingSeconds,
      remainingHours: Math.floor(remainingSeconds / 3600),
      remainingMinutes: Math.floor((remainingSeconds % 3600) / 60),
      bypassAccess: true
    });
  }
  const now = Date.now();
  let activation = await getUserActiveActivation(req.user.id);
  let userFallback = null;
  if (!activation) {
    userFallback = await usersCol().findOne(
      { id: String(req.user.id) },
      { projection: { activatedAt: 1, expiresAt: 1, paymentStatus: 1 } }
    );
    if (userFallback && userFallback.paymentStatus && userFallback.expiresAt) {
      const expMs = new Date(userFallback.expiresAt).getTime();
      if (expMs > now) {
        activation = {
          activatedAt: userFallback.activatedAt,
          expiresAt: userFallback.expiresAt
        };
      }
    }
  }
  const expiresMs = activation && activation.expiresAt ? new Date(activation.expiresAt).getTime() : 0;
  const remainingMs = Math.max(0, expiresMs - now);
  const remainingSeconds = Math.floor(remainingMs / 1000);
  const remainingHours = Math.floor(remainingSeconds / 3600);
  const remainingMinutes = Math.floor((remainingSeconds % 3600) / 60);
  return res.json({
    active: !!activation,
    activatedAt: activation ? activation.activatedAt : null,
    expiresAt: activation ? activation.expiresAt : null,
    remainingSeconds,
    remainingHours,
    remainingMinutes
  });
});

app.get("/api/user/payments", requireAuth, async (req, res) => {
  const rows = await paymentsCol()
    .find(
      { userId: String(req.user.id) },
      {
        projection: {
          _id: 0,
          id: 1,
          amount: 1,
          status: 1,
          mpesaReceipt: 1,
          timestamp: 1,
          activatedAt: 1,
          expiresAt: 1,
          validationError: 1,
          validationWarning: 1
        }
      }
    )
    .sort({ timestamp: -1, _id: -1 })
    .toArray();
  return res.json(rows);
});

app.post("/api/pay", requireAuth, async (req, res) => {
  if (TEMP_FREE_ACCESS) {
    return res.json({
      message: "Temporary free access is enabled. No payment is required right now.",
      mode: "free"
    });
  }
  const user = await usersCol().findOne({ id: req.user.id });
  if (!user) {
    return res.status(404).json({ error: "User not found" });
  }
  if (!user.phone) {
    return res.status(400).json({ error: "User phone is missing" });
  }

  let pendingId = null;
  try {
    const normalizedPhone = normalizePhone(user.phone);
    const accountReference = user.displayId || user.id;
    const transactionDesc = `Activate account ${accountReference}`;

    if (PAYMENT_MODE !== "daraja") {
      const now = new Date();
      const expiresAt = new Date(now.getTime() + 24 * 60 * 60 * 1000);
      const receipt = `MOCK${Date.now()}`;
      const payment = {
        id: randomUUID(),
        userId: req.user.id,
        amount: 50,
        mpesaReceipt: receipt,
        status: "Completed",
        timestamp: now,
        activatedAt: now,
        expiresAt,
        accountReference,
        phone: normalizedPhone
      };
      await paymentsCol().insertOne(payment);
      await syncUserActivationStatus(req.user.id, payment);

      return res.json({
        message: "Mock payment successful. Access unlocked for 24 hours.",
        mode: "mock",
        mpesaReceipt: receipt,
        activatedAt: now.toISOString(),
        expiresAt: expiresAt.toISOString()
      });
    }

    if (!isDarajaConfigured()) {
      return res.status(502).json({
        error: "Daraja config missing. Set PAYMENT_MODE=mock for local testing."
      });
    }

    const now = new Date();
    const placeholderReceipt = `PENDING_${Date.now()}`;
    const pending = {
      id: randomUUID(),
      userId: req.user.id,
      amount: 50,
      mpesaReceipt: placeholderReceipt,
      status: "Pending",
      timestamp: now,
      activatedAt: null,
      expiresAt: null,
      accountReference,
      phone: normalizedPhone
    };
    const insertPending = await paymentsCol().insertOne(pending);
    pendingId = insertPending.insertedId;

    const stk = await initiateStkPush({
      phone: normalizedPhone,
      amount: 50,
      accountReference,
      transactionDesc
    });
    const checkout = stk.CheckoutRequestID || "";

    await paymentsCol().updateOne(
      { _id: pendingId },
      { $set: { mpesaReceipt: `CHECKOUT_${checkout}` } }
    );

    return res.json({
      message: "Complete payment on your phone.",
      mode: "daraja",
      checkoutRequestId: checkout,
      merchantRequestId: stk.MerchantRequestID || null
    });
  } catch (err) {
    if (pendingId) {
      await paymentsCol().deleteOne({ _id: pendingId });
    }
    return res.status(502).json({ error: err.message || "Failed to initiate payment" });
  }
});

app.post("/api/payment/callback", async (req, res) => {
  try {
    const body = req.body || {};
    const callback = body.Body && body.Body.stkCallback ? body.Body.stkCallback : null;
    if (!callback) {
      return res.status(400).json({ error: "Invalid callback payload" });
    }

    const checkout = callback.CheckoutRequestID || "";
    const resultCode = Number(callback.ResultCode);
    const payment = await paymentsCol().findOne(
      { mpesaReceipt: `CHECKOUT_${checkout}` },
      { sort: { timestamp: -1, _id: -1 } }
    );

    if (!payment) {
      return res.status(200).json({ ok: true });
    }
    if (payment.status === "Completed") {
      return res.status(200).json({ ok: true });
    }

    if (resultCode !== 0) {
      await paymentsCol().updateOne(
        { _id: payment._id },
        {
          $set: {
            status: "Failed",
            activatedAt: null,
            expiresAt: null
          }
        }
      );
      await syncUserActivationStatusToLatest(payment.userId);
      return res.status(200).json({ ok: true });
    }

    const items = callback.CallbackMetadata && callback.CallbackMetadata.Item
      ? callback.CallbackMetadata.Item
      : [];
    const receiptItem = items.find((x) => x.Name === "MpesaReceiptNumber");
    const receipt = receiptItem && receiptItem.Value ? String(receiptItem.Value) : `TST${Date.now()}`;
    const amountItem = items.find((x) => x.Name === "Amount");
    const phoneItem = items.find((x) => x.Name === "PhoneNumber");
    const paidAmount = amountItem && amountItem.Value ? Number(amountItem.Value) : null;
    const paidPhoneRaw = phoneItem && phoneItem.Value ? String(phoneItem.Value) : "";
    let paidPhone = "";
    try {
      if (paidPhoneRaw) {
        paidPhone = normalizePhone(paidPhoneRaw);
      }
    } catch (_err) {
      paidPhone = "";
    }

    const expectedAmount = Number(payment.amount || 0);
    const expectedPhone = payment.phone ? normalizePhone(payment.phone) : "";
    const amountMatches = Number.isFinite(paidAmount) ? paidAmount === expectedAmount : true;
    const phoneMatches = (!expectedPhone || !paidPhone) ? true : paidPhone === expectedPhone;

    if (!amountMatches) {
      await paymentsCol().updateOne(
        { _id: payment._id },
        {
          $set: {
            status: "Failed",
            mpesaReceipt: receipt,
            activatedAt: null,
            expiresAt: null,
            validationError: "Amount mismatch"
          }
        }
      );
      await syncUserActivationStatusToLatest(payment.userId);
      return res.status(200).json({ ok: true });
    }

    const activatedAt = new Date();
    const expiresAt = new Date(activatedAt.getTime() + 24 * 60 * 60 * 1000);

    await paymentsCol().updateOne(
      { _id: payment._id },
      {
        $set: {
          status: "Completed",
          mpesaReceipt: receipt,
          activatedAt,
          expiresAt,
          validationWarning: phoneMatches ? null : "Phone mismatch"
        }
      }
    );

    await syncUserActivationStatus(payment.userId, {
      status: "Completed",
      activatedAt,
      expiresAt
    });

    return res.status(200).json({ ok: true });
  } catch (err) {
    console.error("Payment callback processing error:", err && err.message ? err.message : err);
    return res.status(200).json({ ok: true });
  }
});

app.get("/api/plots", async (req, res) => {
  res.set("Cache-Control", "no-store");
  const country = String(req.query.country || "").trim();
  const county = String(req.query.county || req.query.town || "").trim();
  const area = String(req.query.area || "").trim();
  const category = String(req.query.category || "").trim();
  const minPrice = Number(req.query.minPrice);
  const maxPrice = Number(req.query.maxPrice);
  const hasMin = Number.isFinite(minPrice);
  const hasMax = Number.isFinite(maxPrice);

  const filter = {};
  const and = [];
  if (country) {
    const countryRegex = new RegExp(`^${escapeRegex(country)}$`, "i");
    and.push({
      $or: [
        { country: countryRegex },
        { country: { $exists: false } },
        { country: "" }
      ]
    });
  }
  if (county) {
    const countyRegex = new RegExp(`^${escapeRegex(county)}$`, "i");
    and.push({ $or: [{ county: countyRegex }, { town: countyRegex }] });
  }
  if (area) {
    const areaRegex = new RegExp(`^${escapeRegex(area)}$`, "i");
    and.push({ area: areaRegex });
  }
  if (category) {
    const categoryRegex = new RegExp(`^${escapeRegex(category)}$`, "i");
    and.push({ category: categoryRegex });
  }
  if (hasMin || hasMax) {
    const price = {};
    if (hasMin) price.$gte = minPrice;
    if (hasMax) price.$lte = maxPrice;
    and.push({ price });
  }
  if (and.length) {
    filter.$and = and;
  }

  const rows = await plotsCol().find(filter).sort({ createdAt: -1, _id: -1 }).toArray();
  const unlocked = await getUnlockedFromRequest(req);
  return res.json(rows.map((p) => mapPlot(p, unlocked)));
});

app.get("/api/plot/:id", async (req, res) => {
  const row = await plotsCol().findOne({ id: req.params.id });
  if (!row) {
    return res.status(404).json({ error: "Plot not found" });
  }
  const unlocked = await getUnlockedFromRequest(req);
  return res.json(mapPlot(row, unlocked));
});

app.get("/api/blog", async (req, res) => {
  const pageInput = Number(req.query.page || 1);
  const limitInput = Number(req.query.limit || 10);
  const page = Number.isFinite(pageInput) ? Math.max(1, pageInput) : 1;
  const limit = Number.isFinite(limitInput) ? Math.min(Math.max(limitInput, 1), 20) : 10;
  const search = String(req.query.q || "").trim();
  const tag = String(req.query.tag || "").trim();

  const filter = {};
  if (tag) {
    filter.tags = tag;
  }
  if (search) {
    const regex = new RegExp(search.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "i");
    filter.$or = [{ title: regex }, { excerpt: regex }, { content: regex }];
  }

  const total = await blogsCol().countDocuments(filter);
  const pages = Math.max(1, Math.ceil(total / limit));
  const rows = await blogsCol()
    .find(filter, { projection: { _id: 0, content: 0 } })
    .sort({ createdAt: -1, _id: -1 })
    .skip((page - 1) * limit)
    .limit(limit)
    .toArray();

  return res.json({ items: rows, page, pages, total });
});

app.get("/api/blog/:slug", async (req, res) => {
  const slug = String(req.params.slug || "").trim();
  if (!slug) {
    return res.status(400).json({ error: "Blog slug is required" });
  }
  const post = await blogsCol().findOne(
    { slug },
    { projection: { _id: 0 } }
  );
  if (!post) {
    return res.status(404).json({ error: "Blog not found" });
  }
  return res.json(post);
});

app.get("/api/admin/blog", requireSecureAdmin, requireAuth, requireAdmin, async (req, res) => {
  const pageInput = Number(req.query.page || 1);
  const limitInput = Number(req.query.limit || 10);
  const page = Number.isFinite(pageInput) ? Math.max(1, pageInput) : 1;
  const limit = Number.isFinite(limitInput) ? Math.min(Math.max(limitInput, 1), 50) : 10;
  const search = String(req.query.q || "").trim();
  const tag = String(req.query.tag || "").trim();

  const filter = {};
  if (tag) {
    filter.tags = tag;
  }
  if (search) {
    const regex = new RegExp(search.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "i");
    filter.$or = [{ title: regex }, { excerpt: regex }, { content: regex }];
  }

  const total = await blogsCol().countDocuments(filter);
  const pages = Math.max(1, Math.ceil(total / limit));
  const rows = await blogsCol()
    .find(filter, { projection: { _id: 0 } })
    .sort({ createdAt: -1, _id: -1 })
    .skip((page - 1) * limit)
    .limit(limit)
    .toArray();

  return res.json({ items: rows, page, pages, total });
});

app.post("/api/admin/blog", requireSecureAdmin, requireAuth, requireAdmin, async (req, res) => {
  const { title, slug, content, author, excerpt, tags } = req.body || {};
  if (!title || !content) {
    return res.status(400).json({ error: "Title and content are required" });
  }

  const finalSlug = slugify(slug || title);
  if (!finalSlug) {
    return res.status(400).json({ error: "Valid slug is required" });
  }

  const existing = await blogsCol().findOne({ slug: finalSlug }, { projection: { _id: 1 } });
  if (existing) {
    return res.status(409).json({ error: "Slug already exists" });
  }

  const now = new Date();
  const doc = {
    id: randomUUID(),
    title: String(title).trim(),
    slug: finalSlug,
    excerpt: String(excerpt || "").trim() || String(content).trim().slice(0, 180),
    content: String(content).trim(),
    author: String(author || "").trim() || "TST PlotConnect",
    tags: Array.isArray(tags)
      ? tags.filter(Boolean).map((t) => String(t).trim().toLowerCase())
      : [],
    createdAt: now,
    updatedAt: now
  };

  await blogsCol().insertOne(doc);
  return res.status(201).json(doc);
});

app.put("/api/admin/blog/:id", requireSecureAdmin, requireAuth, requireAdmin, async (req, res) => {
  const id = String(req.params.id || "").trim();
  if (!id) {
    return res.status(400).json({ error: "Blog id is required" });
  }
  const existing = await blogsCol().findOne({ id }, { projection: { _id: 0 } });
  if (!existing) {
    return res.status(404).json({ error: "Blog not found" });
  }

  const {
    title = existing.title,
    slug = existing.slug,
    content = existing.content,
    author = existing.author,
    excerpt = existing.excerpt,
    tags = existing.tags
  } = req.body || {};

  const finalSlug = slugify(slug || title);
  if (!finalSlug) {
    return res.status(400).json({ error: "Valid slug is required" });
  }

  const slugOwner = await blogsCol().findOne({ slug: finalSlug }, { projection: { id: 1, _id: 0 } });
  if (slugOwner && slugOwner.id !== id) {
    return res.status(409).json({ error: "Slug already exists" });
  }

  const updated = {
    title: String(title).trim(),
    slug: finalSlug,
    excerpt: String(excerpt || "").trim() || String(content).trim().slice(0, 180),
    content: String(content).trim(),
    author: String(author || "").trim() || "TST PlotConnect",
    tags: Array.isArray(tags)
      ? tags.filter(Boolean).map((t) => String(t).trim().toLowerCase())
      : [],
    updatedAt: new Date()
  };

  await blogsCol().updateOne({ id }, { $set: updated });
  const saved = await blogsCol().findOne({ id }, { projection: { _id: 0 } });
  return res.json(saved);
});

app.delete("/api/admin/blog/:id", requireSecureAdmin, requireAuth, requireAdmin, async (req, res) => {
  const id = String(req.params.id || "").trim();
  if (!id) {
    return res.status(400).json({ error: "Blog id is required" });
  }
  const result = await blogsCol().deleteOne({ id });
  if (!result.deletedCount) {
    return res.status(404).json({ error: "Blog not found" });
  }
  return res.status(204).send();
});

app.get("/api/metadata/locations", async (_req, res) => {
  const meta = await getLocationMetadata();
  return res.json(meta);
});

app.get("/api/admin/plots", requireSecureAdmin, requireAuth, requireAdmin, async (_req, res) => {
  const rows = await plotsCol().find({}).sort({ createdAt: -1, _id: -1 }).toArray();
  return res.json(rows.map((p) => mapPlot(p, true)));
});

app.post("/api/admin/plots", requireSecureAdmin, requireAuth, requireAdmin, async (req, res) => {
  const {
    title,
    price,
    category = "",
    priority = "medium",
    country = "Kenya",
    county = req.body?.town || "",
    town,
    area,
    description = "",
    caretaker,
    whatsapp,
    images = [],
    videos = [],
    lat = null,
    lng = null,
    mapLink = ""
  } = req.body || {};

  const cleanTitle = String(title || "").trim();
  const cleanCategory = String(category || "").trim();
  const cleanCountry = String(country || "").trim() || "Kenya";
  const cleanCounty = String(county || "").trim();
  const cleanArea = String(area || "").trim();
  const cleanPriority = String(priority || "medium").trim().toLowerCase() || "medium";
  const cleanDescription = String(description || "").trim();
  const cleanCaretaker = String(caretaker || "").trim();
  const cleanWhatsapp = String(whatsapp || "").trim();
  const cleanLat = toOptionalNumber(lat);
  const cleanLng = toOptionalNumber(lng);
  const cleanMapLink = String(mapLink || "").trim();

  if (!cleanTitle || !price || !cleanCounty || !cleanArea || !cleanCaretaker || !cleanWhatsapp) {
    return res.status(400).json({ error: "Missing required fields" });
  }
  if (cleanCategory && !ALLOWED_CATEGORIES.has(cleanCategory)) {
    return res.status(400).json({ error: "Invalid category" });
  }

  const plot = {
    id: randomUUID(),
    title: cleanTitle,
    price: Number(price),
    category: cleanCategory,
    country: cleanCountry,
    county: cleanCounty,
    town: cleanCounty,
    area: cleanArea,
    priority: ["top", "medium", "bottom"].includes(cleanPriority) ? cleanPriority : "medium",
    description: cleanDescription,
    caretaker: cleanCaretaker,
    whatsapp: cleanWhatsapp,
    images: (images || []).filter(Boolean),
    videos: (videos || []).filter(Boolean),
    lat: cleanLat,
    lng: cleanLng,
    mapLink: cleanMapLink,
    createdAt: new Date(),
    updatedAt: new Date()
  };

  await plotsCol().insertOne(plot);
  await syncPlotLocationMetadata(plot.country, plot.county, plot.area);
  return res.status(201).json(mapPlot(plot, true));
});

app.put("/api/admin/plots/:id", requireSecureAdmin, requireAuth, requireAdmin, async (req, res) => {
  const existing = await plotsCol().findOne({ id: req.params.id });
  if (!existing) {
    return res.status(404).json({ error: "Plot not found" });
  }

  const {
    title = existing.title,
    price = existing.price,
    category = existing.category || "",
    priority = existing.priority || "medium",
    country = existing.country || "Kenya",
    county = existing.county || existing.town,
    area = existing.area,
    description = existing.description,
    caretaker = existing.caretaker,
    whatsapp = existing.whatsapp,
    images = null,
    videos = null,
    lat = existing.lat ?? null,
    lng = existing.lng ?? null,
    mapLink = existing.mapLink || ""
  } = req.body || {};

  const cleanTitle = String(title || "").trim();
  const cleanCategory = String(category || "").trim();
  const cleanCountry = String(country || "").trim() || "Kenya";
  const cleanCounty = String(county || "").trim();
  const cleanArea = String(area || "").trim();
  const cleanPriority = String(priority || "medium").trim().toLowerCase() || "medium";
  const cleanDescription = String(description || "").trim();
  const cleanCaretaker = String(caretaker || "").trim();
  const cleanWhatsapp = String(whatsapp || "").trim();
  const cleanLat = toOptionalNumber(lat);
  const cleanLng = toOptionalNumber(lng);
  const cleanMapLink = String(mapLink || "").trim();

  if (cleanCategory && !ALLOWED_CATEGORIES.has(cleanCategory)) {
    return res.status(400).json({ error: "Invalid category" });
  }

  const setDoc = {
    title: cleanTitle,
    price: Number(price),
    category: cleanCategory,
    country: cleanCountry,
    county: cleanCounty,
    town: cleanCounty,
    area: cleanArea,
    priority: ["top", "medium", "bottom"].includes(cleanPriority) ? cleanPriority : "medium",
    description: cleanDescription,
    caretaker: cleanCaretaker,
    whatsapp: cleanWhatsapp,
    lat: cleanLat,
    lng: cleanLng,
    mapLink: cleanMapLink,
    updatedAt: new Date()
  };

  if (images !== null) {
    setDoc.images = (images || []).filter(Boolean);
  }
  if (videos !== null) {
    setDoc.videos = (videos || []).filter(Boolean);
  }

  await plotsCol().updateOne({ id: req.params.id }, { $set: setDoc });
  await syncPlotLocationMetadata(setDoc.country, setDoc.county, setDoc.area);
  const updated = await plotsCol().findOne({ id: req.params.id });
  return res.json(mapPlot(updated, true));
});

app.delete("/api/admin/plots/:id", requireSecureAdmin, requireAuth, requireAdmin, async (req, res) => {
  const result = await plotsCol().deleteOne({ id: req.params.id });
  if (!result.deletedCount) {
    return res.status(404).json({ error: "Plot not found" });
  }
  return res.json({ message: "plot deleted successfully" });
});

app.post("/api/admin/users", requireSecureAdmin, requireAuth, requireAdmin, async (req, res) => {
  const { phone, password = null } = req.body || {};
  if (!phone || String(phone).length < 10) {
    return res.status(400).json({ error: "Valid phone is required" });
  }

  const existing = await usersCol().findOne({ phone }, { projection: { _id: 1 } });
  if (existing) {
    return res.status(409).json({ error: "Phone already registered" });
  }

  const owner = {
    id: randomUUID(),
    phone,
    password: password ? bcrypt.hashSync(password, 10) : null,
    is_admin: 0,
    is_super_admin: 0,
    role: "user",
    failedLoginAttempts: 0,
    lockUntil: null,
    activatedAt: null,
    expiresAt: null,
    paymentStatus: false,
    createdAt: new Date()
  };
  await usersCol().insertOne(owner);

  return res.status(201).json({
    id: owner.id,
    phone: owner.phone,
    is_admin: owner.is_admin,
    activatedAt: owner.activatedAt,
    expiresAt: owner.expiresAt,
    paymentStatus: owner.paymentStatus
  });
});

app.post("/api/admin/create-admin", requireSecureAdmin, requireAuth, requireAdmin, requireSuperAdmin, async (req, res) => {
  const { phone, password } = req.body || {};
  if (!phone || !password || String(phone).length < 10 || String(password).length < 4) {
    return res.status(400).json({ error: "Valid phone and password are required" });
  }

  const normalizedPhone = canonicalPhone(phone);
  const variants = getPhoneVariants(phone);
  const hash = bcrypt.hashSync(password, 10);
  const existing = await usersCol().findOne({ phone: { $in: variants } });
  if (existing) {
    await usersCol().updateOne(
      { _id: existing._id },
      {
        $set: {
          is_admin: 1,
          is_super_admin: 0,
          role: "admin",
          password: hash,
          phone: normalizedPhone,
          failedLoginAttempts: 0,
          lockUntil: null
        }
      }
    );
    return res.json({
      message: "User promoted to admin.",
      user: {
        id: existing.id,
        phone: normalizedPhone,
        is_admin: 1
      }
    });
  }

  const adminUser = {
    id: randomUUID(),
    phone: normalizedPhone,
    password: hash,
    is_admin: 1,
    is_super_admin: 0,
    role: "admin",
    failedLoginAttempts: 0,
    lockUntil: null,
    activatedAt: null,
    expiresAt: null,
    paymentStatus: false,
    createdAt: new Date()
  };
  await usersCol().insertOne(adminUser);

  return res.status(201).json({
    message: "Admin account created.",
    user: {
      id: adminUser.id,
      phone: adminUser.phone,
      is_admin: adminUser.is_admin
    }
  });
});

app.get("/api/super-admin/admins", requireSecureAdmin, requireAuth, requireAdmin, requireSuperAdmin, async (_req, res) => {
  const rows = await usersCol()
    .find(
      { is_admin: 1 },
      {
        projection: {
          _id: 0,
          id: 1,
          phone: 1,
          role: 1,
          is_super_admin: 1,
          createdAt: 1,
          failedLoginAttempts: 1,
          lockUntil: 1
        }
      }
    )
    .sort({ createdAt: -1, _id: -1 })
    .toArray();

  return res.json(rows.map((x) => ({
    ...x,
    role: x.role || (x.is_super_admin ? "super_admin" : "admin"),
    loginPhone: x.phone
  })));
});

app.post("/api/super-admin/admins/:id/reset-password", requireSecureAdmin, requireAuth, requireAdmin, requireSuperAdmin, async (req, res) => {
  const adminId = String(req.params.id || "");
  const { newPassword } = req.body || {};
  if (!adminId) {
    return res.status(400).json({ error: "Admin ID is required" });
  }

  const admin = await usersCol().findOne({ id: adminId, is_admin: 1 });
  if (!admin) {
    return res.status(404).json({ error: "Admin not found" });
  }
  if (admin.is_super_admin) {
    return res.status(403).json({ error: "Super admin password must be managed directly." });
  }

  const issuedPassword = String(newPassword || "").trim() || generateTemporaryPassword(10);
  if (issuedPassword.length < 4) {
    return res.status(400).json({ error: "Password must be at least 4 characters" });
  }

  await usersCol().updateOne(
    { _id: admin._id },
    {
      $set: {
        password: bcrypt.hashSync(issuedPassword, 10),
        failedLoginAttempts: 0,
        lockUntil: null
      }
    }
  );

  return res.json({
    message: "Admin password reset. Share this password securely.",
    admin: { id: admin.id, phone: admin.phone },
    temporaryPassword: issuedPassword
  });
});

app.delete("/api/super-admin/users/:id", requireSecureAdmin, requireAuth, requireAdmin, requireSuperAdmin, async (req, res) => {
  const userId = String(req.params.id || "").trim();
  if (!userId) {
    return res.status(400).json({ error: "User ID is required" });
  }

  const user = await usersCol().findOne({ id: userId });
  if (!user) {
    return res.status(404).json({ error: "User not found" });
  }
  if (user.is_admin || user.is_super_admin) {
    return res.status(403).json({ error: "Admin accounts cannot be deleted from this endpoint." });
  }

  const paymentsResult = await paymentsCol().deleteMany({ userId: userId });
  const userResult = await usersCol().deleteOne({ id: userId });
  if (!userResult.deletedCount) {
    return res.status(404).json({ error: "User not found" });
  }

  return res.json({
    message: "User and related payments deleted.",
    deletedPayments: paymentsResult.deletedCount
  });
});

app.delete("/api/super-admin/payments/:id", requireSecureAdmin, requireAuth, requireAdmin, requireSuperAdmin, async (req, res) => {
  const paymentId = String(req.params.id || "").trim();
  if (!paymentId) {
    return res.status(400).json({ error: "Payment ID is required" });
  }

  const payment = await paymentsCol().findOne({ id: paymentId });
  if (!payment) {
    return res.status(404).json({ error: "Payment not found" });
  }

  await paymentsCol().deleteOne({ id: paymentId });

  const active = await getUserActiveActivation(payment.userId);
  await syncUserActivationStatus(payment.userId, active);

  return res.json({ message: "Payment deleted." });
});

app.delete("/api/super-admin/activations/:userId", requireSecureAdmin, requireAuth, requireAdmin, requireSuperAdmin, async (req, res) => {
  const userId = String(req.params.userId || "").trim();
  if (!userId) {
    return res.status(400).json({ error: "User ID is required" });
  }

  const user = await usersCol().findOne({ id: userId });
  if (!user) {
    return res.status(404).json({ error: "User not found" });
  }
  if (user.is_admin || user.is_super_admin) {
    return res.status(403).json({ error: "Admin accounts cannot be deleted from this endpoint." });
  }

  const now = new Date();
  const result = await paymentsCol().deleteMany({
    userId,
    status: "Completed",
    expiresAt: { $gt: now }
  });
  await syncUserActivationStatusToLatest(userId);

  return res.json({
    message: "Activation records deleted.",
    deletedActivations: result.deletedCount
  });
});

app.post("/api/super-admin/locations/county", requireSecureAdmin, requireAuth, requireAdmin, requireSuperAdmin, async (req, res) => {
  const { country, county } = req.body || {};
  const countryName = String(country || "").trim();
  const countyName = String(county || "").trim();
  if (!countryName || !countyName) {
    return res.status(400).json({ error: "country and county are required" });
  }

  const meta = await getLocationMetadata();
  const countries = new Set(meta.countries || []);
  countries.add(countryName);
  const countiesByCountry = { ...(meta.countiesByCountry || {}) };
  const current = new Set(countiesByCountry[countryName] || []);
  current.add(countyName);
  countiesByCountry[countryName] = Array.from(current).sort((a, b) => a.localeCompare(b));

  const areasByCounty = { ...(meta.areasByCounty || {}) };
  if (!Array.isArray(areasByCounty[countyName])) {
    areasByCounty[countyName] = [];
  }

  await locationMetadataCol().updateOne(
    { key: "default" },
    {
      $set: {
        countries: Array.from(countries),
        countiesByCountry,
        areasByCounty,
        updatedAt: new Date()
      },
      $setOnInsert: { key: "default", createdAt: new Date() }
    },
    { upsert: true }
  );

  return res.json({ message: "country added successfully" });
});

app.put("/api/super-admin/locations/county", requireSecureAdmin, requireAuth, requireAdmin, requireSuperAdmin, async (req, res) => {
  const { country, county, newCounty } = req.body || {};
  const countryName = String(country || "").trim();
  const countyName = String(county || "").trim();
  const newCountyName = String(newCounty || "").trim();
  if (!countryName || !countyName || !newCountyName) {
    return res.status(400).json({ error: "country, county and newCounty are required" });
  }

  const meta = await getLocationMetadata();
  const countiesByCountry = { ...(meta.countiesByCountry || {}) };
  const list = Array.isArray(countiesByCountry[countryName]) ? countiesByCountry[countryName] : [];
  if (!list.includes(countyName)) {
    return res.status(404).json({ error: "County not found in selected country." });
  }
  if (list.includes(newCountyName)) {
    return res.status(409).json({ error: "County name already exists in selected country." });
  }

  countiesByCountry[countryName] = list.map((c) => (c === countyName ? newCountyName : c));
  const areasByCounty = { ...(meta.areasByCounty || {}) };
  if (areasByCounty[countyName]) {
    areasByCounty[newCountyName] = areasByCounty[countyName];
    delete areasByCounty[countyName];
  }

  await locationMetadataCol().updateOne(
    { key: "default" },
    {
      $set: {
        countiesByCountry,
        areasByCounty,
        updatedAt: new Date()
      },
      $setOnInsert: { key: "default", createdAt: new Date() }
    },
    { upsert: true }
  );

  return res.json({ message: "County updated successfully." });
});

app.post("/api/super-admin/locations/area", requireSecureAdmin, requireAuth, requireAdmin, requireSuperAdmin, async (req, res) => {
  const { country, county, area } = req.body || {};
  let countryName = String(country || "").trim();
  const countyName = String(county || "").trim();
  const areaName = String(area || "").trim();
  if (!countyName || !areaName) {
    return res.status(400).json({ error: "county and area are required" });
  }

  const meta = await getLocationMetadata();
  if (!countryName) {
    const match = Object.entries(meta.countiesByCountry || {}).find(([, list]) => Array.isArray(list) && list.includes(countyName));
    countryName = match ? match[0] : "";
  }
  if (!countryName) {
    return res.status(400).json({ error: "country is required" });
  }
  const allowedCounties = Array.isArray(meta.countiesByCountry?.[countryName])
    ? meta.countiesByCountry[countryName]
    : [];
  if (!allowedCounties.includes(countyName)) {
    return res.status(404).json({ error: "County not found in selected country." });
  }
  const areasByCounty = { ...(meta.areasByCounty || {}) };
  const currentAreas = new Set(areasByCounty[countyName] || []);
  currentAreas.add(areaName);
  areasByCounty[countyName] = Array.from(currentAreas).sort((a, b) => a.localeCompare(b));

  await locationMetadataCol().updateOne(
    { key: "default" },
    {
      $set: {
        areasByCounty,
        updatedAt: new Date()
      },
      $setOnInsert: { key: "default", createdAt: new Date() }
    },
    { upsert: true }
  );

  return res.json({ message: "area added successfully" });
});

app.put("/api/super-admin/locations/area", requireSecureAdmin, requireAuth, requireAdmin, requireSuperAdmin, async (req, res) => {
  const { country, county, area, newArea } = req.body || {};
  const countryName = String(country || "").trim();
  const countyName = String(county || "").trim();
  const areaName = String(area || "").trim();
  const newAreaName = String(newArea || "").trim();
  if (!countryName || !countyName || !areaName || !newAreaName) {
    return res.status(400).json({ error: "country, county, area and newArea are required" });
  }

  const meta = await getLocationMetadata();
  const allowedCounties = Array.isArray(meta.countiesByCountry?.[countryName])
    ? meta.countiesByCountry[countryName]
    : [];
  if (!allowedCounties.includes(countyName)) {
    return res.status(404).json({ error: "County not found in selected country." });
  }
  const areasByCounty = { ...(meta.areasByCounty || {}) };
  const existingAreas = Array.isArray(areasByCounty[countyName]) ? areasByCounty[countyName] : [];
  if (!existingAreas.includes(areaName)) {
    return res.status(404).json({ error: "Area not found in selected county." });
  }
  if (existingAreas.includes(newAreaName)) {
    return res.status(409).json({ error: "Area name already exists in selected county." });
  }

  areasByCounty[countyName] = existingAreas.map((a) => (a === areaName ? newAreaName : a));

  await locationMetadataCol().updateOne(
    { key: "default" },
    {
      $set: {
        areasByCounty,
        updatedAt: new Date()
      },
      $setOnInsert: { key: "default", createdAt: new Date() }
    },
    { upsert: true }
  );

  return res.json({ message: "Area updated successfully." });
});

app.delete("/api/super-admin/locations/area", requireSecureAdmin, requireAuth, requireAdmin, requireSuperAdmin, async (req, res) => {
  const { country, county, area } = req.body || {};
  const countryName = String(country || "").trim();
  const countyName = String(county || "").trim();
  const areaName = String(area || "").trim();
  if (!countryName || !countyName || !areaName) {
    return res.status(400).json({ error: "country, county and area are required" });
  }

  const meta = await getLocationMetadata();
  const allowedCounties = Array.isArray(meta.countiesByCountry?.[countryName])
    ? meta.countiesByCountry[countryName]
    : [];
  if (!allowedCounties.includes(countyName)) {
    return res.status(404).json({ error: "County not found in selected country." });
  }
  const areasByCounty = { ...(meta.areasByCounty || {}) };
  const existingAreas = Array.isArray(areasByCounty[countyName]) ? areasByCounty[countyName] : [];
  if (!existingAreas.includes(areaName)) {
    return res.status(404).json({ error: "Area not found in selected county." });
  }

  areasByCounty[countyName] = existingAreas.filter((a) => a !== areaName);
  await locationMetadataCol().updateOne(
    { key: "default" },
    {
      $set: {
        areasByCounty,
        updatedAt: new Date()
      },
      $setOnInsert: { key: "default", createdAt: new Date() }
    },
    { upsert: true }
  );

  return res.json({ message: "Area deleted successfully." });
});

app.delete("/api/super-admin/locations/county", requireSecureAdmin, requireAuth, requireAdmin, requireSuperAdmin, async (req, res) => {
  const { country, county } = req.body || {};
  const countryName = String(country || "").trim();
  const countyName = String(county || "").trim();
  if (!countryName || !countyName) {
    return res.status(400).json({ error: "country and county are required" });
  }

  const meta = await getLocationMetadata();
  const countiesByCountry = { ...(meta.countiesByCountry || {}) };
  const list = Array.isArray(countiesByCountry[countryName]) ? countiesByCountry[countryName] : [];
  if (!list.includes(countyName)) {
    return res.status(404).json({ error: "County not found in selected country." });
  }

  countiesByCountry[countryName] = list.filter((c) => c !== countyName);
  const areasByCounty = { ...(meta.areasByCounty || {}) };
  if (areasByCounty[countyName]) {
    delete areasByCounty[countyName];
  }

  await locationMetadataCol().updateOne(
    { key: "default" },
    {
      $set: {
        countiesByCountry,
        areasByCounty,
        updatedAt: new Date()
      },
      $setOnInsert: { key: "default", createdAt: new Date() }
    },
    { upsert: true }
  );

  return res.json({ message: "County deleted successfully." });
});

app.get("/api/admin/users", requireSecureAdmin, requireAuth, requireAdmin, async (_req, res) => {
  const rows = await usersCol()
    .find(
      {},
      {
        projection: {
          _id: 0,
          id: 1,
          phone: 1,
          is_admin: 1,
          is_super_admin: 1,
          role: 1,
          createdAt: 1,
          activatedAt: 1,
          expiresAt: 1,
          paymentStatus: 1
        }
      }
    )
    .sort({ createdAt: -1, _id: -1 })
    .toArray();
  return res.json(rows);
});

app.get("/api/admin/payments", requireSecureAdmin, requireAuth, requireAdmin, async (_req, res) => {
  const rows = await paymentsCol()
    .aggregate([
      { $sort: { timestamp: -1, _id: -1 } },
      {
        $lookup: {
          from: "users",
          localField: "userId",
          foreignField: "id",
          as: "userDoc"
        }
      },
      {
        $project: {
          _id: 0,
          id: 1,
          userId: 1,
          phone: { $let: { vars: { u: { $arrayElemAt: ["$userDoc", 0] } }, in: "$$u.phone" } },
          amount: 1,
          status: 1,
          mpesaReceipt: 1,
          activatedAt: 1,
          expiresAt: 1,
          timestamp: 1
        }
      }
    ])
    .toArray();
  return res.json(rows);
});

app.get("/api/admin/accounts/active", requireSecureAdmin, requireAuth, requireAdmin, async (_req, res) => {
  const now = new Date();
  const rows = await paymentsCol()
    .aggregate([
      {
        $match: {
          status: "Completed",
          expiresAt: { $gt: now }
        }
      },
      { $sort: { expiresAt: -1, timestamp: -1, _id: -1 } },
      {
        $group: {
          _id: "$userId",
          payment: { $first: "$$ROOT" }
        }
      },
      {
        $lookup: {
          from: "users",
          localField: "_id",
          foreignField: "id",
          as: "userDoc"
        }
      },
      {
        $project: {
          _id: 0,
          userId: "$_id",
          phone: { $let: { vars: { u: { $arrayElemAt: ["$userDoc", 0] } }, in: "$$u.phone" } },
          activatedAt: "$payment.activatedAt",
          expiresAt: "$payment.expiresAt",
          mpesaReceipt: "$payment.mpesaReceipt"
        }
      }
    ])
    .toArray();

  const withRemaining = rows.map((row) => {
    const remainingMs = Math.max(0, new Date(row.expiresAt).getTime() - Date.now());
    const remainingSeconds = Math.floor(remainingMs / 1000);
    const remainingHours = Math.floor(remainingSeconds / 3600);
    const remainingMinutes = Math.floor((remainingSeconds % 3600) / 60);
    return {
      ...row,
      remainingSeconds,
      remainingHours,
      remainingMinutes
    };
  });

  return res.json(withRemaining);
});

app.delete("/api/admin/users/:id", requireSecureAdmin, requireAuth, requireAdmin, async (req, res) => {
  const userId = String(req.params.id || "").trim();
  if (!userId) {
    return res.status(400).json({ error: "User ID is required" });
  }

  const user = await usersCol().findOne({ id: userId });
  if (!user) {
    return res.status(404).json({ error: "User not found" });
  }
  if (user.is_admin || user.is_super_admin) {
    return res.status(403).json({ error: "Admin accounts cannot be deleted from this endpoint." });
  }

  const paymentsResult = await paymentsCol().deleteMany({ userId });
  const userResult = await usersCol().deleteOne({ id: userId });
  if (!userResult.deletedCount) {
    return res.status(404).json({ error: "User not found" });
  }

  return res.json({
    message: "User and related payments deleted.",
    deletedPayments: paymentsResult.deletedCount
  });
});

app.delete("/api/admin/payments/:id", requireSecureAdmin, requireAuth, requireAdmin, async (req, res) => {
  const paymentId = String(req.params.id || "").trim();
  if (!paymentId) {
    return res.status(400).json({ error: "Payment ID is required" });
  }

  const payment = await paymentsCol().findOne({ id: paymentId });
  if (!payment) {
    return res.status(404).json({ error: "Payment not found" });
  }

  await paymentsCol().deleteOne({ id: paymentId });
  const active = await getUserActiveActivation(payment.userId);
  await syncUserActivationStatus(payment.userId, active);

  return res.json({ message: "Payment deleted." });
});

app.delete("/api/admin/activations/:userId", requireSecureAdmin, requireAuth, requireAdmin, async (req, res) => {
  const userId = String(req.params.userId || "").trim();
  if (!userId) {
    return res.status(400).json({ error: "User ID is required" });
  }

  const user = await usersCol().findOne({ id: userId });
  if (!user) {
    return res.status(404).json({ error: "User not found" });
  }
  if (user.is_admin || user.is_super_admin) {
    return res.status(403).json({ error: "Admin accounts cannot be deleted from this endpoint." });
  }

  const now = new Date();
  const result = await paymentsCol().deleteMany({
    userId,
    status: "Completed",
    expiresAt: { $gt: now }
  });
  await syncUserActivationStatusToLatest(userId);

  return res.json({
    message: "Activation records deleted.",
    deletedActivations: result.deletedCount
  });
});

app.post("/api/admin/activate", requireSecureAdmin, requireAuth, requireAdmin, async (req, res) => {
  const { userId } = req.body || {};
  if (!userId) {
    return res.status(400).json({ error: "userId is required" });
  }

  const user = await usersCol().findOne({ id: String(userId) }, { projection: { _id: 1, id: 1 } });
  if (!user) {
    return res.status(404).json({ error: "User not found" });
  }

  const activePayment = await getUserActiveActivation(user.id);
  if (!activePayment) {
    return res.status(403).json({ error: "Payment not received. Activation blocked." });
  }

  await syncUserActivationStatus(user.id, activePayment);
  return res.json({ message: "Payment confirmed. Account is active." });
});

app.post("/api/admin/revoke", requireSecureAdmin, requireAuth, requireAdmin, async (req, res) => {
  const { userId } = req.body || {};
  if (!userId) {
    return res.status(400).json({ error: "userId is required" });
  }

  const user = await usersCol().findOne({ id: String(userId) }, { projection: { _id: 1, id: 1 } });
  if (!user) {
    return res.status(404).json({ error: "User not found" });
  }

  const latest = await paymentsCol().findOne(
    { userId: user.id },
    { sort: { timestamp: -1, _id: -1 } }
  );

  if (latest) {
    const now = new Date();
    await paymentsCol().updateOne(
      { _id: latest._id },
      { $set: { expiresAt: now, status: "Completed" } }
    );
  }
  await syncUserActivationStatus(user.id, null);

  return res.json({ message: "User access revoked" });
});

app.get("/api/admin/analytics", requireSecureAdmin, requireAuth, requireAdmin, async (_req, res) => {
  const totalUsers = await usersCol().countDocuments();
  const totalPlots = await plotsCol().countDocuments();

  const activeUserIds = await paymentsCol().distinct("userId", {
    status: "Completed",
    expiresAt: { $gt: new Date() }
  });
  const activeUsers = activeUserIds.length;

  const paymentTotalsAgg = await paymentsCol()
    .aggregate([
      {
        $group: {
          _id: null,
          revenue: { $sum: { $cond: [{ $eq: ["$status", "Completed"] }, "$amount", 0] } },
          completedCount: { $sum: { $cond: [{ $eq: ["$status", "Completed"] }, 1, 0] } },
          pendingCount: { $sum: { $cond: [{ $eq: ["$status", "Pending"] }, 1, 0] } }
        }
      }
    ])
    .toArray();
  const paymentTotals = paymentTotalsAgg[0] || { revenue: 0, completedCount: 0, pendingCount: 0 };

  const newUsers7d = await usersCol().countDocuments({
    createdAt: { $gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000) }
  });

  const topPricedPlots = await plotsCol()
    .find({}, { projection: { _id: 0, id: 1, title: 1, country: 1, county: 1, area: 1, price: 1 } })
    .sort({ price: -1, createdAt: -1, _id: -1 })
    .limit(5)
    .toArray();

  const topCounties = await plotsCol()
    .aggregate([
      { $group: { _id: "$county", listings: { $sum: 1 } } },
      { $sort: { listings: -1, _id: 1 } },
      { $limit: 5 },
      { $project: { _id: 0, county: "$_id", listings: 1 } }
    ])
    .toArray();

  return res.json({
    users: {
      total: totalUsers,
      active24h: activeUsers,
      newLast7Days: newUsers7d
    },
    plots: {
      total: totalPlots,
      topPriced: topPricedPlots,
      topCounties
    },
    payments: {
      revenue: Number(paymentTotals.revenue || 0),
      completedCount: Number(paymentTotals.completedCount || 0),
      pendingCount: Number(paymentTotals.pendingCount || 0)
    }
  });
});

async function connectDbWithRetry() {
  while (!dbReady) {
    dbInitAttempts += 1;
    try {
      await initDb();
      dbReady = true;
      console.log("MongoDB connected. Service is ready.");
      break;
    } catch (err) {
      console.error(`MongoDB init attempt ${dbInitAttempts} failed. Retrying in ${MONGODB_RETRY_DELAY_MS}ms.`);
      await new Promise((resolve) => {
        setTimeout(resolve, MONGODB_RETRY_DELAY_MS);
      });
    }
  }
}

async function start() {
  app.listen(PORT, HOST, () => {
    console.log(`TST PlotConnect running on http://${HOST}:${PORT}`);
    console.log(`Payment mode: ${PAYMENT_MODE}`);
    if (PAYMENT_MODE === "daraja") {
      console.log(`Daraja config loaded: ${isDarajaConfigured() ? "yes" : "no"}`);
    }
    console.log(`MongoDB retry delay: ${MONGODB_RETRY_DELAY_MS}ms`);
  });

  void connectDbWithRetry();
}

start().catch((err) => {
  console.error("Failed to start server:", err);
  process.exit(1);
});
