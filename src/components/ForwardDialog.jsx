import Avatar from "./Avatar.jsx";

export default function ForwardDialog({
  message,
  conversations,
  onSelect,
  onClose,
}) {
  const preview = String(message?.content ?? "")
    .replace(/\s+/g, " ")
    .trim();

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <section
        className="forward-dialog"
        onClick={(event) => event.stopPropagation()}
        aria-label="Forward message"
      >
        <header>
          <h2>Forward message to…</h2>
          <button type="button" onClick={onClose} aria-label="Close">
            ✕
          </button>
        </header>
        {preview && <p className="forward-preview">“{preview.slice(0, 120)}{preview.length > 120 ? "…" : ""}”</p>}
        <ul>
          {conversations.map((conversation) => (
            <li key={conversation.id}>
              <button type="button" onClick={() => onSelect(conversation.id)}>
                <Avatar
                  name={conversation.otherUser.displayName}
                  color={conversation.otherUser.avatarColor}
                  size={36}
                />
                <span className="meta">
                  <strong>{conversation.otherUser.displayName}</strong>
                  <em>@{conversation.otherUser.username}</em>
                </span>
              </button>
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}
