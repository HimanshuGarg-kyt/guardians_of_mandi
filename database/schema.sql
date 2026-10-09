-- SQLite schema for Guardians of Mandi

CREATE TABLE IF NOT EXISTS users (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  username TEXT NOT NULL UNIQUE COLLATE NOCASE,
  display_name TEXT NOT NULL,
  password_hash TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS conversations (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_a_id INTEGER NOT NULL,
  user_b_id INTEGER NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE (user_a_id, user_b_id),
  FOREIGN KEY (user_a_id) REFERENCES users(id),
  FOREIGN KEY (user_b_id) REFERENCES users(id),
  CHECK (user_a_id < user_b_id)
);

CREATE TABLE IF NOT EXISTS messages (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  conversation_id INTEGER NOT NULL,
  sender_id INTEGER NOT NULL,
  content TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  read_at TEXT,
  FOREIGN KEY (conversation_id) REFERENCES conversations(id),
  FOREIGN KEY (sender_id) REFERENCES users(id)
);

CREATE INDEX IF NOT EXISTS idx_messages_conversation
  ON messages (conversation_id, created_at);
