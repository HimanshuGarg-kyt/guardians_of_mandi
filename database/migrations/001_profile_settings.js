// 001 — profile settings: avatar color, last-seen tracking, UI settings
// (theme + per-chat wallpaper).

function addColumnIfMissing({ tableInfo, run }, table, column, definition) {
  if (tableInfo(table).some((c) => c.name === column)) return;
  run(`ALTER TABLE ${table} ADD COLUMN ${column} ${definition}`);
}

export default function migrate({ tableInfo, run }) {
  addColumnIfMissing(
    { tableInfo, run },
    "users",
    "avatar_color",
    "TEXT NOT NULL DEFAULT '#7bd389'"
  );
  addColumnIfMissing({ tableInfo, run }, "users", "last_seen_at", "TEXT");

  run(
    `CREATE TABLE IF NOT EXISTS user_settings (
      user_id INTEGER PRIMARY KEY,
      theme TEXT NOT NULL DEFAULT 'dark',
      updated_at TEXT NOT NULL DEFAULT (datetime('now')),
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    )`
  );

  run(
    `CREATE TABLE IF NOT EXISTS chat_wallpapers (
      user_id INTEGER NOT NULL,
      conversation_id INTEGER NOT NULL,
      wallpaper TEXT NOT NULL,
      updated_at TEXT NOT NULL DEFAULT (datetime('now')),
      PRIMARY KEY (user_id, conversation_id),
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
      FOREIGN KEY (conversation_id) REFERENCES conversations(id) ON DELETE CASCADE
    )`
  );
}
