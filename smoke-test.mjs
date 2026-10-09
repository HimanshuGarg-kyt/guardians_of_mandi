// End-to-end smoke test: two users over real REST + Socket.IO covering the
// new features. Run with the server on PORT (default 3099).
import { io } from "socket.io-client";

const PORT = process.env.PORT || 3099;
const BASE = `http://localhost:${PORT}`;
const stamp = Date.now().toString(36);

let failures = 0;
function check(name, condition, extra = "") {
  if (condition) console.log(`  PASS  ${name}`);
  else {
    failures += 1;
    console.log(`  FAIL  ${name} ${extra}`);
  }
}

async function api(path, { method = "GET", body, token } = {}) {
  const response = await fetch(`${BASE}${path}`, {
    method,
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  const data = await response.json().catch(() => ({}));
  return { status: response.status, data };
}

function connect(token) {
  return new Promise((resolve, reject) => {
    const socket = io(BASE, { auth: { token }, transports: ["websocket"] });
    socket.on("connect", () => resolve(socket));
    socket.on("connect_error", reject);
    setTimeout(() => reject(new Error("socket connect timeout")), 5000);
  });
}

function emit(socket, event, payload) {
  return new Promise((resolve) => socket.emit(event, payload, resolve));
}

const userA = { username: `alice_${stamp}`, password: "secret123", displayName: "Alice" };
const userB = { username: `bob_${stamp}`, password: "secret123", displayName: "Bob" };
const userC = { username: `carol_${stamp}`, password: "secret123", displayName: "Carol" };

// --- auth ---
console.log("Auth & profile");
const regA = await api("/api/auth/register", { method: "POST", body: userA });
const regB = await api("/api/auth/register", { method: "POST", body: userB });
const regC = await api("/api/auth/register", { method: "POST", body: userC });
check("register alice/bob/carol", regA.status === 201 && regB.status === 201 && regC.status === 201);
check("profile has avatarColor", regA.data.user.avatarColor === "#7bd389", JSON.stringify(regA.data.user));

const patched = await api("/api/auth/me", {
  method: "PATCH",
  token: regA.data.token,
  body: { displayName: "Alice A", avatarColor: "#4fc3f7" },
});
check("profile update", patched.data.user.displayName === "Alice A" && patched.data.user.avatarColor === "#4fc3f7");

const badPw = await api("/api/auth/me/password", {
  method: "POST",
  token: regA.data.token,
  body: { currentPassword: "wrong", newPassword: "newsecret1" },
});
const goodPw = await api("/api/auth/me/password", {
  method: "POST",
  token: regA.data.token,
  body: { currentPassword: "secret123", newPassword: "newsecret1" },
});
check("password wrong rejected", badPw.status === 401);
check("password change ok", goodPw.data.ok === true);
const relogin = await api("/api/auth/login", { method: "POST", body: { ...userA, password: "newsecret1" } });
check("login with new password", relogin.status === 200);

const tokenA = regA.data.token;
const tokenB = regB.data.token;
const tokenC = regC.data.token;
const idA = regA.data.user.id;
const idB = regB.data.user.id;
const idC = regC.data.user.id;

// --- settings: theme & wallpaper ---
console.log("Settings");
const theme = await api("/api/settings/theme", { method: "PUT", token: tokenA, body: { theme: "light" } });
check("theme set", theme.data.theme === "light");
const settings = await api("/api/settings", { token: tokenA });
check("settings read", settings.data.theme === "light");

// --- direct conversation + messages ---
console.log("Chat: send / edit / delete / react / forward");
const convoA = (await api("/api/conversations", { method: "POST", token: tokenA, body: { userId: idB } })).data.conversation;
const convoId = convoA.id;

const socketA = await connect(tokenA);
const socketB = await connect(tokenB);
const socketC = await connect(tokenC);

// Collect B's live events
const liveB = [];
socketB.on("message:new", (m) => liveB.push(["new", m]));
socketB.on("message:updated", (m) => liveB.push(["updated", m]));
socketB.on("reaction:update", (p) => liveB.push(["reaction", p]));

const sent = await emit(socketA, "message:send", { conversationId: convoId, content: "hello bob" });
check("send message", sent.ok === true && sent.message.content === "hello bob");
const msgId = sent.message.id;

await new Promise((r) => setTimeout(r, 200));
check("bob received live message", liveB.some(([t, m]) => t === "new" && m.id === msgId));

const edited = await emit(socketA, "message:edit", { conversationId: convoId, messageId: msgId, content: "hello bob (edited)" });
check("edit message", edited.ok === true && edited.message.editedAt !== null);

const reacted = await emit(socketA, "reaction:toggle", { conversationId: convoId, messageId: msgId, emoji: "👍" });
check("react to own message", reacted.ok === true && reacted.reactions[0]?.emoji === "👍");
const reactedB = await emit(socketB, "reaction:toggle", { conversationId: convoId, messageId: msgId, emoji: "👍" });
check("reaction count 2", reactedB.reactions[0]?.count === 2);
const unreacted = await emit(socketB, "reaction:toggle", { conversationId: convoId, messageId: msgId, emoji: "👎" });
check("invalid emoji rejected", unreacted.ok === false);

await new Promise((r) => setTimeout(r, 200));
const bReactions = liveB.filter(([t]) => t === "reaction");
check("bob got reaction updates", bReactions.length >= 2);

// history includes reactions
const history = await api(`/api/conversations/${convoId}/messages`, { token: tokenB });
check("history has reactions", history.data.messages[0].reactions.length === 1);
check("history shows edited", history.data.messages[0].editedAt !== null);

// forward to a second conversation
const convoC = (await api("/api/conversations", { method: "POST", token: tokenA, body: { userId: idC } })).data.conversation;
const forwarded = await emit(socketA, "message:forward", {
  conversationId: convoId,
  messageId: msgId,
  targetConversationId: convoC.id,
});
check("forward message", forwarded.ok === true && forwarded.message.forwardedFromId === msgId);

const deleted = await emit(socketA, "message:delete", { conversationId: convoId, messageId: msgId });
check("delete message", deleted.ok === true && deleted.message.deletedAt !== null);
const editDeleted = await emit(socketA, "message:edit", { conversationId: convoId, messageId: msgId, content: "zombie" });
check("edit deleted rejected", editDeleted.ok === false);
const notOwner = await emit(socketB, "message:delete", { conversationId: convoId, messageId: msgId });
check("delete by non-owner rejected", notOwner.ok === false);

// --- groups ---
console.log("Groups");
const group = (await api("/api/conversations", {
  method: "POST",
  token: tokenA,
  body: { name: "Kamand Team", memberIds: [idB, idC] },
})).data.conversation;
check("group created", group.isGroup === true && group.name === "Kamand Team");
check("group members", group.members.length === 3);
check("otherMembers excludes me", group.otherMembers.length === 2);

const groupMsg = await emit(socketA, "message:send", { conversationId: group.id, content: "hi team" });
check("group message sent", groupMsg.ok === true);

const notMember = await api("/api/conversations", {
  method: "POST",
  token: tokenB,
  body: { userId: idC },
});
const dupGroup = await api("/api/conversations", {
  method: "POST",
  token: tokenB,
  body: { name: "Dup", memberIds: [999999] },
});
check("group with invalid member rejected", dupGroup.status === 400);

// --- blocks ---
console.log("Blocks");
const blocked = await api("/api/settings/blocks", { method: "POST", token: tokenB, body: { userId: idC } });
check("block carol", blocked.data.blocks.length === 1);
const blockedSend = await emit(socketB, "message:send", { conversationId: (await api("/api/conversations", { method: "POST", token: tokenB, body: { userId: idC } })).data.conversation.id, content: "are you there" });
check("blocked DM send rejected", blockedSend.ok === false, JSON.stringify(blockedSend));
const unblocked = await api(`/api/settings/blocks/${idC}`, { method: "DELETE", token: tokenB });
check("unblock carol", unblocked.data.blocks.length === 0);

// --- statuses ---
console.log("Status stories");
const nowIso = new Date().toISOString();
const status1h = await api("/api/statuses", {
  method: "POST",
  token: tokenA,
  body: { content: "hackathon won!", bgColor: "#7bd389", preset: "1h" },
});
check("status preset 1h", status1h.status === 201 && status1h.data.status.expiresAt);

const custom = new Date(Date.now() + 36 * 60 * 60 * 1000).toISOString();
const statusCustom = await api("/api/statuses", {
  method: "POST",
  token: tokenB,
  body: { content: "in the library", bgColor: "#4fc3f7", expiresAt: custom },
});
check("status custom expiry 36h", statusCustom.status === 201);

const statusPast = await api("/api/statuses", {
  method: "POST",
  token: tokenB,
  body: { content: "old", expiresAt: "2020-01-01T00:00:00.000Z" },
});
check("past expiry rejected", statusPast.status === 400);
const statusFar = await api("/api/statuses", {
  method: "POST",
  token: tokenB,
  body: { content: "far", expiresAt: "2030-01-01T00:00:00.000Z" },
});
check("expiry > 7 days rejected", statusFar.status === 400);

const statusList = await api("/api/statuses", { token: tokenC });
check("carol sees bob's status", statusList.data.statuses.some((s) => s.author.id === idB));
check("carol does not see own", !statusList.data.statuses.some((s) => s.author.id === idC));
check("authors list", statusList.data.authors.length >= 1);

const viewed = await api(`/api/statuses/${statusCustom.data.status.id}/viewed`, { method: "POST", token: tokenC });
check("status viewed", viewed.data.viewCount === 1);
const viewersForbidden = await api(`/api/statuses/${statusCustom.data.status.id}/viewers`, { token: tokenC });
check("viewers hidden from non-author", viewersForbidden.status === 403);
const viewersOk = await api(`/api/statuses/${statusCustom.data.status.id}/viewers`, { token: tokenB });
check("author sees viewers", viewersOk.data.viewers.length === 1 && viewersOk.data.viewers[0].id === idC);

const delStatus = await api(`/api/statuses/${status1h.data.status.id}`, { method: "DELETE", token: tokenB });
check("delete others' status rejected", delStatus.status === 404);
const delOwn = await api(`/api/statuses/${status1h.data.status.id}`, { method: "DELETE", token: tokenA });
check("delete own status", delOwn.data.ok === true);

// --- presence / last seen ---
console.log("Presence");
// Listen BEFORE triggering: presence fires on connect/disconnect, and all
// sockets are already connected by this point.
const socketD = await connect(tokenB);
const presence = await new Promise((resolve) => {
  socketC.on("presence:update", (p) => resolve(p));
  setTimeout(() => resolve(null), 2000);
});
socketD.disconnect();
if (presence) {
  check("presence includes online users", Array.isArray(presence.onlineUserIds) && presence.onlineUserIds.includes(idB));
  socketA.disconnect();
  // Skip intermediate presence events (other sockets connecting/disconnecting)
  // and wait for the one that reports Alice went offline.
  const offline = await new Promise((resolve) => {
    const onPresence = (p) => {
      if (p.offlineLastSeen && p.offlineLastSeen[idA]) {
        socketC.off("presence:update", onPresence);
        resolve(p);
      }
    };
    socketC.on("presence:update", onPresence);
    setTimeout(() => {
      socketC.off("presence:update", onPresence);
      resolve(null);
    }, 3000);
  });
  check("alice offline with lastSeen", Boolean(offline));
} else {
  check("presence event", false, "no event received");
}

socketB.disconnect();
socketC.disconnect();

console.log(failures === 0 ? "\nALL CHECKS PASSED" : `\n${failures} CHECK(S) FAILED`);
process.exit(failures === 0 ? 0 : 1);
