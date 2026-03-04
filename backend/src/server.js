const path = require("path");
const { randomUUID } = require("crypto");
require("dotenv").config({ path: path.join(__dirname, "..", ".env") });
const express = require("express");
const cors = require("cors");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const { initDb, getDb } = require("./db");
const { signToken, requireAuth, requireAdmin, requireSuperAdmin } = require("./auth");
const { normalizePhone, initiateStkPush, isDarajaConfigured } = require("./daraja");

const app = express();
const PORT = process.env.PORT || 3000;
const JWT_SECRET = process.env.JWT_SECRET || "tstplotconnect-dev-secret";
const PAYMENT_MODE = (process.env.PAYMENT_MODE || "mock").toLowerCase();
const GOOGLE_MAPS_API_KEY = process.env.GOOGLE_MAPS_API_KEY || "";
const REQUIRE_HTTPS_ADMIN = (process.env.REQUIRE_HTTPS_ADMIN || "false").toLowerCase() === "true";
const ADMIN_MAX_LOGIN_ATTEMPTS = Number(process.env.ADMIN_MAX_LOGIN_ATTEMPTS || 5);
const ADMIN_LOCK_MINUTES = Number(process.env.ADMIN_LOCK_MINUTES || 15);

app.use(cors({
  origin: [
    "https://tstplotconnect.vercel.app",
    "https://tst-plotconnect.com",
    "https://www.tst-plotconnect.com"
  ],
  methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
  allowedHeaders: ["Content-Type", "Authorization"],
  credentials: true
}));
app.options("*", cors());
app.use(express.json());

function usersCol() {
  return getDb().collection("users");
}

function plotsCol() {
  return getDb().collection("plots");
}

function paymentsCol() {
  return getDb().collection("payments");
}

function locationMetadataCol() {
  return getDb().collection("location_metadata");
}

