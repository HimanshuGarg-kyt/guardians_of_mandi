import { Router } from "express";
import { authMiddleware } from "../utils/authMiddleware.js";
import { listUsersExcept } from "../models/User.js";

const router = Router();

router.get("/", authMiddleware, (req, res) => {
  const users = listUsersExcept(req.user.id).map((user) => ({
    id: user.id,
    username: user.username,
    displayName: user.display_name,
    avatarColor: user.avatar_color || "#7bd389",
    lastSeenAt: user.last_seen_at || null,
    createdAt: user.created_at,
  }));
  res.json({ users });
});

export default router;
