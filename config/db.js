import fs from "fs";
import path from "path";
import { createRequire } from "module";
import { fileURLToPath } from "url";
import initSqlJs from "sql.js";
import { runMigrations } from "./migrate.js";

const require = createRequire(import.meta.url);
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const rootDir = path.join(__dirname, "..");
const dataDir = path.join(rootDir, "data");
const dbPath = path.join(dataDir, "chat.db");
const schemaPath = path.join(rootDir, "database", "schema.sql");

let db;
let lastId = 0;
let persistTimer = null;

const PERSIST_DELAY_MS = 250;

function writeDb() {
  if (!db) return;
  fs.mkdirSync(dataDir, { recursive: true });
  // sql.js export() resets last_insert_rowid(), so callers must snapshot the id
  // first (see run()).
  fs.writeFileSync(dbPath, Buffer.from(db.export()));
}

// Writing the whole database on every statement is O(database size) per write
// and blocks the event loop. Coalesce writes into a trailing debounce and flush
// synchronously on exit so no data is lost.
function persist() {
  if (!db) return;
  if (persistTimer) clearTimeout(persistTimer);
  persistTimer = setTimeout(() => {
    persistTimer = null;
    writeDb();
  }, PERSIST_DELAY_MS);
}

function flushPersist() {
  if (persistTimer) {
    clearTimeout(persistTimer);
    persistTimer = null;
  }
  writeDb();
}

process.on("exit", flushPersist);
for (const signal of ["SIGINT", "SIGTERM"]) {
  process.on(signal, () => {
    flushPersist();
    process.exit(0);
  });
}

export async function initDb() {
  const wasmDir = path.dirname(require.resolve("sql.js"));
  const SQL = await initSqlJs({
    locateFile: (file) => path.join(wasmDir, file),
  });

  if (fs.existsSync(dbPath)) {
    db = new SQL.Database(fs.readFileSync(dbPath));
  } else {
    db = new SQL.Database();
  }

  db.exec(fs.readFileSync(schemaPath, "utf8"));
  persist();
  await runMigrations();
  return db;
}

export function getDb() {
  if (!db) throw new Error("Database is not initialized");
  return db;
}

export function run(sql, params = []) {
  getDb().run(sql, params);
  lastId = Number(get("SELECT last_insert_rowid() AS id")?.id || 0);
  persist();
}

export function all(sql, params = []) {
  const stmt = getDb().prepare(sql);
  stmt.bind(params);
  const rows = [];
  while (stmt.step()) {
    rows.push(stmt.getAsObject());
  }
  stmt.free();
  return rows;
}

export function get(sql, params = []) {
  return all(sql, params)[0] || null;
}

export function lastInsertId() {
  return lastId;
}
