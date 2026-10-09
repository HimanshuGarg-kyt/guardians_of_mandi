import { all, get, lastInsertId, run } from "../config/db.js";

export function createUser({ username, displayName, passwordHash }) {
  run(
    `INSERT INTO users (username, display_name, password_hash)
     VALUES (?, ?, ?)`,
    [username.trim(), displayName.trim(), passwordHash]
  );
  return findUserById(lastInsertId());
}

export function findUserByUsername(username) {
  return get(`SELECT * FROM users WHERE username = ? COLLATE NOCASE`, [
    username.trim(),
  ]);
}

export function findUserById(id) {
  return get(`SELECT * FROM users WHERE id = ?`, [id]);
}

export function listUsersExcept(userId) {
  return all(
    `SELECT id, username, display_name, avatar_color, last_seen_at, created_at
     FROM users
     WHERE id != ?
       AND id NOT IN (
         SELECT blocked_id FROM blocks WHERE blocker_id = ?
         UNION
         SELECT blocker_id FROM blocks WHERE blocked_id = ?
       )
     ORDER BY display_name COLLATE NOCASE`,
    [userId, userId, userId]
  );
}

export function updateUserProfile(userId, { displayName, avatarColor }) {
  const fields = [];
  const params = [];
  if (displayName !== undefined) {
    fields.push("display_name = ?");
    params.push(String(displayName).trim());
  }
  if (avatarColor !== undefined) {
    fields.push("avatar_color = ?");
    params.push(String(avatarColor).trim());
  }
  if (fields.length === 0) return findUserById(userId);
  run(
    `UPDATE users SET ${fields.join(", ")} WHERE id = ?`,
    [...params, userId]
  );
  return findUserById(userId);
}

export function setPasswordHash(userId, passwordHash) {
  run(`UPDATE users SET password_hash = ? WHERE id = ?`, [passwordHash, userId]);
  return findUserById(userId);
}

export function touchLastSeen(userId) {
  run(`UPDATE users SET last_seen_at = datetime('now') WHERE id = ?`, [userId]);
}

export function publicUser(user) {
  if (!user) return null;
  return {
    id: user.id,
    username: user.username,
    displayName: user.display_name,
    avatarColor: user.avatar_color || "#7bd389",
    lastSeenAt: user.last_seen_at || null,
    createdAt: user.created_at,
  };
}
