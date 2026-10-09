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
    `SELECT id, username, display_name, created_at
     FROM users
     WHERE id != ?
     ORDER BY display_name COLLATE NOCASE`,
    [userId]
  );
}

export function publicUser(user) {
  if (!user) return null;
  return {
    id: user.id,
    username: user.username,
    displayName: user.display_name,
    createdAt: user.created_at,
  };
}
