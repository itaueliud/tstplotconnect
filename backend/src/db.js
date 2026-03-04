const path = require("path");
const { randomUUID } = require("crypto");
const { MongoClient } = require("mongodb");
const bcrypt = require("bcryptjs");

const mongoUri = process.env.MONGODB_URI || "mongodb://127.0.0.1:27017";
const fallbackDbName =
  path.basename(path.resolve(__dirname, "..")).replace(/[^a-zA-Z0-9]/g, "_").toLowerCase() ||
  "tstplotconnect";
const dbName = process.env.MONGODB_DB_NAME || fallbackDbName;

let client = null;
let db = null;

function toDate(value, fallback = null) {
  if (!value) {
    return fallback;
  }
  if (value instanceof Date) {
    return value;
  }
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? fallback : parsed;
}

async function initDb() {
  if (db) {
    return db;
  }

  client = new MongoClient(mongoUri);
  await client.connect();
  db = client.db(dbName);

  await ensureCollections();
  await migrateLegacyData();
  await ensureIndexes();
  await seedAdminUser();
  await seedLocationMetadata();
  await seedPlots();

  return db;
}

function getDb() {
  if (!db) {
    throw new Error("Database is not initialized. Call initDb() first.");
  }
  return db;
}

async function closeDb() {
  if (!client) {
    return;
  }
  await client.close();
  client = null;
  db = null;
}

async function ensureCollections() {
  const names = new Set((await db.listCollections({}, { nameOnly: true }).toArray()).map((c) => c.name));
  const needed = ["users", "plots", "payments", "location_metadata"];
  for (const name of needed) {
    if (!names.has(name)) {
      await db.createCollection(name);
    }
  }
}

async function ensureIndexes() {
  await db.collection("users").createIndex({ id: 1 }, { unique: true });
  await db.collection("users").createIndex({ phone: 1 }, { unique: true });
  await db.collection("plots").createIndex({ id: 1 }, { unique: true });
  await db.collection("plots").createIndex({ country: 1, county: 1, area: 1 });
  await db.collection("plots").createIndex({ town: 1, area: 1 });
  await db.collection("payments").createIndex({ id: 1 }, { unique: true });
  await db.collection("payments").createIndex({ userId: 1, timestamp: -1 });
  await db.collection("payments").createIndex({ mpesaReceipt: 1 });
  await db.collection("location_metadata").createIndex({ key: 1 }, { unique: true });
}

async function migrateLegacyData() {
  await migrateUsers();
  await migratePlots();
  await migratePayments();
  await syncUsersFromPayments();
}

async function migrateUsers() {
  const users = db.collection("users");
  const cursor = users.find({});

  for await (const user of cursor) {
    const setDoc = {};

    if (!user.id) {
      setDoc.id = randomUUID();
    }
    if (!user.password && user.password_hash) {
      setDoc.password = user.password_hash;
    }
    if (typeof user.password === "undefined" && !user.password_hash) {
      setDoc.password = null;
    }
    if (typeof user.is_admin === "undefined") {
      setDoc.is_admin = 0;
    }
    if (!user.createdAt) {
      setDoc.createdAt = toDate(user.created_at, new Date());
    }
    if (typeof user.paymentStatus === "undefined") {
      setDoc.paymentStatus = false;
    }
    if (typeof user.failedLoginAttempts === "undefined") {
      setDoc.failedLoginAttempts = 0;
    }
    if (typeof user.lockUntil === "undefined") {
      setDoc.lockUntil = null;
    }
    if (typeof user.is_super_admin === "undefined") {
      setDoc.is_super_admin = 0;
    }
    if (typeof user.role === "undefined") {
      setDoc.role = user.is_super_admin ? "super_admin" : (user.is_admin ? "admin" : "user");
    }
    if (typeof user.activatedAt === "undefined") {
      setDoc.activatedAt = null;
    }
    if (typeof user.expiresAt === "undefined") {
      setDoc.expiresAt = null;
    }

    if (Object.keys(setDoc).length > 0) {
      await users.updateOne({ _id: user._id }, { $set: setDoc });
    }
  }
}

