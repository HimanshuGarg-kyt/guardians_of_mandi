import { all, run } from "../config/db.js";

export function getTheme(userId) {
  return all(`SELECT theme FROM user_settings WHERE user_id = ?`, [userId])[0]?.theme
    || "dark";
}

export function setTheme(userId, theme) {
  run(
    `INSERT INTO user_settings (user_id, theme)
     VALUES (?, ?)
     ON CONFLICT(user_id) DO UPDATE
       SET theme = excluded.theme, updated_at = datetime('now')`,
    [userId, theme]
  );
  return theme;
}

export function getWallpapers(userId) {
  return all(
    `SELECT conversation_id, wallpaper
     FROM chat_wallpapers
     WHERE user_id = ?`,
    [userId]
  );
}

export function setWallpaper(userId, conversationId, wallpaper) {
  run(
    `INSERT INTO chat_wallpapers (user_id, conversation_id, wallpaper)
     VALUES (?, ?, ?)
     ON CONFLICT(user_id, conversation_id) DO UPDATE
       SET wallpaper = excluded.wallpaper, updated_at = datetime('now')`,
    [userId, conversationId, wallpaper]
  );
  return wallpaper;
}
