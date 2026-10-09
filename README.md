# Guardians of Mandi

Real-time campus chat for **First Commit — Kamand Prompt, IIT Mandi**.

The app covers the mandatory core (registration, login/logout, sessions, one-to-one realtime chat) plus persistence, online status, typing indicators, read receipts, and in-chat search.

## Architecture

- **Frontend:** React + Vite (`src/`)
- **Backend:** Node.js + Express (`server.js`, `routes/`)
- **Realtime:** Socket.IO (`socket/chat.js`)
- **Database:** SQLite via `sql.js`, schema in `database/schema.sql`, file stored at `data/chat.db`
- **Auth:** JWT in `Authorization: Bearer` for REST, and `socket.handshake.auth.token` for WebSockets

Clients talk to REST for auth, user lists, conversations, and history. Live messages, typing, presence, and read receipts go over Socket.IO.

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
