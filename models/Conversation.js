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
    `SELECT * FROM conversations
     WHERE is_group = 0 AND user_a_id = ? AND user_b_id = ?`,
    [userA, userB]
  );
  if (existing) return existing;

  run(`INSERT INTO conversations (user_a_id, user_b_id) VALUES (?, ?)`, [
    userA,
    userB,
  ]);
  const conversationId = lastInsertId();
  run(
    `INSERT INTO conversation_members (conversation_id, user_id)
     VALUES (?, ?), (?, ?)`,
    [conversationId, userA, conversationId, userB]
  );
  return get(`SELECT * FROM conversations WHERE id = ?`, [conversationId]);
}

// Creates a group conversation with the creator plus every valid member id.
// Duplicate members and the creator repeated in the list are collapsed.
export function createGroupConversation(creatorId, name, memberIds = []) {
  const groupName = String(name ?? "").trim();
  if (!groupName) throw new Error("Group name is required");
  if (groupName.length > 100) {
    throw new Error("Group name must be at most 100 characters");
  }

  const members = [
    ...new Set(
      [creatorId, ...memberIds.map(Number)].filter((id) => Number.isInteger(id))
    ),
  ];
  if (members.length < 2) throw new Error("A group needs at least one other member");

  const valid = all(
    `SELECT id FROM users WHERE id IN (${members.map(() => "?").join(",")})`,
    members
  );
  if (valid.length !== members.length) {
    throw new Error("One or more members do not exist");
  }

  run(
    `INSERT INTO conversations (user_a_id, user_b_id, is_group, name)
     VALUES (NULL, NULL, 1, ?)`,
    [groupName]
  );
  const conversationId = lastInsertId();
  run(
    `INSERT INTO conversation_members (conversation_id, user_id)
     VALUES ${members.map(() => "(?, ?)").join(", ")}`,
    members.flatMap((id) => [conversationId, id])
  );
  return get(`SELECT * FROM conversations WHERE id = ?`, [conversationId]);
}

export function getConversationForUser(conversationId, userId) {
  return get(
    `SELECT c.*
     FROM conversations c
     WHERE c.id = ?
       AND (
         c.user_a_id = ? OR c.user_b_id = ?
         OR EXISTS (
           SELECT 1 FROM conversation_members m
           WHERE m.conversation_id = c.id AND m.user_id = ?
         )
       )`,
    [conversationId, userId, userId, userId]
  );
}

// Everyone who should receive a broadcast for this conversation. Membership
// covers both group rows and backfilled direct ones.
export function getConversationMemberIds(conversationId) {
  return all(
    `SELECT user_id FROM conversation_members WHERE conversation_id = ?`,
    [conversationId]
  ).map((row) => Number(row.user_id));
}

export function getConversationMembers(conversationId) {
  return all(
    `SELECT u.id, u.username, u.display_name, u.avatar_color
     FROM conversation_members m
     JOIN users u ON u.id = m.user_id
     WHERE m.conversation_id = ?
     ORDER BY u.display_name COLLATE NOCASE`,
    [conversationId]
  );
}

export function listConversationsForUser(userId) {
  return all(
    `SELECT
        c.id,
        c.created_at,
        c.is_group,
        c.name,
        CASE WHEN c.user_a_id = ? THEN c.user_b_id ELSE c.user_a_id END AS other_user_id,
        u.username AS other_username,
        u.display_name AS other_display_name,
        u.avatar_color AS other_avatar_color,
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
     LEFT JOIN users u
       ON u.id = CASE WHEN c.user_a_id = ? THEN c.user_b_id ELSE c.user_a_id END
     WHERE EXISTS (
       SELECT 1 FROM conversation_members m
       WHERE m.conversation_id = c.id AND m.user_id = ?
     )
     ORDER BY COALESCE(last_message_at, c.created_at) DESC`,
    [userId, userId, userId, userId]
  );
}

export function formatConversation(row) {
  const members = getConversationMembers(row.id).map((member) => ({
    id: member.id,
    username: member.username,
    displayName: member.display_name,
    avatarColor: member.avatar_color || "#7bd389",
  }));

  const isGroup = Number(row.is_group) === 1;
  const other = row.other_user_id
    ? {
        id: row.other_user_id,
        username: row.other_username,
        displayName: row.other_display_name,
        avatarColor: row.other_avatar_color || "#7bd389",
      }
    : null;

  return {
    id: row.id,
    createdAt: row.created_at,
    isGroup,
    name: row.name || null,
    otherUser: other,
    // For groups the other members are everyone except me — the caller
    // (formatConversationForUser) can filter, but keeping the full list here
    // keeps the payload self-describing.
    members,
    lastMessage: row.last_message,
    lastMessageAt: row.last_message_at,
    unreadCount: Number(row.unread_count || 0),
  };
}

// formatConversation + the "other members" view for a specific viewer, so the
// UI never has to join conversation ids to users itself.
export function formatConversationForUser(row, userId) {
  const conversation = formatConversation(row);
  if (!conversation.isGroup) return conversation;
  conversation.otherMembers = conversation.members.filter(
    (member) => member.id !== Number(userId)
  );
  return conversation;
}
