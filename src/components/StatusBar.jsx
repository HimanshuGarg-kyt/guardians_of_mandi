import Avatar from "./Avatar.jsx";

export default function StatusBar({
  me,
  statusGroups,
  onOpenComposer,
  onOpenViewer,
}) {
  const myGroup = statusGroups.find((group) => group.author.id === me.id);
  const others = statusGroups.filter((group) => group.author.id !== me.id);

  return (
    <section className="status-bar">
      <button type="button" className="status-me" onClick={onOpenComposer}>
        <span className={`status-ring ${myGroup ? "seen" : "none"}`}>
          <Avatar name={me.displayName} color={me.avatarColor} size={44} />
          {!myGroup && <b className="status-add" aria-hidden="true">＋</b>}
        </span>
        <span className="meta">
          <strong>My status</strong>
          <em>
            {myGroup
              ? `${myGroup.statuses.length} update${myGroup.statuses.length > 1 ? "s" : ""}`
              : "Tap to add status update"}
          </em>
        </span>
      </button>

      {others.length > 0 && (
        <>
          <h3>Recent updates</h3>
          <ul>
            {others.map((group) => (
              <li key={group.author.id}>
                <button type="button" onClick={() => onOpenViewer(group.author.id)}>
                  <span className={`status-ring ${group.hasUnseen ? "unseen" : "seen"}`}>
                    <Avatar
                      name={group.author.displayName}
                      color={group.author.avatarColor}
                      size={40}
                    />
                  </span>
                  <span className="meta">
                    <strong>{group.author.displayName}</strong>
                    <em>
                      {group.hasUnseen ? "New" : "Viewed"} · {group.statuses.length} update
                      {group.statuses.length > 1 ? "s" : ""}
                    </em>
                  </span>
                </button>
              </li>
            ))}
          </ul>
        </>
      )}
    </section>
  );
}
