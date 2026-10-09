import { socketAuth } from "../utils/authMiddleware.js";
import {
  getConversationForUser,
  getConversationMemberIds,
  getOrCreateDirectConversation,
} from "../models/Conversation.js";
import { isBlockedEitherWay } from "../models/Block.js";
import { touchLastSeen } from "../models/User.js";
import {
  createMessage,
  deleteMessage,
  editMessage,
  formatMessage,
  forwardMessage,
  getMessageById,
  markConversationRead,
} from "../models/Message.js";
import { toggleReaction } from "../models/Reaction.js";

const MAX_MESSAGE_LENGTH = 2000;

const onlineUsers = new Map();

let ioRef = null;

export function getIo() {
  return ioRef;
}

// Refresh the last-seen stamp periodically so disconnects (or silent ones)
// report a recent time rather than a stale login.
const LAST_SEEN_HEARTBEAT_MS = 30 * 1000;

function addOnline(userId, socketId) {
  const current = onlineUsers.get(userId) || new Set();
  current.add(socketId);
  onlineUsers.set(userId, current);
}

// Deliver to every member of a conversation, sender included, so all devices
// converge on the same message list.
function broadcastToConversation(io, conversationId, event, payload) {
  for (const memberId of getConversationMemberIds(conversationId)) {
    io.to(`user:${memberId}`).emit(event, payload);
  }
}

// Blocks only apply to direct chats; group members are exempt.
function isBlockedDirectPair(conversation, userId) {
  const otherId =
    conversation.user_a_id === userId
      ? conversation.user_b_id
      : conversation.user_a_id;
  return otherId ? isBlockedEitherWay(userId, otherId) : false;
}

