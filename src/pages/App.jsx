import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Login from "../components/Login.jsx";
import Sidebar from "../components/Sidebar.jsx";
import ChatWindow from "../components/ChatWindow.jsx";
import MessageInput from "../components/MessageInput.jsx";
import { api, getToken, setToken } from "../services/api.js";
import { connectSocket, disconnectSocket, getSocket } from "../services/socket.js";

const TYPING_CLEAR_MS = 3000;
const SEARCH_DEBOUNCE_MS = 300;

export default function App() {
  const [token, setTokenState] = useState(getToken());
  const [me, setMe] = useState(null);
  const [users, setUsers] = useState([]);
  const [conversations, setConversations] = useState([]);
  const [active, setActive] = useState(null);
  const [messages, setMessages] = useState([]);
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [typing, setTyping] = useState(false);
  const [onlineUserIds, setOnlineUserIds] = useState([]);
  const [bootError, setBootError] = useState("");

  const activeId = active?.id;
  const activeIdRef = useRef(activeId);
  activeIdRef.current = activeId;

  const conversationsRef = useRef(conversations);
  conversationsRef.current = conversations;

  const typingTimerRef = useRef(null);

  const refreshLists = useCallback(async () => {
    const [userData, convoData] = await Promise.all([
      api("/api/users"),
      api("/api/conversations"),
    ]);
    setUsers(userData.users);
    setConversations(convoData.conversations);
    return convoData.conversations;
  }, []);

  const loadMessages = useCallback(async (conversationId, query = "") => {
    const data = await api(
      `/api/conversations/${conversationId}/messages${
        query ? `?q=${encodeURIComponent(query)}` : ""
      }`
    );
    setMessages(data.messages);
  }, []);

  // Surface API failures instead of leaving an unhandled rejection: on an
  // expired session, log out cleanly with an explanation.
  const handleApiError = useCallback((error) => {
    if (error?.status === 401) {
      setToken(null);
      setTokenState(null);
      setMe(null);
      setUsers([]);
      setConversations([]);
      setActive(null);
      setMessages([]);
      disconnectSocket();
      setBootError("Session expired. Please sign in again.");
    } else {
      setBootError(error?.message || "Something went wrong");
    }
  }, []);

  const clearTypingLater = useCallback(() => {
    if (typingTimerRef.current) clearTimeout(typingTimerRef.current);
    typingTimerRef.current = setTimeout(() => setTyping(false), TYPING_CLEAR_MS);
  }, []);

  const stopTyping = useCallback(() => {
    if (typingTimerRef.current) clearTimeout(typingTimerRef.current);
    setTyping(false);
  }, []);

  useEffect(() => {
    if (!token) return undefined;
    let cancelled = false;

    (async () => {
      try {
        const { user } = await api("/api/auth/me");
        if (cancelled) return;
        const socket = connectSocket(token);

        socket.on("presence:update", ({ onlineUserIds: ids }) => {
          setOnlineUserIds(ids);
        });

        socket.on("message:new", (message) => {
          const isActive = activeIdRef.current === message.conversationId;
          const mine = message.senderId === user.id;
          const seen = conversationsRef.current.some(
            (c) => c.id === message.conversationId
          );

          // Side effects (refetch, socket ack) run outside the state updaters,
          // which must stay pure (StrictMode invokes them twice).
          if (!seen) {
            // Brand-new conversation: refresh the list, then bail.
            refreshLists().catch(handleApiError);
            return;
          }

          setConversations((current) =>
            current
              .map((c) =>
                c.id === message.conversationId
                  ? {
                      ...c,
                      lastMessage: message.content,
                      lastMessageAt: message.createdAt,
                      unreadCount:
                        isActive || mine ? 0 : (c.unreadCount || 0) + 1,
                    }
                  : c
              )
              .sort((a, b) =>
                String(b.lastMessageAt || "").localeCompare(
                  String(a.lastMessageAt || "")
                )
              )
          );

          if (isActive) {
            setMessages((msgs) =>
              msgs.some((m) => m.id === message.id) ? msgs : [...msgs, message]
            );
            getSocket()?.emit("message:read", {
              conversationId: message.conversationId,
            });
          }
        });

        socket.on("typing", (payload) => {
          if (activeIdRef.current !== payload.conversationId) return;
          if (payload.isTyping) {
            setTyping(true);
            clearTypingLater();
          } else {
            stopTyping();
          }
        });

        socket.on("message:read", (payload) => {
          setMessages((msgs) =>
            msgs.map((m) =>
              m.conversationId === payload.conversationId &&
              m.senderId === user.id &&
              !m.readAt
                ? { ...m, readAt: payload.readAt }
                : m
            )
          );
        });

        await refreshLists();
        if (!cancelled) setMe(user);
      } catch (error) {
        if (!cancelled) {
          setBootError(error.status === 401
            ? "Session expired. Please sign in again."
            : error.message);
          setToken(null);
          setTokenState(null);
        }
      }
    })();

    return () => {
      cancelled = true;
      disconnectSocket();
      if (typingTimerRef.current) clearTimeout(typingTimerRef.current);
    };
  }, [token, refreshLists, handleApiError, clearTypingLater, stopTyping]);

  // Debounce the in-chat search so we don't fire a request per keystroke.
  useEffect(() => {
    const timer = setTimeout(
      () => setDebouncedSearch(search),
      SEARCH_DEBOUNCE_MS
    );
    return () => clearTimeout(timer);
  }, [search]);

  // Join/read only when the conversation changes — not on every keystroke.
  useEffect(() => {
    if (!activeId) return;
    getSocket()?.emit("conversation:join", { conversationId: activeId });
    getSocket()?.emit("message:read", { conversationId: activeId });
    stopTyping();
  }, [activeId, stopTyping]);

  useEffect(() => {
    if (!activeId) return;
    loadMessages(activeId, debouncedSearch).catch(handleApiError);
  }, [activeId, debouncedSearch, loadMessages, handleApiError]);

  async function handleAuth({ token: nextToken }) {
    setToken(nextToken);
    setTokenState(nextToken);
    setMe(null);
    setBootError("");
  }

  function handleLogout() {
    setToken(null);
    setTokenState(null);
    setMe(null);
    setUsers([]);
    setConversations([]);
    setActive(null);
    setMessages([]);
    setSearch("");
    setDebouncedSearch("");
    setBootError("");
    disconnectSocket();
  }

  async function handleSelectUser(user) {
    try {
      const existing = conversations.find((c) => c.otherUser.id === user.id);
      if (existing) {
        setActive(existing);
        setSearch("");
        setDebouncedSearch("");
        return;
      }
      const { conversation } = await api("/api/conversations", {
        method: "POST",
        body: { userId: user.id },
      });
      setConversations((current) =>
        current.some((c) => c.id === conversation.id) ? current : [conversation, ...current]
      );
      setActive(conversation);
      setSearch("");
      setDebouncedSearch("");
    } catch (error) {
      handleApiError(error);
    }
  }

  const sidebarConversations = useMemo(() => conversations, [conversations]);

  if (!token) {
    return (
      <Login
        onAuth={handleAuth}
        initialError={bootError}
        onInteract={() => setBootError("")}
      />
    );
  }

  if (!me) {
    return (
      <div className="auth-shell">
        <p>Connecting to campus chat…</p>
        {bootError && <p className="error">{bootError}</p>}
      </div>
    );
  }

  return (
    <div className="app">
      <Sidebar
        me={me}
        users={users}
        conversations={sidebarConversations}
        onlineUserIds={onlineUserIds}
        activeId={activeId}
        onSelectUser={handleSelectUser}
        onLogout={handleLogout}
      />
      <main>
        {bootError && <p className="error">{bootError}</p>}
        <ChatWindow
          me={me}
          conversation={active}
          messages={messages}
          typing={typing}
          search={search}
          onSearch={setSearch}
        />
        <MessageInput conversation={active} disabled={!active} />
      </main>
    </div>
  );
}
