const { MongoClient } = require("mongodb");

const uri = process.env.TARGET_MONGODB_URI || process.env.MONGODB_URI;
const dbName = process.env.TARGET_DB_NAME || process.env.MONGODB_DB_NAME || "tstplotconnect";

if (!uri) {
  console.error("Missing TARGET_MONGODB_URI or MONGODB_URI");
  process.exit(1);
}

async function run() {
  const client = new MongoClient(uri, {
    serverSelectionTimeoutMS: 20000,
    connectTimeoutMS: 15000,
    socketTimeoutMS: 45000
  });

  try {
    await client.connect();
    const db = client.db(dbName);
    const users = await db.collection("users").countDocuments();
    const plots = await db.collection("plots").countDocuments();
    console.log(`TARGET_COUNTS users=${users} plots=${plots}`);
  } finally {
    await client.close();
  }
}

run().catch((err) => {
  console.error("VERIFY_FAIL:", err.message);
  process.exit(1);
});
