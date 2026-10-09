import Avatar from "./Avatar.jsx";
import StatusBar from "./StatusBar.jsx";

export default function Sidebar({
  me,
  users,
  conversations,
  onlineUserIds,
  activeId,
  onSelectUser,
  onSelectConversation,
  onNewGroup,
  onLogout,
  onOpenSettings,
  statusGroups = [],
  onOpenComposer,
  onOpenStatusViewer,
}) {
  // Direct conversations already started, keyed by the other user, so the
  // campus list can show last-message previews.
  const directByUser = new Map(
    conversations
      .filter((c) => !c.isGroup && c.otherUser)
      .map((c) => [c.otherUser.id, c])
  );

  return (
    <aside className="sidebar">
      <div className="profile">
        <Avatar name={me.displayName} color={me.avatarColor} size={40} />
        <div>
          <strong>{me.displayName}</strong>
          <p>@{me.username}</p>
        </div>
        <div className="profile-actions">
          <button
            type="button"
            className="icon-button"
            onClick={onOpenSettings}
            aria-label="Settings"
            title="Settings"
          >
            ⚙
          </button>
          <button type="button" onClick={onLogout}>
            Sign out
          </button>
        </div>
      </div>

      <div className="status-bar-wrap">
        <StatusBar
          me={me}
          statusGroups={statusGroups}
          onOpenComposer={onOpenComposer}
          onOpenViewer={onOpenStatusViewer}
        />
      </div>

      <div className="sidebar-heading">
        <h3>Chats</h3>
        <button
          type="button"
          className="icon-button"
          onClick={onNewGroup}
          aria-label="New group"
          title="New group"
        >
          ＋
        </button>
      </div>
      <ul>
        {conversations.length === 0 && (
          <li className="muted">No chats yet. Start one from the campus list below.</li>
        )}
        {conversations.map((conversation) => {
          const isGroup = conversation.isGroup;
          const other = conversation.otherUser;
          const title = isGroup ? conversation.name : other.displayName;
          const subtitle = conversation.lastMessage
            ? conversation.lastMessage
            : isGroup
              ? otherMembersLabel(conversation.otherMembers, me.id)
              : `@${other.username}`;
          const online =
            !isGroup && onlineUserIds.includes(other.id);
          return (
            <li key={conversation.id}>
              <button
                type="button"
                className={conversation.id === activeId ? "active" : ""}
                onClick={() => onSelectConversation(conversation)}
              >
                {isGroup ? (
                  <span className="group-avatar" aria-hidden="true">
                    {membersInitials(conversation.members)}
                  </span>
                ) : (
                  <span className={`dot ${online ? "on" : ""}`} />
                )}
                <span className="meta">
                  <strong>{title}</strong>
                  <em>{subtitle}</em>
                </span>
                {conversation.unreadCount > 0 && (
                  <b className="badge">{conversation.unreadCount}</b>
                )}
              </button>
            </li>
          );
        })}
      </ul>

      <h3>Campus</h3>
      <ul>
        {users.length === 0 && (
          <li className="muted">No other users yet. Open a second browser and register.</li>
        )}
        {users.map((user) => {
          const conversation = directByUser.get(user.id);
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

function membersInitials(members = []) {
  const initials = members
    .slice(0, 2)
    .map((m) => m.displayName.slice(0, 1).toUpperCase())
    .join("");
  return initials || "👥";
}

function otherMembersLabel(otherMembers = [], meId) {
  if (otherMembers.length === 0) return "Just you";
  const names = otherMembers.map((m) => m.displayName);
  if (names.length <= 2) return names.join(", ");
  return `${names.slice(0, 2).join(", ")} +${names.length - 2}`;
}
