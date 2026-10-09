import "dotenv/config";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import http from "http";
import express from "express";
import cors from "cors";
import { Server } from "socket.io";
import { initDb } from "./config/db.js";
import authRoutes from "./routes/auth.js";
import userRoutes from "./routes/users.js";
import conversationRoutes from "./routes/conversations.js";
import { initChatSocket } from "./socket/chat.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PORT = Number(process.env.PORT || 3001);
const CLIENT_ORIGIN = process.env.CLIENT_ORIGIN || "http://localhost:5173";

if (!process.env.JWT_SECRET) {
  if (process.env.NODE_ENV === "production") {
    console.error(
      "JWT_SECRET must be set when NODE_ENV=production. Refusing to start with an insecure default."
    );
    process.exit(1);
  }
  process.env.JWT_SECRET = "dev-only-change-me";
  console.warn("JWT_SECRET is not set. Using a local development default.");
}

await initDb();

const app = express();
app.use(cors({ origin: CLIENT_ORIGIN, credentials: true }));
app.use(express.json({ limit: "1mb" }));

app.get("/api/health", (_req, res) => {
  res.json({ ok: true, name: "Guardians of Mandi" });
});

app.use("/api/auth", authRoutes);
app.use("/api/users", userRoutes);
app.use("/api/conversations", conversationRoutes);

// Serve a real robots.txt (and 404 the favicon) instead of letting the SPA
// fallback answer them with index.html, which Lighthouse flags as invalid.
app.get("/robots.txt", (_req, res) => {
  res.type("text/plain").send("User-agent: *\nAllow: /\n");
});
app.get("/favicon.ico", (_req, res) => {
  res.status(404).end();
});

const distDir = path.join(__dirname, "dist");
if (fs.existsSync(distDir)) {
  app.use(express.static(distDir));
  app.get("*", (req, res, next) => {
    if (req.path.startsWith("/api") || req.path.startsWith("/socket.io")) {
      return next();
    }
    res.sendFile(path.join(distDir, "index.html"));
  });
}

// Centralized error handler: log the stack server-side, never leak it to
// clients (Express' default handler returns the stack in development mode).
// eslint-disable-next-line no-unused-vars
app.use((err, _req, res, _next) => {
  const status = err.status || err.statusCode || 500;
  if (status >= 500) console.error(err);
  if (res.headersSent) return;
  // Client errors (e.g. malformed JSON) have safe messages; 5xx details stay
  // server-side so stack traces and paths never reach the client.
  res
    .status(status)
    .json({ error: status < 500 ? err.message : "Internal server error" });
});

const server = http.createServer(app);
const io = new Server(server, {
  cors: { origin: CLIENT_ORIGIN, methods: ["GET", "POST"] },
});

initChatSocket(io);

server.listen(PORT, () => {
  console.log(`Server listening on http://localhost:${PORT}`);
});
