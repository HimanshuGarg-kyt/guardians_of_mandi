import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { pathToFileURL } from "url";
import { all, get, run } from "./db.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const migrationsDir = path.join(__dirname, "..", "database", "migrations");

function tableInfo(table) {
  return all(`PRAGMA table_info(${table})`);
}

// Applies every not-yet-run migration in database/migrations/ in filename
// order. Each migration is idempotent and records itself in _migrations, so
// an interrupted run simply resumes on the next boot. Helper accessors
// (all/get/run/tableInfo) are injected instead of imported so a migration
// file only describes the change, not the plumbing.
export async function runMigrations() {
  run(
    `CREATE TABLE IF NOT EXISTS _migrations (
      name TEXT PRIMARY KEY,
      applied_at TEXT NOT NULL DEFAULT (datetime('now'))
    )`
  );

  if (!fs.existsSync(migrationsDir)) return;
  const files = fs
    .readdirSync(migrationsDir)
    .filter((file) => file.endsWith(".js"))
    .sort();

  for (const file of files) {
    const already = get(`SELECT name FROM _migrations WHERE name = ?`, [file]);
    if (already) continue;

    const moduleUrl = pathToFileURL(path.join(migrationsDir, file)).href;
    const migration = await import(moduleUrl);
    console.log(`Applying migration ${file}`);
    migration.default({ all, get, run, tableInfo });
    run(`INSERT INTO _migrations (name) VALUES (?)`, [file]);
  }
}
