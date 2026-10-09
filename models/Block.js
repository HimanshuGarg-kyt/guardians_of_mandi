import { all, run } from "../config/db.js";

// Blocks are one-directional in storage but enforced in both directions for
// messaging: either side blocking stops the conversation.
export function blockUser(blockerId, blockedId) {
  run(
    `INSERT OR IGNORE INTO blocks (blocker_id, blocked_id) VALUES (?, ?)`,
    [blockerId, blockedId]
  );
}

export function unblockUser(blockerId, blockedId) {
  run(
    `DELETE FROM blocks WHERE blocker_id = ? AND blocked_id = ?`,
    [blockerId, blockedId]
  );
}

export function listBlockedUsers(blockerId) {
  return all(
    `SELECT u.id, u.username, u.display_name, u.avatar_color, b.created_at
     FROM blocks b
     JOIN users u ON u.id = b.blocked_id
     WHERE b.blocker_id = ?
     ORDER BY u.display_name COLLATE NOCASE`,
    [blockerId]
  );
}

export function isBlockedEitherWay(userA, userB) {
  const row = all(
    `SELECT 1 FROM blocks
     WHERE (blocker_id = ? AND blocked_id = ?)
        OR (blocker_id = ? AND blocked_id = ?)
     LIMIT 1`,
    [userA, userB, userB, userA]
  );
  return row.length > 0;
}
