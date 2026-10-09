import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Login from "../components/Login.jsx";
import Sidebar from "../components/Sidebar.jsx";
import ChatWindow from "../components/ChatWindow.jsx";
import MessageInput from "../components/MessageInput.jsx";
import SettingsPanel from "../components/SettingsPanel.jsx";
import NewGroupDialog from "../components/NewGroupDialog.jsx";
import StatusBar from "../components/StatusBar.jsx";
import StatusComposer from "../components/StatusComposer.jsx";
import StatusViewer from "../components/StatusViewer.jsx";
import StatusViewers from "../components/StatusViewers.jsx";
import { api, getToken, setToken } from "../services/api.js";
import { connectSocket, disconnectSocket, getSocket } from "../services/socket.js";
import { applyTheme, getStoredTheme } from "../services/theme.js";

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
  const [typingUser, setTypingUser] = useState(null);
  const [onlineUserIds, setOnlineUserIds] = useState([]);
  const [bootError, setBootError] = useState("");
  const [theme, setTheme] = useState(getStoredTheme());
  const [wallpapers, setWallpapers] = useState({});
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [blocks, setBlocks] = useState([]);
  const [newGroupOpen, setNewGroupOpen] = useState(false);
  const [statuses, setStatuses] = useState([]);
  const [statusAuthors, setStatusAuthors] = useState([]);
  const [composerOpen, setComposerOpen] = useState(false);
  const [viewerAuthorId, setViewerAuthorId] = useState(null);
  const [viewersOf, setViewersOf] = useState(null);

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
    typingTimerRef.current = setTimeout(() => setTypingUser(null), TYPING_CLEAR_MS);
  }, []);

  const loadSettings = useCallback(async () => {
    const settings = await api("/api/settings");
    setTheme(settings.theme);
    applyTheme(settings.theme);
    setWallpapers(settings.wallpapers || {});
  }, []);

  const loadBlocks = useCallback(async () => {
    const data = await api("/api/settings/blocks");
    setBlocks(data.blocks || []);
  }, []);

  const loadStatuses = useCallback(async () => {
    const data = await api("/api/statuses");
    setStatuses(data.statuses || []);
    setStatusAuthors(data.authors || []);
  }, []);

  async function handleCreateStatus(body) {
    await api("/api/statuses", { method: "POST", body });
    await loadStatuses();
  }

  async function handleStatusViewed(statusId) {
    await api(`/api/statuses/${statusId}/viewed`, { method: "POST" });
    setStatuses((current) =>
      current.map((status) =>
        status.id === statusId
          ? {
              ...status,
              seenByMe: true,
              viewCount: status.mine ? status.viewCount : status.viewCount + 1,
            }
          : status
      )
    );
  }

  async function handleDeleteStatus(statusId) {
    await api(`/api/statuses/${statusId}`, { method: "DELETE" });
    await loadStatuses();
  }

  async function handleOpenStatusViewers(status) {
    const data = await api(`/api/statuses/${status.id}/viewers`);
    setViewersOf({ ...status, viewers: data.viewers });
  }

  async function handleBlock(userId) {
    const data = await api("/api/settings/blocks", {
      method: "POST",
      body: { userId },
    });
    setBlocks(data.blocks || []);
  }

  async function handleUnblock(userId) {
    const data = await api(`/api/settings/blocks/${userId}`, {
      method: "DELETE",
    });
    setBlocks(data.blocks || []);
  }

  function handleChangeTheme(nextTheme) {
    setTheme(nextTheme);
    applyTheme(nextTheme);
    // Best-effort sync; the local change already took effect.
    api("/api/settings/theme", {
      method: "PUT",
      body: { theme: nextTheme },
    }).catch(() => {});
  }

  async function handleSaveProfile({ displayName, avatarColor }) {
    const { user } = await api("/api/auth/me", {
      method: "PATCH",
      body: { displayName, avatarColor },
    });
    setMe(user);
  }

  async function handleChangeWallpaper(conversationId, wallpaper) {
    await api(`/api/settings/wallpapers/${conversationId}`, {
      method: "PUT",
      body: { wallpaper },
    });
    setWallpapers((current) => ({ ...current, [conversationId]: wallpaper }));
  }

  // Edit / delete go over sockets with ack callbacks so failures can surface.
  function handleEditMessage(conversationId, messageId, content) {
    const socket = getSocket();
    if (!socket) return Promise.resolve({ ok: false, error: "Not connected" });
    return new Promise((resolve) => {
      socket.emit(
        "message:edit",
        { conversationId, messageId, content },
        resolve
      );
    });
  }

  function handleDeleteMessage(conversationId, messageId) {
    const socket = getSocket();
    if (!socket) return Promise.resolve({ ok: false, error: "Not connected" });
    return new Promise((resolve) => {
      socket.emit(
        "message:delete",
        { conversationId, messageId },
        resolve
      );
    });
  }

  function handleReact(conversationId, messageId, emoji) {
    const socket = getSocket();
    if (!socket) return Promise.resolve({ ok: false, error: "Not connected" });
    return new Promise((resolve) => {
      socket.emit(
        "reaction:toggle",
        { conversationId, messageId, emoji },
        resolve
      );
    });
  }

  function handleForwardMessage(conversationId, messageId, targetConversationId) {
    const socket = getSocket();
    if (!socket) return Promise.resolve({ ok: false, error: "Not connected" });
    return new Promise((resolve) => {
      socket.emit(
        "message:forward",
        { conversationId, messageId, targetConversationId },
        resolve
      );
    });
  }

  const stopTyping = useCallback(() => {
    if (typingTimerRef.current) clearTimeout(typingTimerRef.current);
    setTypingUser(null);
  }, []);

  // Resolve the sender's display name for the "… is typing" indicator from the
  // conversation shape (direct vs group).
  function typingDisplayName(conversation, userId) {
    if (!conversation) return null;
    if (conversation.isGroup) {
      return (
        conversation.otherMembers?.find((m) => m.id === userId)?.displayName || null
      );
    }
    if (conversation.otherUser?.id === userId) {
      return conversation.otherUser.displayName;
    }
    return null;
  }

  useEffect(() => {
    if (!token) return undefined;
    let cancelled = false;

    (async () => {
      try {
        const { user } = await api("/api/auth/me");
        if (cancelled) return;
        const socket = connectSocket(token);

        socket.on("presence:update", ({ onlineUserIds: ids, offlineLastSeen }) => {
          setOnlineUserIds(ids);
          if (offlineLastSeen) {
            // Fold freshly-offline last-seen stamps into the campus list.
            setUsers((current) =>
              current.map((user) =>
                offlineLastSeen[user.id]
                  ? { ...user, lastSeenAt: offlineLastSeen[user.id] }
                  : user
              )
            );
          }
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
              msgs.some((m) => m.id === message.id)
                ? msgs
                : [...msgs, { ...message, reactions: message.reactions || [] }]
            );
            getSocket()?.emit("message:read", {
              conversationId: message.conversationId,
            });
          }
        });

        socket.on("typing", (payload) => {
          if (activeIdRef.current !== payload.conversationId) return;
          if (payload.isTyping) {
            const conversation = conversationsRef.current.find(
              (c) => c.id === payload.conversationId
            );
            const displayName = typingDisplayName(conversation, payload.userId);
            if (!displayName) return; // sender not in the active conversation
            setTypingUser({ id: payload.userId, displayName });
            clearTypingLater();
          } else {
            stopTyping();
          }
        });

        socket.on("conversation:new", () => {
          refreshLists().catch(handleApiError);
        });

        socket.on("status:new", () => {
          // A new status appeared for someone — refresh the sidebar rings.
          loadStatuses().catch(() => {});
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

        socket.on("message:updated", (message) => {
          setMessages((msgs) =>
            msgs.map((m) => (m.id === message.id ? { ...m, ...message } : m))
          );
        });

        socket.on("reaction:update", ({ messageId, reactions }) => {
          setMessages((msgs) =>
            msgs.map((m) => (m.id === messageId ? { ...m, reactions } : m))
          );
        });

        await refreshLists();
        if (!cancelled) {
          setMe(user);
          loadSettings().catch(() => {});
          loadBlocks().catch(() => {});
          loadStatuses().catch(() => {});
        }
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
    // Clear the sidebar badge locally the moment the chat is opened. The
    // server marks the rows read, but the list is only refetched on
    // refreshLists, so without this the badge lingers until a refresh.
    setConversations((current) =>
      current.map((c) =>
        c.id === activeId && c.unreadCount ? { ...c, unreadCount: 0 } : c
      )
    );
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
    setWallpapers({});
    setBlocks([]);
    setSettingsOpen(false);
    disconnectSocket();
  }

  async function handleSelectUser(user) {
    try {
      const existing = conversations.find(
        (c) => !c.isGroup && c.otherUser.id === user.id
      );
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

  function handleSelectConversation(conversation) {
    setActive(conversation);
    setSearch("");
    setDebouncedSearch("");
  }

  async function handleCreateGroup(name, memberIds) {
    const { conversation } = await api("/api/conversations", {
      method: "POST",
      body: { name, memberIds },
    });
    setConversations((current) =>
      current.some((c) => c.id === conversation.id) ? current : [conversation, ...current]
    );
    setActive(conversation);
    setSearch("");
    setDebouncedSearch("");
  }

  const sidebarConversations = useMemo(() => conversations, [conversations]);

  // Group statuses into one story-group per author: mine first, then authors
  // ordered by the server's "most recent" list.
  const statusGroups = useMemo(() => {
    const byAuthor = new Map();
    for (const status of statuses) {
      const id = status.author.id;
      if (!byAuthor.has(id)) {
        byAuthor.set(id, { author: status.author, statuses: [] });
      }
      byAuthor.get(id).statuses.push(status);
    }
    const groups = [...byAuthor.values()].map((group) => ({
      ...group,
      statuses: group.statuses.sort((a, b) =>
        String(a.createdAt).localeCompare(String(b.createdAt))
      ),
      hasUnseen: group.statuses.some((s) => !s.mine && !s.seenByMe),
    }));
    const mine = groups.filter((group) => group.author.id === me?.id);
    const others = statusAuthors
      .map((author) => groups.find((group) => group.author.id === author.userId))
      .filter(Boolean);
    for (const group of groups) {
      if (!mine.includes(group) && !others.includes(group)) others.push(group);
    }
    return [...mine, ...others];
  }, [statuses, statusAuthors, me?.id]);

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
        onSelectConversation={handleSelectConversation}
        onNewGroup={() => setNewGroupOpen(true)}
        onLogout={handleLogout}
        onOpenSettings={() => setSettingsOpen(true)}
        statusGroups={statusGroups}
        onOpenComposer={() => setComposerOpen(true)}
        onOpenStatusViewer={setViewerAuthorId}
      />
      <main>
        {bootError && <p className="error">{bootError}</p>}
        <ChatWindow
          me={me}
          conversation={active}
          messages={messages}
          typingUser={typingUser}
          search={search}
          onSearch={setSearch}
          wallpaper={wallpapers[activeId]}
          onEditMessage={handleEditMessage}
          onDeleteMessage={handleDeleteMessage}
          onReact={handleReact}
          onBlock={handleBlock}
          onUnblock={handleUnblock}
          isBlocked={
            !active?.isGroup && blocks.some((b) => b.id === active?.otherUser?.id)
          }
          conversations={conversations}
          onForwardMessage={handleForwardMessage}
          otherUserOnline={
            !active?.isGroup &&
            onlineUserIds.includes(active?.otherUser?.id)
          }
          otherUserLastSeen={
            users.find((u) => u.id === active?.otherUser?.id)?.lastSeenAt || null
          }
        />
        <MessageInput conversation={active} disabled={!active} />
      </main>
      {settingsOpen && (
        <SettingsPanel
          me={me}
          theme={theme}
          wallpapers={wallpapers}
          blocks={blocks}
          activeConversationId={activeId}
          onSaveProfile={handleSaveProfile}
          onChangeTheme={handleChangeTheme}
          onChangeWallpaper={handleChangeWallpaper}
          onUnblock={handleUnblock}
          onClose={() => setSettingsOpen(false)}
        />
      )}
      {newGroupOpen && (
        <NewGroupDialog
          users={users}
          onCreate={handleCreateGroup}
          onClose={() => setNewGroupOpen(false)}
        />
      )}
      {composerOpen && (
        <StatusComposer
          onCreate={handleCreateStatus}
          onClose={() => setComposerOpen(false)}
        />
      )}
      {viewerAuthorId &&
        statusGroups.some((g) => g.author.id === viewerAuthorId) && (
          <StatusViewer
            group={statusGroups.find((g) => g.author.id === viewerAuthorId)}
            me={me}
            onClose={() => setViewerAuthorId(null)}
            onViewed={handleStatusViewed}
            onDelete={handleDeleteStatus}
            onOpenViewers={handleOpenStatusViewers}
          />
        )}      {viewersOf && (
        <StatusViewers
          status={viewersOf}
          onClose={() => setViewersOf(null)}
        />
      )}
    </div>
  );
}
