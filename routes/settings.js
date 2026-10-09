import { Router } from "express";
import { authMiddleware } from "../utils/authMiddleware.js";
import { getTheme, setTheme, getWallpapers, setWallpaper } from "../models/Settings.js";
import { getConversationForUser } from "../models/Conversation.js";
import { blockUser, listBlockedUsers, unblockUser } from "../models/Block.js";
import { findUserById } from "../models/User.js";

const router = Router();

const THEMES = new Set(["dark", "light"]);
const WALLPAPER_RE = /^[a-z0-9_-]{1,32}$/i;

router.get("/", authMiddleware, (req, res) => {
  const wallpapers = {};
  for (const row of getWallpapers(req.user.id)) {
    wallpapers[Number(row.conversation_id)] = row.wallpaper;
  }
  res.json({ theme: getTheme(req.user.id), wallpapers });
});

router.put("/theme", authMiddleware, (req, res) => {
  const theme = String(req.body?.theme ?? "");
  if (!THEMES.has(theme)) {
    return res.status(400).json({ error: "Theme must be 'dark' or 'light'" });
  }
  res.json({ theme: setTheme(req.user.id, theme) });
});

router.put("/wallpapers/:conversationId", authMiddleware, (req, res) => {
  const conversationId = Number(req.params.conversationId);
  const conversation = getConversationForUser(conversationId, req.user.id);
  if (!conversation) {
    return res.status(404).json({ error: "Conversation not found" });
  }
  const wallpaper = String(req.body?.wallpaper ?? "");
  if (!WALLPAPER_RE.test(wallpaper)) {
    return res.status(400).json({ error: "Invalid wallpaper" });
  }
  setWallpaper(req.user.id, conversation.id, wallpaper);
  res.json({ conversationId, wallpaper });
});

router.get("/blocks", authMiddleware, (req, res) => {
  res.json({ blocks: listBlockedUsers(req.user.id) });
});

router.post("/blocks", authMiddleware, (req, res) => {
  const blockedId = Number(req.body?.userId);
  if (blockedId === req.user.id) {
    return res.status(400).json({ error: "You cannot block yourself" });
  }
  if (!findUserById(blockedId)) {
    return res.status(404).json({ error: "User not found" });
  }
  blockUser(req.user.id, blockedId);
  res.json({ ok: true, blocks: listBlockedUsers(req.user.id) });
});

router.delete("/blocks/:userId", authMiddleware, (req, res) => {
  const blockedId = Number(req.params.userId);
  unblockUser(req.user.id, blockedId);
  res.json({ ok: true, blocks: listBlockedUsers(req.user.id) });
});

export default router;
