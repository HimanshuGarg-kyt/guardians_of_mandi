# Guardians of Mandi

Real-time campus chat for **First Commit — Kamand Prompt, IIT Mandi**.

The app covers one-to-one and group realtime chat with message editing/deletion, emoji reactions, forwarding, blocking, WhatsApp-style status stories with custom expiry, presence with last-seen times, profile settings, dark/light themes, and per-chat wallpapers.

## Architecture

- **Frontend:** React + Vite (`src/`)
- **Backend:** Node.js + Express (`server.js`, `routes/`)
- **Realtime:** Socket.IO (`socket/chat.js`)
- **Database:** SQLite via `sql.js`, schema in `database/schema.sql`, file stored at `data/chat.db`
- **Migrations:** idempotent, numbered files in `database/migrations/`, run by `config/migrate.js` on boot
- **Auth:** JWT in `Authorization: Bearer` for REST, and `socket.handshake.auth.token` for WebSockets

## Features

| Area | What's included |
| --- | --- |
| Messaging | Realtime send, edit (with "edited" label), soft delete (tombstone), forward |
| Conversations | Direct chats + group chats with names and member lists |
| Reactions | 8-emoji quick palette with live counts on every bubble |
| Blocking | One-click block/ unblock from the chat menu; blocks stop messaging both ways and hide users from the campus list |
| Status | Text stories with ring avatars, viewer counts, and a chosen expiry: presets (1h / 24h / 7d) or an exact date & time |
| Presence | Online dots, dynamic "last seen today at 14:32" style status |
| Settings | Panel with display name, avatar color, password change, dark/light theme, per-chat wallpaper, blocked-people list |

## Setup

```bash
cd C:\Users\himan\OneDrive\Desktop\guardians_of_mandi
copy .env.example .env
npm install
npm run dev
```

Then open [http://localhost:5173](http://localhost:5173).

- Frontend: port `5173` (proxies `/api` and `/socket.io` to the backend)
- Backend: port `3001`

Set `JWT_SECRET` in `.env` before sharing or deploying. Do not commit `.env`.

## Test in a clean environment

1. Install Node.js 20+.
2. Copy the repo and run the commands above.
3. Register user A in one browser (or an incognito window).
4. Register user B in a second window.
5. From A, click B in the sidebar and send messages. They should appear instantly for B.
6. Sign out and sign back in — history should still be there.

For a protocol-level check of every feature, start the server and run:

```bash
npm run smoke
```

It registers three throwaway users and exercises chat, groups, reactions, blocking, statuses, and presence over real REST + Socket.IO connections, then exits non-zero on any failure.

## Production-style run

```bash
npm run build
npm start
```

The Express server then serves `dist/` on port `3001`.

## Environment variables

| Name | Purpose |
| --- | --- |
| `PORT` | Backend port (default `3001`) |
| `JWT_SECRET` | Signing key for sessions |
| `CLIENT_ORIGIN` | Allowed frontend origin for CORS |
