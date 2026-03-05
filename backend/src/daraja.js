function formatTimestamp(date = new Date()) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  const h = String(date.getHours()).padStart(2, "0");
  const min = String(date.getMinutes()).padStart(2, "0");
  const s = String(date.getSeconds()).padStart(2, "0");
  return `${y}${m}${d}${h}${min}${s}`;
}

function normalizePhone(phone) {
  const digits = String(phone || "").replace(/\D/g, "");
  if (digits.startsWith("254") && digits.length === 12) {
    return digits;
  }
  if (digits.startsWith("0") && digits.length === 10) {
    return `254${digits.slice(1)}`;
  }
  if (digits.startsWith("7") && digits.length === 9) {
    return `254${digits}`;
  }
  throw new Error("Invalid Kenyan phone number");
}

function getConfig() {
  const env = String(process.env.DARAJA_ENV || "sandbox").toLowerCase();
  const isLive = env === "live" || env === "production";
  const baseUrl =
    isLive
      ? "https://api.safaricom.co.ke"
      : "https://sandbox.safaricom.co.ke";

  const consumerKey = String(process.env.DARAJA_CONSUMER_KEY || "").trim();
  const consumerSecret = String(process.env.DARAJA_CONSUMER_SECRET || "").trim();
  const shortcode = String(process.env.DARAJA_SHORTCODE || "").trim();
  const till = String(process.env.DARAJA_TILL || "").trim();
  const passkey = String(process.env.DARAJA_PASSKEY || "").trim();
  const callbackUrl = String(process.env.DARAJA_CALLBACK_URL || "").trim();
  const transactionType = String(process.env.DARAJA_TRANSACTION_TYPE || "").trim()
    || (till ? "CustomerBuyGoodsOnline" : "CustomerPayBillOnline");

  if (!consumerKey || !consumerSecret || !shortcode || !passkey || !callbackUrl) {
    throw new Error("Daraja config missing");
  }

  return { baseUrl, consumerKey, consumerSecret, shortcode, till, passkey, callbackUrl, transactionType };
}

function isDarajaConfigured() {
  return Boolean(
    process.env.DARAJA_CONSUMER_KEY &&
    process.env.DARAJA_CONSUMER_SECRET &&
    process.env.DARAJA_SHORTCODE &&
    process.env.DARAJA_PASSKEY &&
    process.env.DARAJA_CALLBACK_URL
  );
}

async function getAccessToken() {
  const cfg = getConfig();
  const credentials = Buffer.from(`${cfg.consumerKey}:${cfg.consumerSecret}`).toString("base64");
  const res = await fetch(
    `${cfg.baseUrl}/oauth/v1/generate?grant_type=client_credentials`,
    {
      method: "GET",
      headers: {
        Authorization: `Basic ${credentials}`,
        Accept: "application/json"
      }
    }
  );
  const raw = await res.text();
  let data = {};
  try {
    data = raw ? JSON.parse(raw) : {};
  } catch (_err) {
    data = {};
  }
  if (!res.ok || !data.access_token) {
    const details = data.errorMessage || data.error_description || raw || JSON.stringify(data);
    throw new Error(`Failed to get Daraja token (status ${res.status}): ${details}`);
  }
  return data.access_token;
}

async function initiateStkPush({ phone, amount }) {
  const cfg = getConfig();
  const token = await getAccessToken();
  const timestamp = formatTimestamp();
  const password = Buffer.from(`${cfg.shortcode}${cfg.passkey}${timestamp}`).toString("base64");
  const transactionType = cfg.transactionType;
  const partyB = transactionType === "CustomerBuyGoodsOnline"
    ? (cfg.till || cfg.shortcode)
    : cfg.shortcode;

  const payload = {
    BusinessShortCode: cfg.shortcode,
    Password: password,
    Timestamp: timestamp,
    TransactionType: transactionType,
    Amount: Number(amount),
    PartyA: phone,
    PartyB: partyB,
    PhoneNumber: phone,
    CallBackURL: cfg.callbackUrl,
    AccountReference: "TstPlotconnect",
    TransactionDesc: "Pay 50 to TstPlotconnect to activate account"
  };

  const res = await fetch(`${cfg.baseUrl}/mpesa/stkpush/v1/processrequest`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify(payload)
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok || data.ResponseCode !== "0") {
    const details = data.errorMessage || data.ResponseDescription || JSON.stringify(data);
    throw new Error(`STK push failed (status ${res.status}): ${details}`);
  }
  return data;
}

module.exports = {
  normalizePhone,
  initiateStkPush,
  isDarajaConfigured
};
