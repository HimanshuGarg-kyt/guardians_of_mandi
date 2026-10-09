import { useState } from "react";
import Avatar from "./Avatar.jsx";
import { api } from "../services/api.js";
import { AVATAR_COLORS, WALLPAPERS } from "../config/wallpapers.js";

export default function SettingsPanel({
  me,
  theme,
  wallpapers = {},
  blocks = [],
  activeConversationId = null,
  onSaveProfile,
  onChangeTheme,
  onChangeWallpaper,
  onUnblock,
  onClose,
}) {
  const [displayName, setDisplayName] = useState(me.displayName);
  const [avatarColor, setAvatarColor] = useState(me.avatarColor || AVATAR_COLORS[0]);
  const [profileError, setProfileError] = useState("");
  const [profileSaved, setProfileSaved] = useState(false);

  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [passwordError, setPasswordError] = useState("");
  const [passwordSaved, setPasswordSaved] = useState(false);

  async function handleProfileSave(event) {
    event.preventDefault();
    setProfileError("");
    setProfileSaved(false);
    try {
      await onSaveProfile({ displayName: displayName.trim(), avatarColor });
      setProfileSaved(true);
    } catch (error) {
      setProfileError(error.message);
    }
  }

  async function handlePasswordSave(event) {
    event.preventDefault();
    setPasswordError("");
    setPasswordSaved(false);
    try {
      await api("/api/auth/me/password", {
        method: "POST",
        body: { currentPassword, newPassword },
      });
      setPasswordSaved(true);
      setCurrentPassword("");
      setNewPassword("");
    } catch (error) {
      setPasswordError(error.message);
    }
  }

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <section
        className="settings-panel"
        onClick={(event) => event.stopPropagation()}
        aria-label="Settings"
      >
        <header className="settings-header">
          <h2>Settings</h2>
          <button type="button" onClick={onClose} aria-label="Close settings">
            ✕
          </button>
        </header>

        <section className="settings-section">
          <h3>Profile</h3>
          <form onSubmit={handleProfileSave}>
            <div className="settings-row">
              <Avatar name={displayName} color={avatarColor} size={56} />
              <label className="grow">
                Display name
                <input
                  value={displayName}
                  onChange={(e) => setDisplayName(e.target.value)}
                  maxLength={200}
                  required
                />
              </label>
            </div>
            <div className="swatches">
              {AVATAR_COLORS.map((color) => (
                <button
                  key={color}
                  type="button"
                  className={`swatch ${avatarColor === color ? "active" : ""}`}
                  style={{ background: color }}
                  onClick={() => setAvatarColor(color)}
                  aria-label={`Avatar color ${color}`}
                />
              ))}
            </div>
            {profileError && <p className="error">{profileError}</p>}
            <div className="settings-row">
              <button className="primary" type="submit">
                Save profile
              </button>
              {profileSaved && <span className="saved-note">Saved</span>}
            </div>
          </form>
        </section>

        <section className="settings-section">
          <h3>Appearance</h3>
          <div className="tabs small">
            <button
              type="button"
              className={theme === "dark" ? "active" : ""}
              onClick={() => onChangeTheme("dark")}
            >
              Dark
            </button>
            <button
              type="button"
              className={theme === "light" ? "active" : ""}
              onClick={() => onChangeTheme("light")}
            >
              Light
            </button>
          </div>

          <h4>Chat wallpaper</h4>
          {activeConversationId ? (
            <div className="wallpaper-grid">
              {WALLPAPERS.map((wallpaper) => (
                <button
                  key={wallpaper.id}
                  type="button"
                  className={`wallpaper-option ${
                    wallpapers[activeConversationId] === wallpaper.id ||
                    (!wallpapers[activeConversationId] && wallpaper.id === "plain")
                      ? "active"
                      : ""
                  }`}
                  style={{ background: wallpaper.background }}
                  onClick={() => onChangeWallpaper(activeConversationId, wallpaper.id)}
                >
                  {wallpaper.name}
                </button>
              ))}
            </div>
          ) : (
            <p className="muted">Open a chat to choose its wallpaper.</p>
          )}
        </section>

        <section className="settings-section">
          <h3>Password</h3>
          <form onSubmit={handlePasswordSave}>
            <label>
              Current password
              <input
                type="password"
                value={currentPassword}
                onChange={(e) => setCurrentPassword(e.target.value)}
                autoComplete="current-password"
                required
              />
            </label>
            <label>
              New password
              <input
                type="password"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                autoComplete="new-password"
                minLength={6}
                required
              />
            </label>
            {passwordError && <p className="error">{passwordError}</p>}
            <div className="settings-row">
              <button className="primary" type="submit">
                Change password
              </button>
              {passwordSaved && <span className="saved-note">Password updated</span>}
            </div>
          </form>
        </section>

        <section className="settings-section">
          <h3>Blocked people</h3>
          {blocks.length === 0 ? (
            <p className="muted">You haven't blocked anyone.</p>
          ) : (
            <ul className="blocked-list">
              {blocks.map((blocked) => (
                <li key={blocked.id}>
                  <Avatar name={blocked.displayName} color={blocked.avatarColor} size={32} />
                  <span className="grow">
                    <strong>{blocked.displayName}</strong>
                    <em>@{blocked.username}</em>
                  </span>
                  <button
                    type="button"
                    className="link"
                    onClick={() => onUnblock(blocked.id)}
                  >
                    Unblock
                  </button>
                </li>
              ))}
            </ul>
          )}
        </section>
      </section>
    </div>
  );
}