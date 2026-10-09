import { Router } from "express";
import { authMiddleware } from "../utils/authMiddleware.js";
import {
  createStatus,
  deleteStatus,
  formatStatus,
  listStatusAuthorsForViewer,
  listStatusesForViewer,
  listStatusViewers,
  markStatusViewed,
  resolveExpiry,
} from "../models/Status.js";
import { all } from "../config/db.js";
import { getIo } from "../socket/chat.js";

const router = Router();

const BG_COLOR_RE = /^#[0-9a-fA-F]{3,8}$/;

router.get("/", authMiddleware, (req, res) => {
  const rows = listStatusesForViewer(req.user.id);
  res.json({
    statuses: rows.map((row) => formatStatus(row, req.user.id)),
    authors: listStatusAuthorsForViewer(req.user.id),
  });
});

router.post("/", authMiddleware, (req, res) => {
  const expiresAt = resolveExpiry({
    preset: req.body?.preset,
    expiresAt: req.body?.expiresAt,
  });
  if (!expiresAt) {
    return res
      .status(400)
      .json({ error: "Status must expire in the future (max 7 days)" });
  }
  const bgColor = String(req.body?.bgColor ?? "#7bd389");
  if (!BG_COLOR_RE.test(bgColor)) {
    return res.status(400).json({ error: "Invalid status color" });
  }

  const status = createStatus({
    userId: req.user.id,
    content: req.body?.content,
    bgColor,
    expiresAt,
  });
  if (!status) {
    return res
      .status(400)
      .json({ error: "Status text is required (max 500 characters)" });
  }

  // Ping everyone who may see it (all users minus mutual blocks) so their
  // sidebar rings appear without a refresh.
  notifyStatusCreated(req.user.id);

  res.status(201).json({ status: formatStatus(status, req.user.id) });
});

router.post("/:id/viewed", authMiddleware, (req, res) => {
  const statusId = Number(req.params.id);
  const viewCount = markStatusViewed({ statusId, viewerId: req.user.id });
  res.json({ ok: true, viewCount });
});

router.get("/:id/viewers", authMiddleware, (req, res) => {
  const statusId = Number(req.params.id);
  const status = listStatusesForViewer(req.user.id).find(
    (row) => Number(row.id) === statusId
  );
  if (!status || status.user_id !== req.user.id) {
    return res.status(403).json({ error: "Only the author can see viewers" });
  }
  res.json({ viewers: listStatusViewers(statusId) });
});

router.delete("/:id", authMiddleware, (req, res) => {
  const ok = deleteStatus({ statusId: Number(req.params.id), userId: req.user.id });
  if (!ok) return res.status(404).json({ error: "Status not found" });
  res.json({ ok: true });
});

function notifyStatusCreated(authorId) {
  const io = getIo();
  if (!io) return;
  for (const viewerId of recipientIds(authorId)) {
    io.to(`user:${viewerId}`).emit("status:new", { authorId });
  }
}

// Everyone the author has not blocked and who has not blocked the author.
function recipientIds(authorId) {
  return all(
    `SELECT id FROM users
     WHERE id != ?
       AND id NOT IN (
         SELECT blocked_id FROM blocks WHERE blocker_id = ?
         UNION
         SELECT blocker_id FROM blocks WHERE blocked_id = ?
       )`,
    [authorId, authorId, authorId]
  ).map((row) => Number(row.id));
}

export default router;