async function getLocationMetadata() {
  const meta = await locationMetadataCol().findOne({ key: "default" });
  if (meta) {
    return {
      countries: Array.isArray(meta.countries) ? meta.countries : [],
      countiesByCountry: meta.countiesByCountry && typeof meta.countiesByCountry === "object"
        ? meta.countiesByCountry
        : {},
      areasByCounty: meta.areasByCounty && typeof meta.areasByCounty === "object"
        ? meta.areasByCounty
        : {}
    };
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

function mapPlot(plot, unlocked) {
  const county = plot.county || plot.town || "";
  return {
    id: plot.id,
    title: plot.title,
    price: plot.price,
    country: plot.country || "Kenya",
    county,
    town: county,
    area: plot.area,
    description: plot.description || "",
    images: Array.isArray(plot.images) ? plot.images : [],
    videos: Array.isArray(plot.videos) ? plot.videos : [],
    caretaker: unlocked ? plot.caretaker : "Locked",
    whatsapp: unlocked ? plot.whatsapp : "Locked",
    unlocked
  };
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

async function getUnlockedFromRequest(req) {
  const authHeader = req.headers.authorization || "";
  const [type, token] = authHeader.split(" ");
  if (type !== "Bearer" || !token) {
    return false;
  }
  try {
    const payload = jwt.verify(token, JWT_SECRET);
    return !!(await getUserActiveActivation(payload.id));
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

async function createUserIfMissing(phone) {
  const existing = await usersCol().findOne({ phone });
  if (existing) {
    return existing;
  }

  const user = {
    id: randomUUID(),
    phone,
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
  res.json({ ok: true });
});

app.get("/", (_req, res) => {
  res.json({ ok: true, message: "API only. Use /api/* routes." });
});

app.get("/api/public/config", (_req, res) => {
  res.json({
    googleMapsApiKey: GOOGLE_MAPS_API_KEY
  });
});

app.post("/api/register", (_req, res) => {
  return res.status(410).json({
    error: "Registration disabled. Use /api/user/session."
  });
});

app.post("/api/user/session", async (req, res) => {
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

  const variants = getPhoneVariants(normalizedPhone);
  const existingAdmin = await usersCol().findOne({ is_admin: 1, phone: { $in: variants } });
  if (existingAdmin) {
    return res.status(403).json({ error: "Admin accounts must login through admin dashboard." });
  }

  const user = await createUserIfMissing(normalizedPhone);
  const token = signToken(user);
  return res.json({
    token,
    user: {
      id: user.id,
      phone: user.phone,
      isAdmin: !!user.is_admin,
      isSuperAdmin: !!user.is_super_admin,
      role: user.role || "user"
    }
  });
});

app.post("/api/auth/request-code", async (req, res) => {
  return res.status(410).json({
    error: "User phone verification is disabled. Super admin manages admin password recovery."
  });
});

app.post("/api/auth/verify-code", async (req, res) => {
  return res.status(410).json({
    error: "User phone verification is disabled. Super admin manages admin password recovery."
  });
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
      error: `Account temporarily locked. Try again in about ${retryInMinutes} minute(s).`,
      showForgotPassword: !!user.is_super_admin
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
        error: `Account temporarily locked after ${ADMIN_MAX_LOGIN_ATTEMPTS} failed attempts. Try again in about ${ADMIN_LOCK_MINUTES} minute(s).`,
        showForgotPassword: !!user.is_super_admin
      });
    }

    await usersCol().updateOne(
      { _id: user._id },
      { $set: { failedLoginAttempts: nextAttempts, lockUntil: null } }
    );
    return res.status(401).json({
      error: "Invalid credentials",
      failedAttempts: nextAttempts,
      showForgotPassword: !!user.is_super_admin && nextAttempts >= 3
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
  const now = Date.now();
  const activation = await getUserActiveActivation(req.user.id);
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

app.post("/api/pay", requireAuth, async (req, res) => {
  const { phone } = req.body || {};
  if (!phone || String(phone).length < 9) {
    return res.status(400).json({ error: "Valid phone required" });
  }

  let pendingId = null;
  try {
    normalizePhone(phone);

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
        expiresAt
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

    const normalizedPhone = normalizePhone(phone);
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
      expiresAt: null
    };
    const insertPending = await paymentsCol().insertOne(pending);
    pendingId = insertPending.insertedId;

    const stk = await initiateStkPush({ phone: normalizedPhone, amount: 50 });
    const checkout = stk.CheckoutRequestID || "";

    await paymentsCol().updateOne(
      { _id: pendingId },
      { $set: { mpesaReceipt: `CHECKOUT_${checkout}` } }
    );

    return res.json({
      message: "STK push sent. Complete payment on your phone.",
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

    if (resultCode !== 0) {
      return res.status(200).json({ ok: true });
    }

    const items = callback.CallbackMetadata && callback.CallbackMetadata.Item
      ? callback.CallbackMetadata.Item
      : [];
    const receiptItem = items.find((x) => x.Name === "MpesaReceiptNumber");
    const receipt = receiptItem && receiptItem.Value ? String(receiptItem.Value) : `TST${Date.now()}`;

    const activatedAt = new Date();
    const expiresAt = new Date(activatedAt.getTime() + 24 * 60 * 60 * 1000);

    await paymentsCol().updateOne(
      { _id: payment._id },
      {
        $set: {
          status: "Completed",
          mpesaReceipt: receipt,
          activatedAt,
          expiresAt
        }
      }
    );

    await syncUserActivationStatus(payment.userId, {
      status: "Completed",
      activatedAt,
      expiresAt
    });

    return res.status(200).json({ ok: true });
  } catch (_err) {
    return res.status(200).json({ ok: true });
  }
});

app.get("/api/plots", async (req, res) => {
  const country = req.query.country || "";
  const county = req.query.county || req.query.town || "";
  const area = req.query.area || "";

  const filter = {};
  if (country) {
    filter.country = country;
  }
  if (county) {
    filter.$or = [{ county }, { town: county }];
  }
  if (area) {
    filter.area = area;
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
    country = "Kenya",
    county = req.body?.town || "",
    town,
    area,
    description = "",
    caretaker,
    whatsapp,
    images = [],
    videos = []
  } = req.body || {};

  if (!title || !price || !county || !area || !caretaker || !whatsapp) {
    return res.status(400).json({ error: "Missing required fields" });
  }

  const plot = {
    id: randomUUID(),
    title,
    price: Number(price),
    country,
    county,
    town: county,
    area,
    description,
    caretaker,
    whatsapp,
    images: (images || []).filter(Boolean),
    videos: (videos || []).filter(Boolean),
    createdAt: new Date()
  };

  await plotsCol().insertOne(plot);
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
    country = existing.country || "Kenya",
    county = existing.county || existing.town,
    area = existing.area,
    description = existing.description,
    caretaker = existing.caretaker,
    whatsapp = existing.whatsapp,
    images = null,
    videos = null
  } = req.body || {};

  const setDoc = {
    title,
    price: Number(price),
    country,
    county,
    town: county,
    area,
    description,
    caretaker,
    whatsapp
  };

  if (images !== null) {
    setDoc.images = (images || []).filter(Boolean);
  }
  if (videos !== null) {
    setDoc.videos = (videos || []).filter(Boolean);
  }

  await plotsCol().updateOne({ id: req.params.id }, { $set: setDoc });
  const updated = await plotsCol().findOne({ id: req.params.id });
  return res.json(mapPlot(updated, true));
});

app.delete("/api/admin/plots/:id", requireSecureAdmin, requireAuth, requireAdmin, async (req, res) => {
  const result = await plotsCol().deleteOne({ id: req.params.id });
  if (!result.deletedCount) {
    return res.status(404).json({ error: "Plot not found" });
  }
  return res.status(204).send();
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

  return res.json({ message: "County added successfully." });
});

app.post("/api/super-admin/locations/area", requireSecureAdmin, requireAuth, requireAdmin, requireSuperAdmin, async (req, res) => {
  const { county, area } = req.body || {};
  const countyName = String(county || "").trim();
  const areaName = String(area || "").trim();
  if (!countyName || !areaName) {
    return res.status(400).json({ error: "county and area are required" });
  }

  const meta = await getLocationMetadata();
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

  return res.json({ message: "Area added successfully." });
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

app.post("/api/admin/activate", requireSecureAdmin, requireAuth, requireAdmin, async (req, res) => {
  const { userId } = req.body || {};
  if (!userId) {
    return res.status(400).json({ error: "userId is required" });
  }

  const user = await usersCol().findOne({ id: String(userId) }, { projection: { _id: 1, id: 1 } });
  if (!user) {
    return res.status(404).json({ error: "User not found" });
  }

  const now = new Date();
  const expires = new Date(now.getTime() + 24 * 60 * 60 * 1000);
  const receipt = `MANUAL${Date.now()}`;
  const payment = {
    id: randomUUID(),
    userId: user.id,
    amount: 50,
    mpesaReceipt: receipt,
    status: "Completed",
    timestamp: now,
    activatedAt: now,
    expiresAt: expires
  };
  await paymentsCol().insertOne(payment);
  await syncUserActivationStatus(user.id, payment);

  return res.json({ message: "User activated for 24 hours" });
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

async function start() {
  await initDb();

  app.listen(PORT, () => {
    console.log(`TST PlotConnect running on http://localhost:${PORT}`);
    console.log(`Payment mode: ${PAYMENT_MODE}`);
    if (PAYMENT_MODE === "daraja") {
      console.log(`Daraja config loaded: ${isDarajaConfigured() ? "yes" : "no"}`);
    }
  });
}

start().catch((err) => {
  console.error("Failed to start server:", err);
  process.exit(1);
});
