import { all, get, lastInsertId, run } from "../config/db.js";

export function createMessage({ conversationId, senderId, content }) {
  run(
    `INSERT INTO messages (conversation_id, sender_id, content)
     VALUES (?, ?, ?)`,
    [conversationId, senderId, content]
  );
  return getMessageById(lastInsertId());
}

export function getMessageById(id) {
  return get(
    `SELECT m.*, u.username AS sender_username, u.display_name AS sender_display_name
     FROM messages m
     JOIN users u ON u.id = m.sender_id
     WHERE m.id = ?`,
    [id]
  );
}

export function listMessages(conversationId, search = "") {
  const query = search.trim();
  if (query) {
    return all(
      `SELECT m.*, u.username AS sender_username, u.display_name AS sender_display_name
       FROM messages m
       JOIN users u ON u.id = m.sender_id
       WHERE m.conversation_id = ? AND m.content LIKE ?
       ORDER BY m.created_at ASC, m.id ASC`,
      [conversationId, `%${query}%`]
    );
  }

  return all(
    `SELECT m.*, u.username AS sender_username, u.display_name AS sender_display_name
     FROM messages m
     JOIN users u ON u.id = m.sender_id
     WHERE m.conversation_id = ?
     ORDER BY m.created_at ASC, m.id ASC`,
    [conversationId]
  );
}

export function markConversationRead(conversationId, readerId) {
  run(
    `UPDATE messages
     SET read_at = datetime('now')
     WHERE conversation_id = ?
       AND sender_id != ?
       AND read_at IS NULL`,
    [conversationId, readerId]
  );

  return all(
    `SELECT * FROM messages
     WHERE conversation_id = ? AND sender_id != ? AND read_at IS NOT NULL`,
    [conversationId, readerId]
  );
}

export function formatMessage(row) {
  return {
    id: row.id,
    conversationId: row.conversation_id,
    senderId: row.sender_id,
    senderUsername: row.sender_username,
    senderDisplayName: row.sender_display_name,
    content: row.content,
    createdAt: row.created_at,
    readAt: row.read_at,
  };
}
