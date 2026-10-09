import { all, get, run } from "../config/db.js";

// A fixed palette keeps payloads small and the UI predictable; anything else
// is rejected server-side.
export const ALLOWED_EMOJIS = ["👍", "❤️", "😂", "😮", "😢", "🙏", "✅", "🎉"];

export function toggleReaction({ messageId, userId, emoji }) {
  if (!ALLOWED_EMOJIS.includes(emoji)) return null;

  const message = get(
    `SELECT id, conversation_id FROM messages WHERE id = ? AND deleted_at IS NULL`,
    [messageId]
  );
  if (!message) return null;

  const existing = get(
    `SELECT 1 FROM reactions WHERE message_id = ? AND user_id = ? AND emoji = ?`,
    [messageId, userId, emoji]
  );
  if (existing) {
    run(
      `DELETE FROM reactions WHERE message_id = ? AND user_id = ? AND emoji = ?`,
      [messageId, userId, emoji]
    );
  } else {
    run(
      `INSERT INTO reactions (message_id, user_id, emoji) VALUES (?, ?, ?)`,
      [messageId, userId, emoji]
    );
  }

  return getReactionsForMessage(messageId);
}

export function getReactionsForMessage(messageId) {
  const rows = all(
    `SELECT emoji, COUNT(*) AS count, GROUP_CONCAT(user_id) AS user_ids
     FROM reactions
     WHERE message_id = ?
     GROUP BY emoji
     ORDER BY MIN(created_at) ASC`,
    [messageId]
  );
  return rows.map((row) => ({
    emoji: row.emoji,
    count: Number(row.count),
    userIds: String(row.user_ids || "")
      .split(",")
      .filter(Boolean)
      .map(Number),
  }));
}

// Reactions for every message in one conversation, keyed by message id, so
// history loads in a single query instead of one per message.
export function getReactionsForConversation(conversationId) {
  const rows = all(
    `SELECT r.message_id, r.emoji, COUNT(*) AS count, GROUP_CONCAT(r.user_id) AS user_ids
     FROM reactions r
     JOIN messages m ON m.id = r.message_id
     WHERE m.conversation_id = ?
     GROUP BY r.message_id, r.emoji
     ORDER BY MIN(r.created_at) ASC`,
    [conversationId]
  );
  const map = {};
  for (const row of rows) {
    const id = Number(row.message_id);
    if (!map[id]) map[id] = [];
    map[id].push({
      emoji: row.emoji,
      count: Number(row.count),
      userIds: String(row.user_ids || "")
        .split(",")
        .filter(Boolean)
        .map(Number),
    });
  }
  return map;
}
