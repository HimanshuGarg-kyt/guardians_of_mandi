import { useEffect, useRef } from "react";

function formatTime(value) {
  if (!value) return "";
  const date = new Date(value.endsWith("Z") ? value : `${value}Z`);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}

export default function ChatWindow({
  me,
  conversation,
  messages,
  typing,
  search,
  onSearch,
}) {
  const endRef = useRef(null);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, conversation?.id]);

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
        <div>
          <h2>{conversation.otherUser.displayName}</h2>
          <p>@{conversation.otherUser.username}</p>
        </div>
        <input
          className="search"
          value={search}
          onChange={(e) => onSearch(e.target.value)}
          placeholder="Search this chat"
        />
      </header>

      <div className="message-list">
        {messages.map((message) => {
          const mine = message.senderId === me.id;
          return (
            <article
              key={message.id}
              className={`bubble ${mine ? "mine" : "theirs"}`}
            >
              <p>{message.content}</p>
              <span>
                {formatTime(message.createdAt)}
                {mine ? (message.readAt ? " · Read" : " · Sent") : ""}
              </span>
            </article>
          );
        })}
        {typing && <p className="typing">{conversation.otherUser.displayName} is typing…</p>}
        <div ref={endRef} />
      </div>
    </section>
  );
}
