// 004 — group conversations: membership table + nullable direct pair.
//
// The v1 conversations table had a CHECK (user_a_id < user_b_id) constraint
// that makes group rows (no fixed pair) impossible, so when the old shape is
// detected the table is rebuilt without it. Fresh databases created from the
// current schema.sql already have the new shape and skip the rebuild.

const NEW_CONVERSATIONS_DDL = `CREATE TABLE conversations_new (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_a_id INTEGER,
  user_b_id INTEGER,
  is_group INTEGER NOT NULL DEFAULT 0,
  name TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  FOREIGN KEY (user_a_id) REFERENCES users(id),
  FOREIGN KEY (user_b_id) REFERENCES users(id)
)`;

export default function migrate({ tableInfo, run }) {
  const hasIsGroup = tableInfo("conversations").some((c) => c.name === "is_group");

  if (!hasIsGroup) {
    run(NEW_CONVERSATIONS_DDL);
    run(
      `INSERT INTO conversations_new (id, user_a_id, user_b_id, is_group, name, created_at)
       SELECT id, user_a_id, user_b_id, 0, NULL, created_at FROM conversations`
    );
    run(`DROP TABLE conversations`);
    run(`ALTER TABLE conversations_new RENAME TO conversations`);
  }

  run(
    `CREATE TABLE IF NOT EXISTS conversation_members (
      conversation_id INTEGER NOT NULL,
      user_id INTEGER NOT NULL,
      joined_at TEXT NOT NULL DEFAULT (datetime('now')),
      PRIMARY KEY (conversation_id, user_id),
      FOREIGN KEY (conversation_id) REFERENCES conversations(id) ON DELETE CASCADE,
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    )`
  );

  // Backfill members for pre-membership direct conversations. Idempotent.
  run(
    `INSERT OR IGNORE INTO conversation_members (conversation_id, user_id)
     SELECT id, user_a_id FROM conversations WHERE user_a_id IS NOT NULL`
  );
  run(
    `INSERT OR IGNORE INTO conversation_members (conversation_id, user_id)
     SELECT id, user_b_id FROM conversations WHERE user_b_id IS NOT NULL`
  );
}
