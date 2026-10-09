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

const server = http.createServer(app);
const io = new Server(server, {
  cors: { origin: CLIENT_ORIGIN, methods: ["GET", "POST"] },
});

initChatSocket(io);

server.listen(PORT, () => {
  console.log(`Server listening on http://localhost:${PORT}`);
});
