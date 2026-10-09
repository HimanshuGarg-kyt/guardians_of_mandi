import { useEffect, useState } from "react";
import { getSocket } from "../services/socket.js";

export default function MessageInput({ conversation, disabled }) {
  const [text, setText] = useState("");

  useEffect(() => {
    setText("");
  }, [conversation?.id]);

  function emitTyping(isTyping) {
    const socket = getSocket();
    if (!socket || !conversation) return;
    socket.emit("typing", { conversationId: conversation.id, isTyping });
  }

  function send(event) {
    event.preventDefault();
    const content = text.trim();
    const socket = getSocket();
    if (!content || !conversation || !socket) return;
    socket.emit("message:send", {
      conversationId: conversation.id,
      content,
    }, (response) => {
      if (response && !response.ok) {
        setText(content);
      }
    });
    setText("");
    emitTyping(false);
  }

  return (
    <form className="composer" onSubmit={send}>
      <input
        value={text}
        disabled={disabled}
        placeholder={
          conversation
            ? `Message ${conversation.otherUser.displayName}`
            : "Choose someone to chat"
        }
        onChange={(e) => {
          setText(e.target.value);
          emitTyping(e.target.value.length > 0);
        }}
        onBlur={() => emitTyping(false)}
      />
      <button type="submit" disabled={disabled || !text.trim()}>
        Send
      </button>
    </form>
  );
}
