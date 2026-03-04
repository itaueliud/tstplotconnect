const jwt = require("jsonwebtoken");

const JWT_SECRET = process.env.JWT_SECRET || "tstplotconnect-dev-secret";

function signToken(user) {
  return jwt.sign(
    {
      id: user.id,
      phone: user.phone,
      isAdmin: !!user.is_admin,
      isSuperAdmin: !!user.is_super_admin
    },
    JWT_SECRET,
    { expiresIn: "7d" }
  );
}

function requireAuth(req, res, next) {
  const authHeader = req.headers.authorization || "";
  const [type, token] = authHeader.split(" ");

  if (type !== "Bearer" || !token) {
    return res.status(401).json({ error: "Unauthorized" });
  }

  try {
    req.user = jwt.verify(token, JWT_SECRET);
    return next();
  } catch (_err) {
    return res.status(401).json({ error: "Invalid token" });
  }
}

function requireAdmin(req, res, next) {
  if (!req.user || !req.user.isAdmin) {
    return res.status(403).json({ error: "Admin access required" });
  }
  return next();
}

function requireSuperAdmin(req, res, next) {
  if (!req.user || !req.user.isSuperAdmin) {
    return res.status(403).json({ error: "Super admin access required" });
  }
  return next();
}

module.exports = {
  signToken,
  requireAuth,
  requireAdmin,
  requireSuperAdmin
};
