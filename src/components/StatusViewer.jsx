import { useEffect, useState } from "react";
import Avatar from "./Avatar.jsx";

const STORY_MS = 5000;

function parseDbTime(value) {
  if (!value) return null;
  const normalized = value.includes("T") ? value : `${value.replace(" ", "T")}Z`;
  const date = new Date(normalized);
  return Number.isNaN(date.getTime()) ? null : date;
}

function formatExact(date) {
  if (!date) return "";
  return date.toLocaleString([], {
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

function formatRemaining(ms) {
  if (ms <= 0) return "expiring…";
  const minutes = Math.round(ms / 60000);
  if (minutes < 60) return `${minutes}m left`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `${hours}h left`;
  return `${Math.round(hours / 24)}d left`;
}

export default function StatusViewer({
  group,
  me,
  onClose,
  onViewed,
  onDelete,
  onOpenViewers,
}) {
  const statuses = group.statuses;
  const [index, setIndex] = useState(0);
  const current = statuses[index];

  // Mark viewed when a status becomes active (never mark your own).
  useEffect(() => {
    if (!current || current.mine) return;
    if (!current.seenByMe) onViewed(current.id);
  }, [current, onViewed]);

  // Auto-advance past the last story, which closes the viewer via the effect
  // below (index >= statuses.length means no current story).
  useEffect(() => {
    if (!current) return;
    const timer = setTimeout(() => {
      setIndex((i) => i + 1);
    }, STORY_MS);
    return () => clearTimeout(timer);
  }, [index, statuses.length, current]);

  // Close when the viewer is advanced past the last story.
  useEffect(() => {
    if (!current) onClose();
  }, [current, onClose]);

  if (!current) return null;

  const expiresAt = parseDbTime(current.expiresAt);
  const createdAt = parseDbTime(current.createdAt);
  const remaining = expiresAt ? expiresAt.getTime() - Date.now() : 0;

  return (
    <div className="status-viewer">
      <div className="story-progress">
        {statuses.map((status, i) => (
          <span key={status.id} className={i <= index ? "done" : ""}>
            <i
              key={i === index ? `${status.id}-${i}` : status.id}
              className={i === index ? "run" : ""}
              style={{ animationDuration: `${STORY_MS}ms` }}
            />
          </span>
        ))}
      </div>

      <header>
        <Avatar
          name={group.author.displayName}
          color={group.author.avatarColor}
          size={36}
        />
        <div className="grow">
          <strong>
            {current.mine ? "My status" : group.author.displayName}
          </strong>
          <em>
            {createdAt ? formatExact(createdAt) : ""} ·{" "}
            {remaining > 0
              ? formatRemaining(remaining)
              : "expiring…"}
          </em>
        </div>
        {current.mine && (
          <>
            <button type="button" onClick={() => onOpenViewers(current)}>
              👁 {current.viewCount}
            </button>
            <button
              type="button"
              onClick={() => onDelete(current.id)}
              aria-label="Delete status"
            >
              🗑️
            </button>
          </>
        )}
        <button type="button" onClick={onClose} aria-label="Close status">
          ✕
        </button>
      </header>

      <div
        className="story-body"
        style={{
          background: `linear-gradient(160deg, ${current.bgColor}, rgba(0,0,0,0.55))`,
        }}
      >
        <p>{current.content}</p>
      </div>

      <footer>
        <span>
          Expires {expiresAt ? formatExact(expiresAt) : "soon"}
        </span>
        <div className="story-nav">
          <button
            type="button"
            disabled={index === 0}
            onClick={() => setIndex((i) => Math.max(0, i - 1))}
          >
            ◀
          </button>
          <button
            type="button"
            disabled={index >= statuses.length - 1}
            onClick={() => setIndex((i) => Math.min(statuses.length - 1, i + 1))}
          >
            ▶
          </button>
        </div>
      </footer>
    </div>
  );
}
