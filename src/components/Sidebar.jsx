export default function Sidebar({
  me,
  users,
  conversations,
  onlineUserIds,
  activeId,
  onSelectUser,
  onLogout,
}) {
  const conversationByUser = new Map(
    conversations.map((c) => [c.otherUser.id, c])
  );

  return (
    <aside className="sidebar">
      <div className="profile">
        <div className="avatar">{me.displayName.slice(0, 1).toUpperCase()}</div>
        <div>
          <strong>{me.displayName}</strong>
          <p>@{me.username}</p>
        </div>
        <button type="button" onClick={onLogout}>
          Sign out
        </button>
      </div>

      <h3>Campus</h3>
      <ul>
        {users.length === 0 && (
          <li className="muted">No other users yet. Open a second browser and register.</li>
        )}
        {users.map((user) => {
          const conversation = conversationByUser.get(user.id);
          const online = onlineUserIds.includes(user.id);
          return (
            <li key={user.id}>
              <button
                type="button"
                className={conversation?.id === activeId ? "active" : ""}
                onClick={() => onSelectUser(user)}
              >
                <span className={`dot ${online ? "on" : ""}`} />
                <span className="meta">
                  <strong>{user.displayName}</strong>
                  <em>{conversation?.lastMessage || `@${user.username}`}</em>
                </span>
                {conversation?.unreadCount > 0 && (
                  <b className="badge">{conversation.unreadCount}</b>
                )}
              </button>
            </li>
          );
        })}
      </ul>
    </aside>
  );
}
