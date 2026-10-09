import { Router } from "express";
import { authMiddleware } from "../utils/authMiddleware.js";
import { findUserById } from "../models/User.js";
import {
  createGroupConversation,
  formatConversationForUser,
  getConversationForUser,
  getConversationMemberIds,
  getOrCreateDirectConversation,
  listConversationsForUser,
} from "../models/Conversation.js";
import { formatMessage, listMessages } from "../models/Message.js";
import { getReactionsForConversation } from "../models/Reaction.js";
import { getIo } from "../socket/chat.js";

const router = Router();

router.get("/", authMiddleware, (req, res) => {
  const conversations = listConversationsForUser(req.user.id).map((row) =>
    formatConversationForUser(row, req.user.id)
  );
  res.json({ conversations });
});

router.post("/", authMiddleware, (req, res) => {
  // A request is a group creation when it names a group or lists members.
  const isGroupRequest =
    req.body?.name !== undefined || Array.isArray(req.body?.memberIds);

  if (isGroupRequest) {
    const memberIds = Array.isArray(req.body?.memberIds)
      ? req.body.memberIds.map(Number)
      : [];
    try {
      const group = createGroupConversation(
        req.user.id,
        String(req.body?.name ?? ""),
        memberIds
      );
      notifyMembersOfNewConversation(group.id);
      return res.status(201).json({
        conversation: formatConversationForUser(
          listConversationsForUser(req.user.id).find(
            (row) => Number(row.id) === Number(group.id)
          ),
          req.user.id
        ),
      });
    } catch (error) {
      return res.status(400).json({ error: error.message });
    }
  }

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
    res.status(201).json({
      conversation: formatConversationForUser(detailed, req.user.id),
    });
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

router.get("/:id/members", authMiddleware, (req, res) => {
  const conversationId = Number(req.params.id);
  const conversation = getConversationForUser(conversationId, req.user.id);
  if (!conversation) {
    return res.status(404).json({ error: "Conversation not found" });
  }
  res.json({ members: formatConversationForUser(conversation, req.user.id).members });
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
  const reactions = getReactionsForConversation(conversationId);
  const messages = listMessages(conversationId, search).map((row) => ({
    ...formatMessage(row),
    reactions: reactions[row.id] || [],
  }));
  res.json({ messages });
});

function notifyMembersOfNewConversation(conversationId) {
  const io = getIo();
  if (!io) return;
  for (const memberId of getConversationMemberIds(conversationId)) {
    io.to(`user:${memberId}`).emit("conversation:new", { conversationId });
  }
}

export default router;
