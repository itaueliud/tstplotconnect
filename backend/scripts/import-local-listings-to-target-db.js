const fs = require("fs");
const path = require("path");
const { MongoClient } = require("mongodb");

function readJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, "utf8"));
}

function text(value) {
  return String(value || "").trim();
}

function parseFirstJsonLd(html) {
  const matches = [...html.matchAll(/<script\s+type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi)];
  for (const match of matches) {
    const raw = (match[1] || "").trim();
    if (!raw) continue;
    try {
      const parsed = JSON.parse(raw);
      if (parsed && typeof parsed === "object") return parsed;
    } catch (_err) {
      // Ignore malformed JSON-LD blocks and continue.
    }
  }
  return null;
}

function extractPrice(description) {
  const desc = text(description);
  const m = desc.match(/KES\s*([\d,]+)/i);
  if (!m) return null;
  const n = Number(String(m[1]).replace(/,/g, ""));
  return Number.isFinite(n) ? n : null;
}

function normalizeAreaFromTitle(title) {
  const clean = text(title).replace(/\|\s*TST PlotConnect$/i, "");
  const parts = clean.split("|").map((s) => s.trim()).filter(Boolean);
  if (parts.length >= 2) return parts[1];
  return "";
}

async function run() {
  const targetUri = process.env.TARGET_MONGODB_URI || process.env.MONGODB_URI;
  const targetDbName = process.env.TARGET_DB_NAME || process.env.MONGODB_DB_NAME || "tstplotconnect";

  if (!targetUri) {
    throw new Error("TARGET_MONGODB_URI (or MONGODB_URI) is required");
  }

  const root = path.resolve(__dirname, "..", "..");
  const listingsDir = path.join(root, "frontend", "public", "listings");
  const manifestPath = path.join(listingsDir, "manifest.json");

  const manifest = readJson(manifestPath);
  const entries = Array.isArray(manifest.entries) ? manifest.entries : [];

  const client = new MongoClient(targetUri, {
    serverSelectionTimeoutMS: 20000,
    connectTimeoutMS: 15000,
    socketTimeoutMS: 45000
  });

  let inserted = 0;
  let updated = 0;

  try {
    await client.connect();
    const db = client.db(targetDbName);
    const plots = db.collection("plots");

    for (const entry of entries) {
      const htmlFile = path.join(listingsDir, entry.file);
      if (!fs.existsSync(htmlFile)) continue;

      const html = fs.readFileSync(htmlFile, "utf8");
      const ld = parseFirstJsonLd(html) || {};

      const id = text(entry.id);
      if (!id) continue;

      const title = text(ld.name || entry.title);
      const description = text(ld.description || entry.description);
      const image = Array.isArray(ld.image) ? ld.image.filter(Boolean) : (ld.image ? [ld.image] : []);
      const priceFromSchema = Number(ld?.offers?.price);
      const price = Number.isFinite(priceFromSchema) ? priceFromSchema : extractPrice(description) || 0;

      const locality = text(ld?.address?.addressLocality);
      const region = text(ld?.address?.addressRegion);
      const country = text(ld?.address?.addressCountry || "Kenya") || "Kenya";

      const county = locality || region || "Machakos";
      const area = normalizeAreaFromTitle(entry.title) || region || locality || "";

      const createdAt = new Date(entry.lastmod || Date.now());

      const doc = {
        id,
        title: title || text(entry.title),
        price,
        category: "Lodges",
        country,
        county,
        town: county,
        area,
        description,
        caretaker: "",
        whatsapp: "",
        images: image,
        videos: [],
        lat: null,
        lng: null,
        mapLink: "",
        priority: "medium",
        updatedAt: new Date()
      };

      const result = await plots.updateOne(
        { id },
        {
          $set: doc,
          $setOnInsert: { createdAt }
        },
        { upsert: true }
      );

      if (result.upsertedCount > 0) inserted += 1;
      if (result.matchedCount > 0 && result.modifiedCount > 0) updated += 1;
    }

    const total = await plots.countDocuments();
    console.log(`Imported listings complete. inserted=${inserted} updated=${updated} totalPlots=${total}`);
  } finally {
    await client.close();
  }
}

run().catch((err) => {
  console.error("Import failed:", err.message);
  process.exit(1);
});
