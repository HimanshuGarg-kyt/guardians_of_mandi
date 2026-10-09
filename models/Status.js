import { all, get, lastInsertId, run } from "../config/db.js";

// Expiry presets the UI offers, plus an absolute ISO deadline option.
export const EXPIRY_PRESETS = {
  "1h": 60 * 60 * 1000,
  "24h": 24 * 60 * 60 * 1000,
  "7d": 7 * 24 * 60 * 60 * 1000,
};

const MAX_STATUS_LENGTH = 500;
const MAX_EXPIRY_MS = 7 * 24 * 60 * 60 * 1000;

// Resolves either a preset key ("1h", "24h", "7d") or an absolute ISO/date
// string into a valid future UTC deadline, or null when unusable.
export function resolveExpiry({ preset, expiresAt }) {
  const now = Date.now();

  if (preset && EXPIRY_PRESETS[preset]) {
    return new Date(now + EXPIRY_PRESETS[preset]).toISOString();
  }
  if (expiresAt) {
    const parsed = new Date(expiresAt);
    if (Number.isNaN(parsed.getTime())) return null;
    const cutoff = parsed.getTime();
    // SQLite's datetime('now') is UTC; normalize the client's deadline so a
    // naive "YYYY-MM-DDTHH:MM" from <input type="datetime-local"> (local
    // time) still lands in the future when the server clock is UTC.
    if (cutoff <= now) return null;
    if (cutoff - now > MAX_EXPIRY_MS) return null;
    return parsed.toISOString();
  }
  return null;
}

export function createStatus({ userId, content, bgColor, expiresAt }) {
  const text = String(content ?? "").trim();
  if (!text) return null;
  if (text.length > MAX_STATUS_LENGTH) return null;

  run(
    `INSERT INTO statuses (user_id, content, bg_color, expires_at)
     VALUES (?, ?, ?, datetime(?))`,
    [userId, text, String(bgColor || "#7bd389"), expiresAt]
  );
  return getStatusById(lastInsertId());
}

export function getStatusById(id) {
  return get(`SELECT * FROM statuses WHERE id = ?`, [id]);
}

export function deleteStatus({ statusId, userId }) {
  const status = getStatusById(statusId);
  if (!status || status.user_id !== Number(userId)) return false;
  run(`DELETE FROM statuses WHERE id = ? AND user_id = ?`, [statusId, userId]);
  return true;
}

// Deletes expired rows. Called opportunistically when statuses are listed.
export function purgeExpiredStatuses() {
  run(`DELETE FROM statuses WHERE expires_at <= datetime('now')`);
}

export function markStatusViewed({ statusId, viewerId }) {
  run(
    `INSERT OR IGNORE INTO status_views (status_id, viewer_id)
     VALUES (?, ?)`,
    [statusId, viewerId]
  );
  return getViewCount(statusId);
}

export function getViewCount(statusId) {
  return Number(
    get(`SELECT COUNT(*) AS count FROM status_views WHERE status_id = ?`, [statusId])
      ?.count || 0
  );
}

export function listStatusViewers(statusId) {
  return all(
    `SELECT u.id, u.username, u.display_name, u.avatar_color, sv.viewed_at
     FROM status_views sv
     JOIN users u ON u.id = sv.viewer_id
     WHERE sv.status_id = ?
     ORDER BY sv.viewed_at DESC`,
    [statusId]
  );
}

// Active statuses visible to the viewer: never their own blockers/blocked,
// mine first, then most recent. Returns raw rows plus viewer counts.
export function listStatusesForViewer(viewerId) {
  purgeExpiredStatuses();
  return all(
    `SELECT
       s.*,
       u.username AS author_username,
       u.display_name AS author_display_name,
       u.avatar_color AS author_avatar_color,
       (SELECT COUNT(*) FROM status_views sv WHERE sv.status_id = s.id) AS view_count,
       (SELECT COUNT(*) FROM status_views sv
        WHERE sv.status_id = s.id AND sv.viewer_id = ?) AS seen_by_me
     FROM statuses s
     JOIN users u ON u.id = s.user_id
     WHERE s.expires_at > datetime('now')
       AND NOT EXISTS (
         SELECT 1 FROM blocks b
         WHERE (b.blocker_id = s.user_id AND b.blocked_id = ?)
            OR (b.blocker_id = ? AND b.blocked_id = s.user_id)
       )
     ORDER BY (s.user_id = ?) DESC, s.created_at DESC`,
    [viewerId, viewerId, viewerId, viewerId]
  );
}

// Users (other than the viewer) with at least one active status, for the
// sidebar rings.
export function listStatusAuthorsForViewer(viewerId) {
  const rows = listStatusesForViewer(viewerId);
  const authors = new Map();
  for (const row of rows) {
    if (Number(row.user_id) === Number(viewerId)) continue;
    if (!authors.has(row.user_id)) {
      authors.set(row.user_id, {
        userId: Number(row.user_id),
        displayName: row.author_display_name,
        avatarColor: row.author_avatar_color,
        count: 0,
        seenAll: true,
        latestAt: row.created_at,
      });
    }
    const author = authors.get(row.user_id);
    author.count += 1;
    if (!Number(row.seen_by_me)) author.seenAll = false;
  }
  return [...authors.values()];
}

export function formatStatus(row, viewerId) {
  return {
    id: row.id,
    author: {
      id: Number(row.user_id),
      username: row.author_username,
      displayName: row.author_display_name,
      avatarColor: row.author_avatar_color || "#7bd389",
    },
    content: row.content,
    bgColor: row.bg_color || "#7bd389",
    createdAt: row.created_at,
    expiresAt: row.expires_at,
    viewCount: Number(row.view_count || 0),
    seenByMe: Boolean(Number(row.seen_by_me)),
    mine: Number(row.user_id) === Number(viewerId),
  };
}
