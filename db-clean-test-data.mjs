// Removes every account created by the automated smoke tests (alice_*,
// bob_*, carol_*, dbg_*) along with all data that belongs exclusively to
// them, and leaves real users and their conversations untouched.
//
// Conversations are only deleted when EVERY member is a test account, so a
// chat shared with a real user is never lost.
import fs from "fs";
import initSqlJs from "sql.js";

const TEST_USERNAME_PATTERN = /^(alice|bob|carol|dbg)_/i;

const SQL = await initSqlJs({
  locateFile: (f) => `node_modules/sql.js/dist/${f}`,
});
const db = new SQL.Database(fs.readFileSync("data/chat.db"));

function scalar(sql) {
  return db.exec(sql)[0]?.values[0]?.[0] ?? 0;
}

const testUserIds = db
  .exec(`SELECT id FROM users`)
  [0].values.map((row) => Number(row[0]))
  .filter((id) => {
    const row = db.exec(`SELECT username FROM users WHERE id = ${id}`)[0].values[0];
    return TEST_USERNAME_PATTERN.test(row[0]);
  });

if (testUserIds.length === 0) {
  console.log("No smoke-test accounts found — nothing to do.");
  process.exit(0);
}

const idList = testUserIds.join(",");

// Conversations where every member is a test account (or that have no
// members left at all).
const testConvIds = db
  .exec(`SELECT id FROM conversations`)
  [0].values.map((row) => Number(row[0]))
  .filter((id) => {
    const members = db.exec(
      `SELECT user_id FROM conversation_members WHERE conversation_id = ${id}`
    )[0]?.values.map((row) => Number(row[0])) || [];
    if (members.length === 0) {
      // An orphan conversation (no members): safe to remove only if it has
      // messages purely from test users (or none).
      const senders =
        db.exec(
          `SELECT DISTINCT sender_id FROM messages WHERE conversation_id = ${id}`
        )[0]?.values.map((row) => Number(row[0])) || [];
      return senders.every((sender) => testUserIds.includes(sender));
    }
    return members.every((member) => testUserIds.includes(member));
  });

const convList = testConvIds.join(",");
const before = {
  users: scalar(`SELECT COUNT(*) FROM users`),
  conversations: scalar(`SELECT COUNT(*) FROM conversations`),
  members: scalar(`SELECT COUNT(*) FROM conversation_members`),
  messages: scalar(`SELECT COUNT(*) FROM messages`),
  reactions: scalar(`SELECT COUNT(*) FROM reactions`),
  statuses: scalar(`SELECT COUNT(*) FROM statuses`),
  statusViews: scalar(`SELECT COUNT(*) FROM status_views`),
  settings: scalar(`SELECT COUNT(*) FROM user_settings`),
  blocks: scalar(`SELECT COUNT(*) FROM blocks`),
};

// Deletes in FK-safe order (parents last).
const statements = [
  // Views on statuses authored by test users, and views left BY test users.
  testUserIds.length &&
    `DELETE FROM status_views WHERE viewer_id IN (${idList})
     OR status_id IN (SELECT id FROM statuses WHERE user_id IN (${idList}))`,
  testUserIds.length && `DELETE FROM statuses WHERE user_id IN (${idList})`,
  // Reactions by test users, and reactions on messages in test conversations.
  testUserIds.length &&
    testConvIds.length &&
    `DELETE FROM reactions WHERE user_id IN (${idList})
     OR message_id IN (SELECT id FROM messages WHERE conversation_id IN (${convList}))`,
  testConvIds.length && `DELETE FROM messages WHERE conversation_id IN (${convList})`,
  testConvIds.length && `DELETE FROM conversation_members WHERE conversation_id IN (${convList})`,
  testUserIds.length &&
    testConvIds.length &&
    `DELETE FROM chat_wallpapers WHERE user_id IN (${idList})
     OR conversation_id IN (${convList})`,
  testUserIds.length && `DELETE FROM user_settings WHERE user_id IN (${idList})`,
  testUserIds.length &&
    `DELETE FROM blocks WHERE blocker_id IN (${idList}) OR blocked_id IN (${idList})`,
  testConvIds.length && `DELETE FROM conversations WHERE id IN (${convList})`,
  testUserIds.length && `DELETE FROM users WHERE id IN (${idList})`,
].filter(Boolean);

db.run("BEGIN");
for (const sql of statements) db.run(sql);
db.run("COMMIT");

fs.mkdirSync("data", { recursive: true });
fs.writeFileSync("data/chat.db", Buffer.from(db.export()));

const after = {
  users: scalar(`SELECT COUNT(*) FROM users`),
  conversations: scalar(`SELECT COUNT(*) FROM conversations`),
  members: scalar(`SELECT COUNT(*) FROM conversation_members`),
  messages: scalar(`SELECT COUNT(*) FROM messages`),
  reactions: scalar(`SELECT COUNT(*) FROM reactions`),
  statuses: scalar(`SELECT COUNT(*) FROM statuses`),
  statusViews: scalar(`SELECT COUNT(*) FROM status_views`),
  settings: scalar(`SELECT COUNT(*) FROM user_settings`),
  blocks: scalar(`SELECT COUNT(*) FROM blocks`),
};

console.log(`Removed ${testUserIds.length} test users and ${testConvIds.length} test conversations.\n`);
console.log("table                 before -> after");
for (const key of Object.keys(before)) {
  console.log(`${key.padEnd(20)}  ${String(before[key]).padStart(4)} -> ${String(after[key]).padStart(4)}`);
}

console.log("\nRemaining users:");
const remaining = db.exec(`SELECT id, username, display_name FROM users ORDER BY id`);
for (const row of remaining[0]?.values || []) {
  console.log(`  #${row[0]}  ${row[1]}  (${row[2]})`);
}
