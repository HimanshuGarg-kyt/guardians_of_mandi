// Minimal in-memory fixed-window rate limiter (no external dependency).
const attempts = new Map();

export function rateLimit({ windowMs = 15 * 60 * 1000, max = 60 } = {}) {
  return (req, res, next) => {
    const now = Date.now();

    // Opportunistic cleanup so the map cannot grow without bound.
    if (attempts.size > 5000) {
      for (const [key, entry] of attempts) {
        if (entry.resetAt <= now) attempts.delete(key);
      }
    }

    const key = req.ip || req.socket?.remoteAddress || "unknown";
    let entry = attempts.get(key);
    if (!entry || entry.resetAt <= now) {
      entry = { count: 0, resetAt: now + windowMs };
      attempts.set(key, entry);
    }

    entry.count += 1;
    if (entry.count > max) {
      res.set("Retry-After", String(Math.ceil((entry.resetAt - now) / 1000)));
      return res.status(429).json({ error: "Too many attempts. Please try again later." });
    }

    next();
  };
}
