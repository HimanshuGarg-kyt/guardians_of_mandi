// 002 — message editing/deletion, message kind, forwarding, and reactions.

function addColumnIfMissing({ tableInfo, run }, table, column, definition) {
  if (tableInfo(table).some((c) => c.name === column)) return;
  run(`ALTER TABLE ${table} ADD COLUMN ${column} ${definition}`);
}

export default function migrate({ tableInfo, run }) {
  addColumnIfMissing(
    { tableInfo, run },
    "messages",
    "kind",
    "TEXT NOT NULL DEFAULT 'text'"
  );
  addColumnIfMissing({ tableInfo, run }, "messages", "edited_at", "TEXT");
  addColumnIfMissing({ tableInfo, run }, "messages", "deleted_at", "TEXT");
  addColumnIfMissing({ tableInfo, run }, "messages", "forwarded_from_id", "INTEGER");

  run(
    `CREATE TABLE IF NOT EXISTS reactions (
      message_id INTEGER NOT NULL,
      user_id INTEGER NOT NULL,
      emoji TEXT NOT NULL,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      PRIMARY KEY (message_id, user_id, emoji),
      FOREIGN KEY (message_id) REFERENCES messages(id) ON DELETE CASCADE,
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    )`
  );
}
