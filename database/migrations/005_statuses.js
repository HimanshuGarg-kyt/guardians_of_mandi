// 005 — status stories with a caller-chosen expiry time.

export default function migrate({ run }) {
  run(
    `CREATE TABLE IF NOT EXISTS statuses (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL,
      content TEXT NOT NULL,
      bg_color TEXT NOT NULL DEFAULT '#7bd389',
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      expires_at TEXT NOT NULL,
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    )`
  );

  run(
    `CREATE TABLE IF NOT EXISTS status_views (
      status_id INTEGER NOT NULL,
      viewer_id INTEGER NOT NULL,
      viewed_at TEXT NOT NULL DEFAULT (datetime('now')),
      PRIMARY KEY (status_id, viewer_id),
      FOREIGN KEY (status_id) REFERENCES statuses(id) ON DELETE CASCADE,
      FOREIGN KEY (viewer_id) REFERENCES users(id) ON DELETE CASCADE
    )`
  );
}
