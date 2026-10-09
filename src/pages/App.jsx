import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Login from "../components/Login.jsx";
import Sidebar from "../components/Sidebar.jsx";
import ChatWindow from "../components/ChatWindow.jsx";
import MessageInput from "../components/MessageInput.jsx";
import { api, getToken, setToken } from "../services/api.js";
import { connectSocket, disconnectSocket, getSocket } from "../services/socket.js";

export default function App() {
  const [token, setTokenState] = useState(getToken());
  const [me, setMe] = useState(null);
  const [users, setUsers] = useState([]);
  const [conversations, setConversations] = useState([]);
  const [active, setActive] = useState(null);
  const [messages, setMessages] = useState([]);
  const [search, setSearch] = useState("");
  const [typing, setTyping] = useState(false);
  const [onlineUserIds, setOnlineUserIds] = useState([]);
  const [bootError, setBootError] = useState("");

  const activeId = active?.id;
  const activeIdRef = useRef(activeId);
  activeIdRef.current = activeId;

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

  useEffect(() => {
    if (!token) return undefined;
    let cancelled = false;

    (async () => {
      try {
        const { user } = await api("/api/auth/me");
        if (cancelled) return;
        setMe(user);
        await refreshLists();
        const socket = connectSocket(token);

        socket.on("presence:update", ({ onlineUserIds: ids }) => {
          setOnlineUserIds(ids);
        });

        socket.on("message:new", (message) => {
          setConversations((current) => {
            const exists = current.some((c) => c.id === message.conversationId);
            if (!exists) {
              refreshLists();
              return current;
            }
            return current
              .map((c) =>
                c.id === message.conversationId
                  ? {
                      ...c,
                      lastMessage: message.content,
                      lastMessageAt: message.createdAt,
                      unreadCount:
                        message.conversationId === activeIdRef.current ||
                        message.senderId === user.id
                          ? 0
                          : (c.unreadCount || 0) + 1,
                    }
                  : c
              )
              .sort((a, b) =>
                String(b.lastMessageAt || "").localeCompare(
                  String(a.lastMessageAt || "")
                )
              );
          });

          setActive((current) => {
            if (current?.id !== message.conversationId) return current;
            setMessages((msgs) =>
              msgs.some((m) => m.id === message.id) ? msgs : [...msgs, message]
            );
            getSocket()?.emit("message:read", {
              conversationId: message.conversationId,
            });
            return current;
          });
        });

        socket.on("typing", (payload) => {
          setActive((current) => {
            if (current?.id === payload.conversationId) {
              setTyping(Boolean(payload.isTyping));
            }
            return current;
          });
        });

        socket.on("message:read", (payload) => {
          setMessages((msgs) =>
            msgs.map((m) =>
              m.conversationId === payload.conversationId && !m.readAt
                ? { ...m, readAt: payload.readAt }
                : m
            )
          );
        });
      } catch (error) {
        if (!cancelled) {
          setBootError(error.message);
          setToken(null);
          setTokenState(null);
        }
      }
    })();

    return () => {
      cancelled = true;
      disconnectSocket();
    };
  }, [token, refreshLists]);

  useEffect(() => {
    if (!activeId) return;
    loadMessages(activeId, search);
    getSocket()?.emit("conversation:join", { conversationId: activeId });
    getSocket()?.emit("message:read", { conversationId: activeId });
    setTyping(false);
  }, [activeId, search, loadMessages]);

  async function handleAuth({ token: nextToken, user }) {
    setToken(nextToken);
    setTokenState(nextToken);
    setMe(user);
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
    disconnectSocket();
  }

  async function handleSelectUser(user) {
    const existing = conversations.find((c) => c.otherUser.id === user.id);
    if (existing) {
      setActive(existing);
      setSearch("");
      return;
    }
    const { conversation } = await api("/api/conversations", {
      method: "POST",
      body: { userId: user.id },
    });
    setConversations((current) => [conversation, ...current]);
    setActive(conversation);
    setSearch("");
  }

  const sidebarConversations = useMemo(() => conversations, [conversations]);

  if (!token || !me) {
    return <Login onAuth={handleAuth} />;
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