async function migratePlots() {
  const plots = db.collection("plots");
  const cursor = plots.find({});

  for await (const plot of cursor) {
    const setDoc = {};

    if (!plot.id) {
      setDoc.id = randomUUID();
    }
    if (!plot.caretaker && plot.caretaker_phone) {
      setDoc.caretaker = plot.caretaker_phone;
    }
    if (!plot.whatsapp && plot.whatsapp_phone) {
      setDoc.whatsapp = plot.whatsapp_phone;
    }
    if (!plot.createdAt) {
      setDoc.createdAt = toDate(plot.created_at, new Date());
    }
    if (!plot.country) {
      setDoc.country = "Kenya";
    }
    if (!plot.county) {
      setDoc.county = plot.town || "";
    }
    if (!plot.town && plot.county) {
      setDoc.town = plot.county;
    }
    if (!Array.isArray(plot.images)) {
      if (Array.isArray(plot.media)) {
        setDoc.images = plot.media.filter((m) => m.type === "image").map((m) => m.url);
      } else {
        setDoc.images = [];
      }
    }
    if (!Array.isArray(plot.videos)) {
      if (Array.isArray(plot.media)) {
        setDoc.videos = plot.media.filter((m) => m.type === "video").map((m) => m.url);
      } else {
        setDoc.videos = [];
      }
    }

    if (Object.keys(setDoc).length > 0) {
      await plots.updateOne({ _id: plot._id }, { $set: setDoc });
    }
  }
}

async function migratePayments() {
  const payments = db.collection("payments");
  const collectionNames = new Set((await db.listCollections({}, { nameOnly: true }).toArray()).map((c) => c.name));
  if (!collectionNames.has("activations")) {
    return;
  }

  const activationCount = await db.collection("activations").countDocuments();
  const paymentCount = await payments.countDocuments();
  if (activationCount === 0 || paymentCount > 0) {
    return;
  }

  const activations = db.collection("activations");
  const cursor = activations.find({});
  const docs = [];
  for await (const a of cursor) {
    docs.push({
      id: randomUUID(),
      userId: String(a.user_id || ""),
      amount: Number(a.amount || 0),
      mpesaReceipt: a.mpesa_receipt || "",
      status: a.status || "Pending",
      timestamp: toDate(a.created_at, new Date()),
      activatedAt: toDate(a.activated_at, null),
      expiresAt: toDate(a.expires_at, null)
    });
  }

  if (docs.length > 0) {
    await payments.insertMany(docs);
  }
}

async function syncUsersFromPayments() {
  const users = db.collection("users");
  const now = new Date();
  const cursor = users.find({}, { projection: { id: 1 } });

  for await (const user of cursor) {
    const latestActive = await db.collection("payments").findOne(
      {
        userId: user.id,
        status: "Completed",
        expiresAt: { $gt: now }
      },
      { sort: { timestamp: -1, _id: -1 } }
    );

    if (latestActive) {
      await users.updateOne(
        { _id: user._id },
        {
          $set: {
            activatedAt: latestActive.activatedAt || null,
            expiresAt: latestActive.expiresAt || null,
            paymentStatus: true
          }
        }
      );
    } else {
      await users.updateOne(
        { _id: user._id },
        { $set: { activatedAt: null, expiresAt: null, paymentStatus: false } }
      );
    }
  }
}

async function seedAdminUser() {
  const adminPhone = "0796675724";
  const adminPassword = "55-0608A";
  const hash = bcrypt.hashSync(adminPassword, 10);

  const exists = await db.collection("users").findOne({ phone: adminPhone });
  if (exists) {
    await db.collection("users").updateOne(
      { _id: exists._id },
      {
        $set: {
          phone: adminPhone,
          password: hash,
          is_admin: 1,
          is_super_admin: 1,
          role: "super_admin",
          failedLoginAttempts: 0,
          lockUntil: null
        }
      }
    );
    return;
  }

  // If super admin exists under another phone, normalize it back to default credentials.
  const existingSuper = await db.collection("users").findOne({ is_super_admin: 1 });
  if (existingSuper) {
    await db.collection("users").updateOne(
      { _id: existingSuper._id },
      {
        $set: {
          phone: adminPhone,
          password: hash,
          is_admin: 1,
          is_super_admin: 1,
          role: "super_admin",
          failedLoginAttempts: 0,
          lockUntil: null
        }
      }
    );
    return;
  }

  await db.collection("users").insertOne({
    id: randomUUID(),
    phone: adminPhone,
    password: hash,
    is_admin: 1,
    is_super_admin: 1,
    role: "super_admin",
    failedLoginAttempts: 0,
    lockUntil: null,
    activatedAt: null,
    expiresAt: null,
    paymentStatus: false,
    createdAt: new Date()
  });
}

