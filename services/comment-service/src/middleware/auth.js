const authenticateToken = (req, res, next) => {
  const userId = req.headers["x-user-id"];

  if (!userId) {
    return res.status(401).json({ error: "Unauthorized" });
  }

  req.user = {
    id: userId,
    role: req.headers["x-user-role"] || "user",
    email: req.headers["x-user-email"] || "",
    username: req.headers["x-user-username"] || "",
  };

  next();
};

module.exports = { authenticateToken };
