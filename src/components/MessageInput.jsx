import { useEffect, useRef, useState } from "react";
import { getSocket } from "../services/socket.js";

const TYPING_THROTTLE_MS = 1000;

function conversationTitle(conversation) {
  if (!conversation) return "";
  return conversation.isGroup
    ? conversation.name || "group"
    : conversation.otherUser.displayName;
}

export default function MessageInput({ conversation, disabled }) {
  const [text, setText] = useState("");
  const lastTypingEmitRef = useRef(0);

  useEffect(() => {
    setText("");
  }, [conversation?.id]);

  function emitTyping(isTyping) {
    const socket = getSocket();
    if (!socket || !conversation) return;
    // Throttle "is typing" so we don't emit one event per keystroke. Always
    // let the stop signal through so the indicator can clear immediately.
    if (isTyping) {
      const now = Date.now();
      if (now - lastTypingEmitRef.current < TYPING_THROTTLE_MS) return;
      lastTypingEmitRef.current = now;
    }
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
            ? `Message ${conversationTitle(conversation)}`
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
