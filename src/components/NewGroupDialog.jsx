import { useState } from "react";
import Avatar from "./Avatar.jsx";

export default function NewGroupDialog({ users, onCreate, onClose }) {
  const [name, setName] = useState("");
  const [selected, setSelected] = useState(() => new Set());
  const [error, setError] = useState("");

  function toggle(userId) {
    setSelected((current) => {
      const next = new Set(current);
      if (next.has(userId)) next.delete(userId);
      else next.add(userId);
      return next;
    });
  }

  async function submit(event) {
    event.preventDefault();
    const groupName = name.trim();
    if (!groupName) {
      setError("Give the group a name");
      return;
    }
    if (selected.size === 0) {
      setError("Pick at least one member");
      return;
    }
    try {
      await onCreate(groupName, [...selected]);
      onClose();
    } catch (err) {
      setError(err.message);
    }
  }

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <section
        className="new-group-dialog"
        onClick={(event) => event.stopPropagation()}
        aria-label="New group"
      >
        <header>
          <h2>New group</h2>
          <button type="button" onClick={onClose} aria-label="Close">
            ✕
          </button>
        </header>
        <form onSubmit={submit}>
          <label>
            Group name
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Kamand Prompt Team"
              maxLength={100}
              autoFocus
              required
            />
          </label>
          <fieldset>
            <legend>Members ({selected.size} selected)</legend>
            <ul className="picker-list">
              {users.map((user) => (
                <li key={user.id}>
                  <label className="picker-option">
                    <input
                      type="checkbox"
                      checked={selected.has(user.id)}
                      onChange={() => toggle(user.id)}
                    />
                    <Avatar
                      name={user.displayName}
                      color={user.avatarColor}
                      size={28}
                    />
                    <span className="meta">
                      <strong>{user.displayName}</strong>
                      <em>@{user.username}</em>
                    </span>
                  </label>
                </li>
              ))}
            </ul>
          </fieldset>
          {error && <p className="error">{error}</p>}
          <button className="primary" type="submit">
            Create group
          </button>
        </form>
      </section>
    </div>
  );
}