// Deliver an event to everyone in a conversation except the originating user
// (typing indicators, read receipts — the sender already knows).
function emitToOtherMembers(io, conversationId, exceptUserId, event, payload) {
  for (const memberId of getConversationMemberIds(conversationId)) {
    if (memberId === Number(exceptUserId)) continue;
    io.to(`user:${memberId}`).emit(event, payload);
  }
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
  ioRef = io;
  io.use(socketAuth);

  io.on("connection", (socket) => {
    const userId = Number(socket.user.id);
    socket.join(`user:${userId}`);
    addOnline(userId, socket.id);
    touchLastSeen(userId);
    const heartbeat = setInterval(() => touchLastSeen(userId), LAST_SEEN_HEARTBEAT_MS);
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
        if (isBlockedEitherWay(userId, otherUserId)) {
          ack?.({ ok: false, error: "Messaging is unavailable with this user" });
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

        if (!conversation.is_group && isBlockedDirectPair(conversation, userId)) {
          ack?.({ ok: false, error: "You can't message a blocked user" });
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

        broadcastToConversation(io, conversation.id, "message:new", saved);
        ack?.({ ok: true, message: saved });
      } catch (error) {
        ack?.({ ok: false, error: error.message || "Could not send message" });
      }
    });

    socket.on("message:edit", (payload, ack) => {
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

        const updated = editMessage({
          messageId: Number(payload?.messageId),
          senderId: userId,
          content: text,
        });
        if (!updated) {
          ack?.({ ok: false, error: "You can only edit your own messages" });
          return;
        }

        const saved = formatMessage(updated);
        broadcastToConversation(io, conversation.id, "message:updated", saved);
        ack?.({ ok: true, message: saved });
      } catch (error) {
        ack?.({ ok: false, error: error.message || "Could not edit message" });
      }
    });

    socket.on("message:delete", (payload, ack) => {      try {
        const conversation = getConversationForUser(
          Number(payload?.conversationId),
          userId
        );
        if (!conversation) {
          ack?.({ ok: false, error: "Conversation not found" });
          return;
        }

        const deleted = deleteMessage({
          messageId: Number(payload?.messageId),
          senderId: userId,
        });
        if (!deleted) {
          ack?.({ ok: false, error: "You can only delete your own messages" });
          return;
        }

        const saved = formatMessage(deleted);
        broadcastToConversation(io, conversation.id, "message:updated", saved);
        ack?.({ ok: true, message: saved });
      } catch (error) {
        ack?.({ ok: false, error: error.message || "Could not delete message" });
      }
    });

    socket.on("message:forward", (payload, ack) => {
      try {
        const source = getConversationForUser(
          Number(payload?.conversationId),
          userId
        );
        const target = getConversationForUser(
          Number(payload?.targetConversationId),
          userId
        );
        if (!source || !target) {
          ack?.({ ok: false, error: "Conversation not found" });
          return;
        }
        if (!target.is_group && isBlockedDirectPair(target, userId)) {
          ack?.({ ok: false, error: "Cannot forward to a blocked user" });
          return;
        }

        const messageId = Number(payload?.messageId);
        const original = getMessageById(messageId);
        if (!original || original.conversation_id !== source.id) {
          ack?.({ ok: false, error: "Message not found" });
          return;
        }
        if (original.deleted_at) {
          ack?.({ ok: false, error: "Deleted messages cannot be forwarded" });
          return;
        }
        const content = String(original.content ?? "");
        if (content.length > MAX_MESSAGE_LENGTH) {
          ack?.({ ok: false, error: "Message is too long to forward" });
          return;
        }

        const created = forwardMessage({
          messageId,
          targetConversationId: target.id,
          senderId: userId,
        });
        if (!created) {
          ack?.({ ok: false, error: "Could not forward message" });
          return;
        }

        const saved = formatMessage(created);
        broadcastToConversation(io, target.id, "message:new", saved);
        ack?.({ ok: true, message: saved });
      } catch (error) {
        ack?.({ ok: false, error: error.message || "Could not forward message" });
      }
    });

    socket.on("reaction:toggle", (payload, ack) => {
      try {
        const conversation = getConversationForUser(
          Number(payload?.conversationId),
          userId
        );
        if (!conversation) {
          ack?.({ ok: false, error: "Conversation not found" });
          return;
        }

        const messageId = Number(payload?.messageId);
        // The message must live in this conversation (guards reacting to a
        // message id from a chat you're only partly a member of).
        const inConversation = getMessageById(messageId);
        const reactions =
          inConversation && inConversation.conversation_id === conversation.id
            ? toggleReaction({ messageId, userId, emoji: String(payload?.emoji ?? "") })
            : null;
        if (!reactions) {
          ack?.({ ok: false, error: "Message not found" });
          return;
        }

        broadcastToConversation(io, conversation.id, "reaction:update", {
          messageId,
          reactions,
        });
        ack?.({ ok: true, reactions });
      } catch (error) {
        ack?.({ ok: false, error: error.message || "Could not update reaction" });
      }
    });

    socket.on("typing", (payload) => {
      try {
        const conversation = getConversationForUser(
          Number(payload?.conversationId),
          userId
        );
        if (!conversation) return;
        emitToOtherMembers(io, conversation.id, userId, "typing", {
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
        emitToOtherMembers(io, conversation.id, userId, "message:read", {
          conversationId: conversation.id,
          readerId: userId,
          readAt: new Date().toISOString(),
        });
      } catch (error) {
        console.error("message:read failed:", error);
      }
    });

    socket.on("disconnect", () => {
      clearInterval(heartbeat);
      removeOnline(userId, socket.id);
      // Only stamp once the user's LAST device is gone, and publish the time so
      // peers can show "last seen …" without refetching.
      if (!onlineUsers.has(userId)) {
        const lastSeenAt = new Date().toISOString();
        touchLastSeen(userId);
        io.emit("presence:update", {
          onlineUserIds: onlineIds(),
          offlineLastSeen: { [userId]: lastSeenAt },
        });
        return;
      }
      io.emit("presence:update", { onlineUserIds: onlineIds() });
    });
  });
}
