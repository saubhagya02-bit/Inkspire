const router = require("express").Router();
const passport = require("passport");
const { body } = require("express-validator");
const { validate } = require("../middleware/validate");
const {
  generateTokens,
  register,
  login,
  refreshToken,
  logout,
  verifyEmail,
  forgotPassword,
  resetPassword,
  setup2FA,
  enable2FA,
} = require("../controllers/authController");
const { authenticateToken } = require("../middleware/auth");

// Validation rules
const registerRules = [
  body("email").isEmail().normalizeEmail(),
  body("username").isAlphanumeric().isLength({ min: 3, max: 30 }),
  body("password")
    .isLength({ min: 8 })
    .matches(/^(?=.*[A-Z])(?=.*\d)/),
  body("fullName").optional().isLength({ min: 2, max: 100 }),
];

const loginRules = [
  body("email").isEmail().normalizeEmail(),
  body("password").notEmpty(),
];

// Auth routes
router.post("/register", registerRules, validate, register);
router.post("/login", loginRules, validate, login);
router.post("/refresh", refreshToken);
router.post("/logout", logout);
router.get("/verify-email/:token", verifyEmail);
router.post(
  "/forgot-password",
  body("email").isEmail(),
  validate,
  forgotPassword,
);
router.post(
  "/reset-password/:token",
  body("password").isLength({ min: 8 }),
  validate,
  resetPassword,
);

// 2FA routes
router.post("/2fa/setup", authenticateToken, setup2FA);
router.post("/2fa/enable", authenticateToken, enable2FA);

// OAuth — Google
router.get(
  "/oauth/google",
  passport.authenticate("google", { scope: ["profile", "email"] }),
);
router.get(
  "/oauth/google/callback",
  passport.authenticate("google", {
    session: false,
    failureRedirect: "/login?error=oauth",
  }),
  (req, res) => {
    const { accessToken, refreshToken } = generateTokens(req.user);
    res.redirect(
      `${process.env.FRONTEND_URL}/auth/callback?token=${accessToken}&refresh=${refreshToken}`,
    );
  },
);

// OAuth — GitHub
router.get(
  "/oauth/github",
  passport.authenticate("github", { scope: ["user:email"] }),
);
router.get(
  "/oauth/github/callback",
  passport.authenticate("github", {
    session: false,
    failureRedirect: "/login?error=oauth",
  }),
  (req, res) => {
    const { accessToken, refreshToken } = generateTokens(req.user);
    res.redirect(
      `${process.env.FRONTEND_URL}/auth/callback?token=${accessToken}&refresh=${refreshToken}`,
    );
  },
);

module.exports = router;
