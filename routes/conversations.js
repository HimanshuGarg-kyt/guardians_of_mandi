import { Router } from "express";
import { authMiddleware } from "../utils/authMiddleware.js";
import { findUserById } from "../models/User.js";
import {
  formatConversation,
  getConversationForUser,
  getOrCreateDirectConversation,
  listConversationsForUser,
} from "../models/Conversation.js";
import { formatMessage, listMessages } from "../models/Message.js";

const router = Router();

router.get("/", authMiddleware, (req, res) => {
  const conversations = listConversationsForUser(req.user.id).map(
    formatConversation
  );
  res.json({ conversations });
});

router.post("/", authMiddleware, (req, res) => {
  const otherUserId = Number(req.body?.userId);
  if (!otherUserId) {
    return res.status(400).json({ error: "userId is required" });
  }
  if (!findUserById(otherUserId)) {
    return res.status(404).json({ error: "User not found" });
  }

  try {
    const conversation = getOrCreateDirectConversation(req.user.id, otherUserId);
    const detailed = listConversationsForUser(req.user.id).find(
      (row) => Number(row.id) === Number(conversation?.id)
    );
    if (!detailed) {
      return res.status(500).json({ error: "Conversation could not be loaded" });
    }
    res.status(201).json({ conversation: formatConversation(detailed) });
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

router.get("/:id/messages", authMiddleware, (req, res) => {
  const conversationId = Number(req.params.id);
  const conversation = getConversationForUser(conversationId, req.user.id);
  if (!conversation) {
    return res.status(404).json({ error: "Conversation not found" });
  }

  // req.query.q can be an array/object when the query string is repeated
  // (?q[]=a&q[]=b), so coerce it to a string before searching.
  const search =
    typeof req.query.q === "string" ? req.query.q : String(req.query.q ?? "");
  const messages = listMessages(conversationId, search).map(formatMessage);
  res.json({ messages });
});

export default router;
