// Theme is stored in localStorage so it can be applied before React mounts
// (no flash on the login screen) and is mirrored to the server when signed in
// so it follows the account across devices.

const THEME_KEY = "gom_theme";

export function getStoredTheme() {
  const theme = localStorage.getItem(THEME_KEY);
  return theme === "light" || theme === "dark" ? theme : "dark";
}

export function applyTheme(theme) {
  document.documentElement.dataset.theme = theme;
  localStorage.setItem(THEME_KEY, theme);
}

// Apply the stored theme immediately on import so the very first paint uses it.
applyTheme(getStoredTheme());
