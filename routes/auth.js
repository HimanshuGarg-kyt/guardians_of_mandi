import { Router } from "express";
import bcrypt from "bcryptjs";
import {
  createUser,
  findUserById,
  findUserByUsername,
  publicUser,
  setPasswordHash,
  updateUserProfile,
} from "../models/User.js";
import { authMiddleware, signToken } from "../utils/authMiddleware.js";
import { rateLimit } from "../utils/rateLimit.js";

const router = Router();

const authRateLimit = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: Number(process.env.AUTH_RATE_LIMIT_MAX) || 60,
});

const MAX_USERNAME = 200;
const MAX_DISPLAY_NAME = 200;
const MAX_PASSWORD = 200;

router.post("/register", authRateLimit, async (req, res) => {
  const username = String(req.body?.username ?? "").trim();
  const password = String(req.body?.password ?? "");
  const displayName = String(req.body?.displayName ?? "").trim();

  if (!username || !password) {
    return res.status(400).json({ error: "Username and password are required" });
  }
  if (username.length < 3) {
    return res.status(400).json({ error: "Username must be at least 3 characters" });
  }
  if (username.length > MAX_USERNAME) {
    return res
      .status(400)
      .json({ error: `Username must be at most ${MAX_USERNAME} characters` });
  }
  if (password.length < 6) {
    return res.status(400).json({ error: "Password must be at least 6 characters" });
  }
  if (password.length > MAX_PASSWORD) {
    return res
      .status(400)
      .json({ error: `Password must be at most ${MAX_PASSWORD} characters` });
  }
  if (displayName.length > MAX_DISPLAY_NAME) {
    return res
      .status(400)
      .json({ error: `Display name must be at most ${MAX_DISPLAY_NAME} characters` });
  }
  if (findUserByUsername(username)) {
    return res.status(409).json({ error: "Username is already taken" });
  }

  try {
    const user = createUser({
      username,
      displayName: displayName || username,
      passwordHash: await bcrypt.hash(password, 10),
    });
    if (!user) {
      return res.status(500).json({ error: "Could not create user" });
    }

    return res.status(201).json({
      token: signToken(user),
      user: publicUser(user),
    });
  } catch (error) {
    console.error("register failed:", error);
    return res.status(500).json({ error: "Could not create user" });
  }
});

router.post("/login", authRateLimit, async (req, res) => {
  try {
    const username = String(req.body?.username ?? "").trim();
    const password = String(req.body?.password ?? "");
    const user = username ? findUserByUsername(username) : null;

    if (!user || !(await bcrypt.compare(password, user.password_hash))) {
      return res.status(401).json({ error: "Invalid username or password" });
    }

    return res.json({
      token: signToken(user),
      user: publicUser(user),
    });
  } catch (error) {
    console.error("login failed:", error);
    return res.status(500).json({ error: "Could not sign in" });
  }
});

router.get("/me", authMiddleware, (req, res) => {
  const user = findUserById(req.user.id);
  if (!user) return res.status(401).json({ error: "User not found" });
  return res.json({ user: publicUser(user) });
});

const AVATAR_COLOR_RE = /^#[0-9a-fA-F]{3,8}$/;

router.patch("/me", authMiddleware, (req, res) => {
  const displayName = String(req.body?.displayName ?? "").trim();
  const avatarColor = String(req.body?.avatarColor ?? "").trim();

  if (!displayName) {
    return res.status(400).json({ error: "Display name is required" });
  }
  if (displayName.length > MAX_DISPLAY_NAME) {
    return res
      .status(400)
      .json({ error: `Display name must be at most ${MAX_DISPLAY_NAME} characters` });
  }
  if (avatarColor && !AVATAR_COLOR_RE.test(avatarColor)) {
    return res.status(400).json({ error: "Avatar color must be a hex color" });
  }

  const user = updateUserProfile(req.user.id, {
    displayName,
    ...(avatarColor ? { avatarColor } : {}),
  });
  return res.json({ user: publicUser(user) });
});

router.post("/me/password", authRateLimit, authMiddleware, async (req, res) => {
  const currentPassword = String(req.body?.currentPassword ?? "");
  const newPassword = String(req.body?.newPassword ?? "");

  const user = findUserById(req.user.id);
  if (!user) return res.status(401).json({ error: "User not found" });

  if (!(await bcrypt.compare(currentPassword, user.password_hash))) {
    return res.status(401).json({ error: "Current password is incorrect" });
  }
  if (newPassword.length < 6) {
    return res.status(400).json({ error: "Password must be at least 6 characters" });
  }
  if (newPassword.length > MAX_PASSWORD) {
    return res
      .status(400)
      .json({ error: `Password must be at most ${MAX_PASSWORD} characters` });
  }

  setPasswordHash(user.id, await bcrypt.hash(newPassword, 10));
  return res.json({ ok: true });
});

export default router;
