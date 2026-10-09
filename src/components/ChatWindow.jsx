import { useEffect, useRef, useState } from "react";
import Avatar from "./Avatar.jsx";
import { wallpaperBackground, wallpaperBackgroundSize } from "../config/wallpapers.js";
import { QUICK_REACTIONS } from "../config/reactions.js";
import ForwardDialog from "./ForwardDialog.jsx";

function formatTime(value) {
  if (!value) return "";
  const date = new Date(value.endsWith("Z") ? value : `${value}Z`);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}

function conversationTitle(conversation) {
  return conversation.isGroup
    ? conversation.name || "Unnamed group"
    : conversation.otherUser.displayName;
}

function conversationSubtitle(conversation) {
  if (!conversation.isGroup) return `@${conversation.otherUser.username}`;
  const others = conversation.otherMembers || [];
  if (others.length === 0) return "Just you";
  const names = others.map((member) => member.displayName);
  return names.length <= 3
    ? names.join(", ")
    : `${names.slice(0, 3).join(", ")} +${names.length - 3}`;
}

// WhatsApp-style dynamic presence: "online", "last seen today at 14:32",
// "yesterday at 09:00", or a full date for anything older.
function presenceLabel(online, lastSeenAt) {
  if (online) return "online";
  const parsed = parseLastSeen(lastSeenAt);
  if (!parsed) return "last seen recently";

  const time = parsed.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
  const now = new Date();
  const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const startOfYesterday = new Date(startOfToday.getTime() - 24 * 60 * 60 * 1000);

  if (parsed >= startOfToday) return `last seen today at ${time}`;
  if (parsed >= startOfYesterday) return `last seen yesterday at ${time}`;
  const date = parsed.toLocaleDateString([], {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
  return `last seen ${date} at ${time}`;
}

function parseLastSeen(value) {
  if (!value) return null;
  const normalized = value.includes("T") ? value : `${value.replace(" ", "T")}Z`;
  const date = new Date(normalized);
  return Number.isNaN(date.getTime()) ? null : date;
}

export default function ChatWindow({
  me,
  conversation,
  messages,
  typingUser,
  search,
  onSearch,
  wallpaper,
  onEditMessage,
  onDeleteMessage,
  onReact,
  onBlock,
  onUnblock,
  isBlocked = false,
  conversations = [],
  onForwardMessage,
  otherUserOnline = false,
  otherUserLastSeen = null,
}) {
  const endRef = useRef(null);
  const [editingId, setEditingId] = useState(null);
  const [editDraft, setEditDraft] = useState("");
  const [actionError, setActionError] = useState("");
  const [pickerForId, setPickerForId] = useState(null);
  const [menuOpen, setMenuOpen] = useState(false);
  const [forwarding, setForwarding] = useState(null);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, conversation?.id]);

  // Leaving a conversation cancels any in-flight edit.
  useEffect(() => {
    setEditingId(null);
    setActionError("");
    setPickerForId(null);
    setMenuOpen(false);
    setForwarding(null);
  }, [conversation?.id]);

  function startEdit(message) {
    setEditingId(message.id);
    setEditDraft(message.content);
    setActionError("");
  }

  function cancelEdit() {
    setEditingId(null);
    setEditDraft("");
  }

  async function saveEdit(message) {
    const content = editDraft.trim();
    if (!content) return;
    try {
      const response = await onEditMessage(
        message.conversationId,
        message.id,
        content
      );
      if (response?.ok) cancelEdit();
      else setActionError(response?.error || "Could not edit message");
    } catch (error) {
      setActionError(error.message);
    }
  }

  async function removeMessage(message) {
    try {
      const response = await onDeleteMessage(
        message.conversationId,
        message.id
      );
      if (!response?.ok) {
        setActionError(response?.error || "Could not delete message");
      }
    } catch (error) {
      setActionError(error.message);
    }
  }

  // Who sent a message in this conversation (for the group sender labels).
  const membersById = new Map(
    (conversation?.members || []).map((member) => [member.id, member])
  );

  if (!conversation) {
    return (
      <section className="chat-empty">
        <h2>Start with a conversation</h2>
        <p>Pick a campus user on the left to open a private real-time chat.</p>
      </section>
    );
  }

  return (
    <section className="chat-window">
      <header className="chat-header">
        {conversation.isGroup && (
          <Avatar
            name={conversationTitle(conversation)}
            color="#4fc3f7"
            size={40}
          />
        )}
        <div>
          <h2>{conversationTitle(conversation)}</h2>
          <p>
            {conversation.isGroup ? (
              conversationSubtitle(conversation)
            ) : (
              <>
                @{conversation.otherUser.username} ·{" "}
                {presenceLabel(otherUserOnline, otherUserLastSeen)}
              </>
            )}
            {isBlocked && " · blocked"}
          </p>
        </div>
        <div className="header-tools">
          <input
            className="search"
            value={search}
            onChange={(e) => onSearch(e.target.value)}
            placeholder="Search this chat"
          />
          {!conversation.isGroup && (
            <div className="menu-wrap">
              <button
                type="button"
                className="icon-button"
                onClick={() => setMenuOpen((open) => !open)}
                aria-label="Chat options"
              >
                ⋮
              </button>
              {menuOpen && (
                <div className="menu">
                  <button
                    type="button"
                    onClick={() => {
                      setMenuOpen(false);
                      if (isBlocked) onUnblock(conversation.otherUser.id);
                      else onBlock(conversation.otherUser.id);
                    }}
                  >
                    {isBlocked
                      ? `Unblock ${conversation.otherUser.displayName}`
                      : `Block ${conversation.otherUser.displayName}`}
                  </button>
                </div>
              )}
            </div>
          )}
        </div>
      </header>

      <div
        className="message-list"
        style={{
          background: wallpaperBackground(wallpaper),
          backgroundSize: wallpaperBackgroundSize(wallpaper),
        }}
      >
        {messages.map((message) => {
          const mine = message.senderId === me.id;
          const deleted = Boolean(message.deletedAt);
          const editing = editingId === message.id;
          const reactions = message.reactions || [];
          const sender = membersById.get(message.senderId);

          if (editing) {
            return (
              <div key={message.id} className={`bubble ${mine ? "mine" : "theirs"} editing`}>
                <textarea
                  value={editDraft}
                  onChange={(e) => setEditDraft(e.target.value)}
                  rows={3}
                  autoFocus
                />
                <div className="edit-actions">
                  <button type="button" className="link" onClick={cancelEdit}>
                    Cancel
                  </button>
                  <button type="button" className="link strong" onClick={() => saveEdit(message)}>
                    Save
                  </button>
                </div>
              </div>
            );
          }

          return (
            <div
              key={message.id}
              className={`bubble ${mine ? "mine" : "theirs"} ${deleted ? "deleted" : ""} ${
                conversation.isGroup && !mine ? "group-theirs" : ""
              }`}
            >
              {conversation.isGroup && !mine && (
                <div className="sender-row">
                  {sender && (
                    <Avatar
                      name={sender.displayName}
                      color={sender.avatarColor}
                      size={22}
                    />
                  )}
                  <strong>{sender ? sender.displayName : message.senderDisplayName}</strong>
                </div>
              )}
              {deleted ? (
                <p className="deleted-text">🚫 This message was deleted</p>
              ) : (
                <p>{message.content}</p>
              )}
              {reactions.length > 0 && (
                <div className="reaction-pills">
                  {reactions.map((reaction) => (
                    <button
                      key={reaction.emoji}
                      type="button"
                      className={`reaction-pill ${
                        reaction.userIds.includes(me.id) ? "mine" : ""
                      }`}
                      onClick={() =>
                        onReact(message.conversationId, message.id, reaction.emoji)
                      }
                    >
                      <span aria-hidden="true">{reaction.emoji}</span>
                      {reaction.count > 1 && <b>{reaction.count}</b>}
                    </button>
                  ))}
                </div>
              )}
              <span>
                {formatTime(message.createdAt)}
                {message.forwardedFromId ? " · forwarded" : ""}
                {message.editedAt && !deleted ? " · edited" : ""}
                {mine ? (message.readAt ? " · Read" : " · Sent") : ""}
              </span>
              {!deleted && (
                <div className="message-actions">
                  <button
                    type="button"
                    title="Forward"
                    aria-label="Forward message"
                    onClick={() => setForwarding(message)}
                  >
                    ↗
                  </button>
                  <button
                    type="button"
                    title="React"
                    aria-label="React to message"
                    onClick={() =>
                      setPickerForId((id) => (id === message.id ? null : message.id))
                    }
                  >
                    😊
                  </button>
                  {mine && (
                    <>
                      <button
                        type="button"
                        title="Edit message"
                        aria-label="Edit message"
                        onClick={() => startEdit(message)}
                      >
                        ✏️
                      </button>
                      <button
                        type="button"
                        title="Delete message"
                        aria-label="Delete message"
                        onClick={() => removeMessage(message)}
                      >
                        🗑️
                      </button>
                    </>
                  )}
                </div>
              )}
              {pickerForId === message.id && (
                <div className="reaction-picker">
                  {QUICK_REACTIONS.map((emoji) => (
                    <button
                      key={emoji}
                      type="button"
                      onClick={() => {
                        onReact(message.conversationId, message.id, emoji);
                        setPickerForId(null);
                      }}
                      aria-label={`React with ${emoji}`}
                    >
                      {emoji}
                    </button>
                  ))}
                </div>
              )}
            </div>
          );
        })}
        {typingUser && (
          <p className="typing">{typingUser.displayName} is typing…</p>
        )}
        <div ref={endRef} />
        {actionError && <p className="error sticky-error">{actionError}</p>}
      </div>

      {forwarding && (
        <ForwardDialog
          message={forwarding}
          conversations={conversations.filter((c) => c.id !== conversation.id)}
          onClose={() => setForwarding(null)}
          onSelect={async (targetConversationId) => {
            const response = await onForwardMessage(
              forwarding.conversationId,
              forwarding.id,
              targetConversationId
            );
            if (response?.ok) setForwarding(null);
            else setActionError(response?.error || "Could not forward message");
          }}
        />
      )}
    </section>
  );
}
