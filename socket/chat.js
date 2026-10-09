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

const MAX_MESSAGE_LENGTH = 2000;

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

    // Every handler destructures its payload inside the callback (never in the
    // parameter list) and is wrapped in try/catch: Socket.IO does not catch
    // handler exceptions, so an unguarded throw would crash the whole process.
    socket.on("conversation:join", (payload) => {
      try {
        const conversation = getConversationForUser(
          Number(payload?.conversationId),
          userId
        );
        if (!conversation) return;
        socket.join(`conversation:${conversation.id}`);
      } catch (error) {
        console.error("conversation:join failed:", error);
      }
    });

    socket.on("conversation:start", (payload, ack) => {
      try {
        const otherUserId = Number(payload?.userId);
        if (!Number.isInteger(otherUserId)) {
          ack?.({ ok: false, error: "userId must be a number" });
          return;
        }
        const conversation = getOrCreateDirectConversation(userId, otherUserId);
        socket.join(`conversation:${conversation.id}`);
        ack?.({ ok: true, conversationId: conversation.id });
      } catch (error) {
        ack?.({ ok: false, error: error.message });
      }
    });

    socket.on("message:send", (payload, ack) => {
      try {
        const text = String(payload?.content ?? "").trim();
        if (!text) {
          ack?.({ ok: false, error: "Message cannot be empty" });
          return;
        }
        if (text.length > MAX_MESSAGE_LENGTH) {
          ack?.({
            ok: false,
            error: `Message cannot exceed ${MAX_MESSAGE_LENGTH} characters`,
          });
          return;
        }

        const conversation = getConversationForUser(
          Number(payload?.conversationId),
          userId
        );
        if (!conversation) {
          ack?.({ ok: false, error: "Conversation not found" });
          return;
        }

        const created = createMessage({
          conversationId: conversation.id,
          senderId: userId,
          content: text,
        });
        if (!created) {
          ack?.({ ok: false, error: "Could not save message" });
          return;
        }

        const saved = formatMessage(created);

        io.to(`user:${conversation.user_a_id}`).emit("message:new", saved);
        io.to(`user:${conversation.user_b_id}`).emit("message:new", saved);
        ack?.({ ok: true, message: saved });
      } catch (error) {
        ack?.({ ok: false, error: error.message || "Could not send message" });
      }
    });

    socket.on("typing", (payload) => {
      try {
        const conversation = getConversationForUser(
          Number(payload?.conversationId),
          userId
        );
        if (!conversation) return;
        const otherId =
          conversation.user_a_id === userId
            ? conversation.user_b_id
            : conversation.user_a_id;
        io.to(`user:${otherId}`).emit("typing", {
          conversationId: conversation.id,
          userId,
          isTyping: Boolean(payload?.isTyping),
        });
      } catch (error) {
        console.error("typing failed:", error);
      }
    });

    socket.on("message:read", (payload) => {
      try {
        const conversation = getConversationForUser(
          Number(payload?.conversationId),
          userId
        );
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
      } catch (error) {
        console.error("message:read failed:", error);
      }
    });

    socket.on("disconnect", () => {
      removeOnline(userId, socket.id);
      io.emit("presence:update", { onlineUserIds: onlineIds() });
    });
  });
}
