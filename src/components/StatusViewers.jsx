import Avatar from "./Avatar.jsx";

export default function StatusViewers({ status, onClose }) {
  return (
    <div className="modal-backdrop" onClick={onClose}>
      <section
        className="status-viewers"
        onClick={(event) => event.stopPropagation()}
        aria-label="Status viewers"
      >
        <header>
          <h2>Viewed by {status?.viewCount ?? 0}</h2>
          <button type="button" onClick={onClose} aria-label="Close">
            ✕
          </button>
        </header>
        <ul>
          {(status?.viewers || []).map((viewer) => (
            <li key={viewer.id}>
              <Avatar name={viewer.displayName} color={viewer.avatar_color || viewer.avatarColor} size={32} />
              <span className="meta">
                <strong>{viewer.displayName}</strong>
                <em>@{viewer.username}</em>
              </span>
            </li>
          ))}
          {(!status?.viewers || status.viewers.length === 0) && (
            <li className="muted">No views yet.</li>
          )}
        </ul>
      </section>
    </div>
  );
}
