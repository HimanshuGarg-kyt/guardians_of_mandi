import { all, get, lastInsertId, run } from "../config/db.js";

function orderedPair(userId, otherId) {
  const a = Number(userId);
  const b = Number(otherId);
  return a < b ? [a, b] : [b, a];
}

export function getOrCreateDirectConversation(userId, otherUserId) {
  if (Number(userId) === Number(otherUserId)) {
    throw new Error("Cannot start a chat with yourself");
  }

  const [userA, userB] = orderedPair(userId, otherUserId);
  const existing = get(
    `SELECT * FROM conversations WHERE user_a_id = ? AND user_b_id = ?`,
    [userA, userB]
  );
  if (existing) return existing;

  run(`INSERT INTO conversations (user_a_id, user_b_id) VALUES (?, ?)`, [
    userA,
    userB,
  ]);
  return get(`SELECT * FROM conversations WHERE id = ?`, [lastInsertId()]);
}

export function getConversationForUser(conversationId, userId) {
  return get(
    `SELECT * FROM conversations
     WHERE id = ? AND (user_a_id = ? OR user_b_id = ?)`,
    [conversationId, userId, userId]
  );
}

export function listConversationsForUser(userId) {
  return all(
    `SELECT
        c.id,
        c.created_at,
        CASE WHEN c.user_a_id = ? THEN c.user_b_id ELSE c.user_a_id END AS other_user_id,
        u.username AS other_username,
        u.display_name AS other_display_name,
        (
          SELECT content FROM messages m
          WHERE m.conversation_id = c.id
          ORDER BY m.created_at DESC, m.id DESC
          LIMIT 1
        ) AS last_message,
        (
          SELECT created_at FROM messages m
          WHERE m.conversation_id = c.id
          ORDER BY m.created_at DESC, m.id DESC
          LIMIT 1
        ) AS last_message_at,
        (
          SELECT COUNT(*) FROM messages m
          WHERE m.conversation_id = c.id
            AND m.sender_id != ?
            AND m.read_at IS NULL
        ) AS unread_count
     FROM conversations c
     JOIN users u ON u.id = CASE WHEN c.user_a_id = ? THEN c.user_b_id ELSE c.user_a_id END
     WHERE c.user_a_id = ? OR c.user_b_id = ?
     ORDER BY COALESCE(last_message_at, c.created_at) DESC`,
    [userId, userId, userId, userId, userId]
  );
}

export function formatConversation(row) {
  return {
    id: row.id,
    createdAt: row.created_at,
    otherUser: {
      id: row.other_user_id,
      username: row.other_username,
      displayName: row.other_display_name,
    },
    lastMessage: row.last_message,
    lastMessageAt: row.last_message_at,
    unreadCount: Number(row.unread_count || 0),
  };
}
