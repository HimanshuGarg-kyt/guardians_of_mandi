import fs from "fs";
import path from "path";
import { createRequire } from "module";
import { fileURLToPath } from "url";
import initSqlJs from "sql.js";

const require = createRequire(import.meta.url);
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const rootDir = path.join(__dirname, "..");
const dataDir = path.join(rootDir, "data");
const dbPath = path.join(dataDir, "chat.db");
const schemaPath = path.join(rootDir, "database", "schema.sql");

let db;

function persist() {
  if (!db) return;
  fs.mkdirSync(dataDir, { recursive: true });
  fs.writeFileSync(dbPath, Buffer.from(db.export()));
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
  return db;
}

export function getDb() {
  if (!db) throw new Error("Database is not initialized");
  return db;
}

export function run(sql, params = []) {
  getDb().run(sql, params);
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
  const row = get("SELECT last_insert_rowid() AS id");
  return Number(row.id);
}
