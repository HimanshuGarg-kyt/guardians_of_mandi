import { Router } from "express";
import bcrypt from "bcryptjs";
import {
  createUser,
  findUserById,
  findUserByUsername,
  publicUser,
} from "../models/User.js";
import { authMiddleware, signToken } from "../utils/authMiddleware.js";

const router = Router();

router.post("/register", (req, res) => {
  const { username, password, displayName } = req.body || {};

  if (!username || !password) {
    return res.status(400).json({ error: "Username and password are required" });
  }
  if (String(username).trim().length < 3) {
    return res.status(400).json({ error: "Username must be at least 3 characters" });
  }
  if (String(password).length < 6) {
    return res.status(400).json({ error: "Password must be at least 6 characters" });
  }
  if (findUserByUsername(username)) {
    return res.status(409).json({ error: "Username is already taken" });
  }

  const user = createUser({
    username,
    displayName: displayName?.trim() || username.trim(),
    passwordHash: bcrypt.hashSync(password, 10),
  });

  return res.status(201).json({
    token: signToken(user),
    user: publicUser(user),
  });
});

router.post("/login", (req, res) => {
  const { username, password } = req.body || {};
  const user = username ? findUserByUsername(username) : null;

  if (!user || !bcrypt.compareSync(password || "", user.password_hash)) {
    return res.status(401).json({ error: "Invalid username or password" });
  }

  return res.json({
    token: signToken(user),
    user: publicUser(user),
  });
});

router.get("/me", authMiddleware, (req, res) => {
  const user = findUserById(req.user.id);
  if (!user) return res.status(401).json({ error: "User not found" });
  return res.json({ user: publicUser(user) });
});

export default router;
