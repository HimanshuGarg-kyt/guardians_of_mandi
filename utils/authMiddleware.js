import jwt from "jsonwebtoken";

export function signToken(user) {
  return jwt.sign(
    { id: user.id, username: user.username },
    process.env.JWT_SECRET,
    { expiresIn: "7d" }
  );
}

export function authMiddleware(req, res, next) {
  const header = req.headers.authorization || "";
  const token = header.startsWith("Bearer ") ? header.slice(7) : null;

  if (!token) {
    return res.status(401).json({ error: "Authentication required" });
  }

  try {
    req.user = jwt.verify(token, process.env.JWT_SECRET);
    next();
  } catch {
    return res.status(401).json({ error: "Invalid or expired session" });
  }
}

export function socketAuth(socket, next) {
  const token = socket.handshake.auth?.token || socket.handshake.query?.token;
  if (!token) {
    return next(new Error("Authentication required"));
  }

  try {
    socket.user = jwt.verify(token, process.env.JWT_SECRET);
    next();
  } catch {
    next(new Error("Invalid or expired session"));
  }
}
