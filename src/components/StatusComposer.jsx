import { useState } from "react";
import { STATUS_COLORS } from "../config/wallpapers.js";

const PRESETS = [
  { key: "1h", label: "1 hour" },
  { key: "24h", label: "24 hours" },
  { key: "7d", label: "7 days" },
];

// Default for the custom picker: now + 24h, as a datetime-local string.
function defaultCustomExpiry() {
  const date = new Date(Date.now() + 24 * 60 * 60 * 1000);
  const pad = (n) => String(n).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(
    date.getHours()
  )}:${pad(date.getMinutes())}`;
}

export default function StatusComposer({ onCreate, onClose }) {
  const [content, setContent] = useState("");
  const [bgColor, setBgColor] = useState(STATUS_COLORS[0]);
  const [mode, setMode] = useState("preset"); // "preset" | "custom"
  const [preset, setPreset] = useState("24h");
  const [customExpiry, setCustomExpiry] = useState(defaultCustomExpiry);
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  async function submit(event) {
    event.preventDefault();
    setError("");
    if (!content.trim()) {
      setError("Write something first");
      return;
    }
    setSaving(true);
    try {
      await onCreate({
        content: content.trim(),
        bgColor,
        ...(mode === "preset"
          ? { preset }
          : { expiresAt: new Date(customExpiry).toISOString() }),
      });
      onClose();
    } catch (err) {
      setError(err.message);
      setSaving(false);
    }
  }

  const previewStyle = {
    background: `linear-gradient(160deg, ${bgColor}, rgba(0,0,0,0.55))`,
  };

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <section
        className="status-composer"
        onClick={(event) => event.stopPropagation()}
        aria-label="Create status"
      >
        <header>
          <h2>New status</h2>
          <button type="button" onClick={onClose} aria-label="Close">
            ✕
          </button>
        </header>

        <div className="status-preview" style={previewStyle}>
          <p>{content || "Your status preview…"}</p>
        </div>

        <form onSubmit={submit}>
          <textarea
            value={content}
            onChange={(e) => setContent(e.target.value)}
            placeholder="What's happening on campus?"
            maxLength={500}
            rows={3}
            autoFocus
          />

          <div className="swatches">
            {STATUS_COLORS.map((color) => (
              <button
                key={color}
                type="button"
                className={`swatch ${bgColor === color ? "active" : ""}`}
                style={{ background: color }}
                onClick={() => setBgColor(color)}
                aria-label={`Background ${color}`}
              />
            ))}
          </div>

          <fieldset>
            <legend>Disappears after</legend>
            <div className="tabs small">
              {PRESETS.map((option) => (
                <button
                  key={option.key}
                  type="button"
                  className={mode === "preset" && preset === option.key ? "active" : ""}
                  onClick={() => {
                    setMode("preset");
                    setPreset(option.key);
                  }}
                >
                  {option.label}
                </button>
              ))}
              <button
                type="button"
                className={mode === "custom" ? "active" : ""}
                onClick={() => setMode("custom")}
              >
                Custom
              </button>
            </div>
            {mode === "custom" && (
              <label className="custom-expiry">
                Exact expiry date & time
                <input
                  type="datetime-local"
                  value={customExpiry}
                  onChange={(e) => setCustomExpiry(e.target.value)}
                  min={new Date().toISOString().slice(0, 16)}
                />
              </label>
            )}
          </fieldset>

          {error && <p className="error">{error}</p>}
          <button className="primary" type="submit" disabled={saving}>
            {saving ? "Posting…" : "Post status"}
          </button>
        </form>
      </section>
    </div>
  );
}