async function seedLocationMetadata() {
  const coll = db.collection("location_metadata");
  const exists = await coll.findOne({ key: "default" });
  if (exists) {
    return;
  }

  await coll.insertOne({
    key: "default",
    countries: ["Kenya", "Tanzania", "Uganda", "Ethiopia"],
    countiesByCountry: {
      Kenya: ["Machakos", "Makueni", "Nairobi", "Kajiado"],
      Tanzania: [],
      Uganda: [],
      Ethiopia: []
    },
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
    },
    createdAt: new Date(),
    updatedAt: new Date()
  });
}

async function seedPlots() {
  const count = await db.collection("plots").countDocuments();
  if (count > 0) {
    return;
  }

  const samplePlots = [
    {
      title: "Bedsitter - Town",
      price: 6500,
      country: "Kenya",
      county: "Machakos",
      town: "Machakos",
      area: "Town",
      description: "Near bus stop and shops.",
      caretaker: "0712345671",
      whatsapp: "0712345671",
      images: ["https://images.unsplash.com/photo-1560448204-e02f11c3d0e2"],
      videos: []
    },
    {
      title: "1 Bedroom - Katungo",
      price: 8000,
      country: "Kenya",
      county: "Machakos",
      town: "Machakos",
      area: "Katungo",
      description: "Quiet estate with water on site.",
      caretaker: "0712345672",
      whatsapp: "0712345672",
      images: ["https://images.unsplash.com/photo-1599423300746-b62533397364"],
      videos: []
    },
    {
      title: "2 Bedroom - Mutituni",
      price: 12000,
      country: "Kenya",
      county: "Machakos",
      town: "Machakos",
      area: "Mutituni",
      description: "Close to shopping center.",
      caretaker: "0712345673",
      whatsapp: "0712345673",
      images: ["https://images.unsplash.com/photo-1600585154340-be6161a56a0c"],
      videos: []
    },
    {
      title: "Studio - South B",
      price: 6500,
      country: "Kenya",
      county: "Nairobi",
      town: "Nairobi",
      area: "South B",
      description: "Near transport and schools.",
      caretaker: "0712345678",
      whatsapp: "0712345678",
      images: ["https://images.unsplash.com/photo-1528909514045-2fa4ac7a08ba"],
      videos: []
    },
    {
      title: "2 Bedroom - Rongai",
      price: 13000,
      country: "Kenya",
      county: "Nairobi",
      town: "Nairobi",
      area: "Rongai",
      description: "Spacious with parking.",
      caretaker: "0712345679",
      whatsapp: "0712345679",
      images: ["https://images.unsplash.com/photo-1572120360610-d971b9f5d8ce"],
      videos: []
    },
    {
      title: "3 Bedroom - Kasarani",
      price: 17000,
      country: "Kenya",
      county: "Nairobi",
      town: "Nairobi",
      area: "Kasarani",
      description: "Family-friendly compound.",
      caretaker: "0712345680",
      whatsapp: "0712345680",
      images: ["https://images.unsplash.com/photo-1534854638093-bada1813e0e2"],
      videos: []
    },
    {
      title: "1 Bedroom - Elgon View",
      price: 9000,
      country: "Kenya",
      county: "Uasin Gishu",
      town: "Eldoret",
      area: "Elgon View",
      description: "Secure compound and reliable water supply.",
      caretaker: "0712345681",
      whatsapp: "0712345681",
      images: ["https://images.unsplash.com/photo-1494526585095-c41746248156"],
      videos: []
    }
  ];

  const docs = samplePlots.map((p) => ({
    id: randomUUID(),
    title: p.title,
    price: p.price,
    country: p.country || "Kenya",
    county: p.county || p.town || "",
    town: p.town,
    area: p.area,
    description: p.description || "",
    caretaker: p.caretaker,
    whatsapp: p.whatsapp,
    images: p.images || [],
    videos: p.videos || [],
    createdAt: new Date()
  }));

  await db.collection("plots").insertMany(docs);
}

module.exports = {
  initDb,
  getDb,
  closeDb,
  get db() {
    return db;
  }
};
