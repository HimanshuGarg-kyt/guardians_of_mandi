import { all, get, lastInsertId, run } from "../config/db.js";

export function createMessage({
  conversationId,
  senderId,
  content,
  kind = "text",
  forwardedFromId = null,
}) {
  run(
    `INSERT INTO messages (conversation_id, sender_id, content, kind, forwarded_from_id)
     VALUES (?, ?, ?, ?, ?)`,
    [conversationId, senderId, content, kind, forwardedFromId]
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
  const query = String(search).trim();
  if (query) {
    // Escape LIKE wildcards so user input is matched literally.
    const escaped = query.replace(/[\\%_]/g, (ch) => `\\${ch}`);
    return all(
      `SELECT m.*, u.username AS sender_username, u.display_name AS sender_display_name
       FROM messages m
       JOIN users u ON u.id = m.sender_id
       WHERE m.conversation_id = ? AND m.content LIKE ? ESCAPE '\\'
       ORDER BY m.created_at ASC, m.id ASC`,
      [conversationId, `%${escaped}%`]
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

// Only the original author may edit or delete a message.
export function editMessage({ messageId, senderId, content }) {
  const message = getMessageById(messageId);
  if (!message || message.sender_id !== Number(senderId)) return null;
  if (message.deleted_at) return null;

  run(
    `UPDATE messages
     SET content = ?, edited_at = datetime('now')
     WHERE id = ? AND sender_id = ? AND deleted_at IS NULL`,
    [content, messageId, senderId]
  );
  return getMessageById(messageId);
}

// Copies a message into another conversation the sender belongs to, keeping a
// link to the original so the bubble can show a "forwarded" label.
export function forwardMessage({ messageId, targetConversationId, senderId }) {
  const original = getMessageById(messageId);
  if (!original || original.deleted_at) return null;

  return createMessage({
    conversationId: targetConversationId,
    senderId,
    content: original.content,
    kind: original.kind || "text",
    forwardedFromId: original.id,
  });
}

export function deleteMessage({ messageId, senderId }) {
  const message = getMessageById(messageId);
  if (!message || message.sender_id !== Number(senderId)) return null;

  // Soft delete: keep the row so the bubble can render a tombstone, but drop
  // the content so nothing leaks through READ-then-delete races or exports.
  run(
    `UPDATE messages
     SET content = '', deleted_at = datetime('now')
     WHERE id = ? AND sender_id = ?`,
    [messageId, senderId]
  );
  return getMessageById(messageId);
}

export function formatMessage(row) {
  return {
    id: row.id,
    conversationId: row.conversation_id,
    senderId: row.sender_id,
    senderUsername: row.sender_username,
    senderDisplayName: row.sender_display_name,
    content: row.content,
    kind: row.kind || "text",
    createdAt: row.created_at,
    readAt: row.read_at,
    editedAt: row.edited_at,
    deletedAt: row.deleted_at,
    forwardedFromId: row.forwarded_from_id,
  };
}
