const { MongoClient } = require("mongodb");

function required(name) {
  const value = process.env[name];
  if (!value || !String(value).trim()) {
    throw new Error(`${name} is required`);
  }
  return value;
}

function nowIso() {
  return new Date().toISOString();
}

async function copyCollection({ sourceDb, targetDb, collectionName, uniqueKey }) {
  const sourceCol = sourceDb.collection(collectionName);
  const targetCol = targetDb.collection(collectionName);

  const docs = await sourceCol.find({}).toArray();
  let inserted = 0;
  let updated = 0;

  for (const doc of docs) {
    const { _id, ...rest } = doc;
    const keyValue = rest[uniqueKey];

    if (typeof keyValue === "undefined" || keyValue === null || keyValue === "") {
      continue;
    }

    const result = await targetCol.updateOne(
      { [uniqueKey]: keyValue },
      {
        $set: {
          ...rest,
          migratedAt: new Date(),
          migratedFrom: process.env.SOURCE_DB_NAME || "tstplotconnect"
        },
        $setOnInsert: {
          createdAt: rest.createdAt || new Date()
        }
      },
      { upsert: true }
    );

    if (result.upsertedCount > 0) inserted += 1;
    if (result.matchedCount > 0 && result.modifiedCount > 0) updated += 1;
  }

  return {
    collectionName,
    totalSource: docs.length,
    inserted,
    updated
  };
}

async function run() {
  const sourceUri = required("SOURCE_MONGODB_URI");
  const targetUri = required("TARGET_MONGODB_URI");
  const sourceDbName = process.env.SOURCE_DB_NAME || "tstplotconnect";
  const targetDbName = process.env.TARGET_DB_NAME || "tstplotconnect";

  const sourceClient = new MongoClient(sourceUri, {
    serverSelectionTimeoutMS: 20000,
    connectTimeoutMS: 15000,
    socketTimeoutMS: 45000
  });

  const targetClient = new MongoClient(targetUri, {
    serverSelectionTimeoutMS: 20000,
    connectTimeoutMS: 15000,
    socketTimeoutMS: 45000
  });

  try {
    console.log("Connecting to source cluster...");
    await sourceClient.connect();
    console.log("Source cluster connected.");

    console.log("Connecting to target cluster...");
    await targetClient.connect();
    console.log("Target cluster connected.");

    const sourceDb = sourceClient.db(sourceDbName);
    const targetDb = targetClient.db(targetDbName);

    console.log("Pinging source database...");
    await sourceDb.command({ ping: 1 });
    console.log("Source database ping OK.");

    console.log("Pinging target database...");
    await targetDb.command({ ping: 1 });
    console.log("Target database ping OK.");

    const userResult = await copyCollection({
      sourceDb,
      targetDb,
      collectionName: "users",
      uniqueKey: "id"
    });

    const plotResult = await copyCollection({
      sourceDb,
      targetDb,
      collectionName: "plots",
      uniqueKey: "id"
    });

    const userCount = await targetDb.collection("users").countDocuments();
    const plotCount = await targetDb.collection("plots").countDocuments();

    console.log("Migration complete", {
      at: nowIso(),
      sourceDbName,
      targetDbName,
      users: userResult,
      plots: plotResult,
      targetTotals: { userCount, plotCount }
    });
  } finally {
    await sourceClient.close();
    await targetClient.close();
  }
}

run().catch((error) => {
  console.error("Migration failed:", error.message);
  process.exit(1);
});
