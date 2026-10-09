import { socketAuth } from "../utils/authMiddleware.js";
import {
  getConversationForUser,
  getOrCreateDirectConversation,
} from "../models/Conversation.js";
import {
  createMessage,
  formatMessage,
  markConversationRead,
} from "../models/Message.js";

const onlineUsers = new Map();

function addOnline(userId, socketId) {
  const current = onlineUsers.get(userId) || new Set();
  current.add(socketId);
  onlineUsers.set(userId, current);
}

function removeOnline(userId, socketId) {
  const current = onlineUsers.get(userId);
  if (!current) return;
  current.delete(socketId);
  if (current.size === 0) onlineUsers.delete(userId);
  else onlineUsers.set(userId, current);
}

function onlineIds() {
  return [...onlineUsers.keys()].map(Number);
}

export function initChatSocket(io) {
  io.use(socketAuth);

  io.on("connection", (socket) => {
    const userId = Number(socket.user.id);
    socket.join(`user:${userId}`);
    addOnline(userId, socket.id);
    io.emit("presence:update", { onlineUserIds: onlineIds() });

    socket.on("conversation:join", ({ conversationId }) => {
      const conversation = getConversationForUser(Number(conversationId), userId);
      if (!conversation) return;
      socket.join(`conversation:${conversation.id}`);
    });

    socket.on("conversation:start", ({ userId: otherUserId }, ack) => {
      try {
        const conversation = getOrCreateDirectConversation(
          userId,
          Number(otherUserId)
        );
        socket.join(`conversation:${conversation.id}`);
        ack?.({ ok: true, conversationId: conversation.id });
      } catch (error) {
        ack?.({ ok: false, error: error.message });
      }
    });

    socket.on("message:send", ({ conversationId, content }, ack) => {
      const text = String(content || "").trim();
      if (!text) {
        ack?.({ ok: false, error: "Message cannot be empty" });
        return;
      }

      const conversation = getConversationForUser(Number(conversationId), userId);
      if (!conversation) {
        ack?.({ ok: false, error: "Conversation not found" });
        return;
      }

      const saved = formatMessage(
        createMessage({
          conversationId: conversation.id,
          senderId: userId,
          content: text,
        })
      );

      io.to(`user:${conversation.user_a_id}`).emit("message:new", saved);
      io.to(`user:${conversation.user_b_id}`).emit("message:new", saved);
      ack?.({ ok: true, message: saved });
    });

    socket.on("typing", ({ conversationId, isTyping }) => {
      const conversation = getConversationForUser(Number(conversationId), userId);
      if (!conversation) return;
      const otherId =
        conversation.user_a_id === userId
          ? conversation.user_b_id
          : conversation.user_a_id;
      io.to(`user:${otherId}`).emit("typing", {
        conversationId: conversation.id,
        userId,
        isTyping: Boolean(isTyping),
      });
    });

    socket.on("message:read", ({ conversationId }) => {
      const conversation = getConversationForUser(Number(conversationId), userId);
      if (!conversation) return;
      markConversationRead(conversation.id, userId);
      const otherId =
        conversation.user_a_id === userId
          ? conversation.user_b_id
          : conversation.user_a_id;
      io.to(`user:${otherId}`).emit("message:read", {
        conversationId: conversation.id,
        readerId: userId,
        readAt: new Date().toISOString(),
      });
    });

    socket.on("disconnect", () => {
      removeOnline(userId, socket.id);
      io.emit("presence:update", { onlineUserIds: onlineIds() });
    });
  });
}
