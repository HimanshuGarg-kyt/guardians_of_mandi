import { useState } from "react";

export default function Login({ onAuth, initialError = "", onInteract }) {
  const [mode, setMode] = useState("login");
  const [username, setUsername] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(event) {
    event.preventDefault();
    setError("");
    onInteract?.();
    setLoading(true);

    try {
      const path = mode === "login" ? "/api/auth/login" : "/api/auth/register";
      const response = await fetch(path, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username, password, displayName }),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data.error || "Could not continue");
      onAuth(data);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="auth-shell">
      <div className="auth-card">
        <p className="eyebrow">Kamand · IIT Mandi</p>
        <h1>Guardians of Mandi</h1>
        <p className="lede">
          Real-time campus chat. Sign in to start a one-to-one conversation.
        </p>

        <div className="tabs">
          <button
            className={mode === "login" ? "active" : ""}
            type="button"
            onClick={() => setMode("login")}
          >
            Sign in
          </button>
          <button
            className={mode === "register" ? "active" : ""}
            type="button"
            onClick={() => setMode("register")}
          >
            Create account
          </button>
        </div>

        <form onSubmit={handleSubmit}>
          <label>
            Username
            <input
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              autoComplete="username"
              required
            />
          </label>
          {mode === "register" && (
            <label>
              Display name
              <input
                value={displayName}
                onChange={(e) => setDisplayName(e.target.value)}
                placeholder="How others see you"
              />
            </label>
          )}
          <label>
            Password
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              autoComplete={mode === "login" ? "current-password" : "new-password"}
              required
            />
          </label>
          {(error || initialError) && <p className="error">{error || initialError}</p>}
          <button className="primary" type="submit" disabled={loading}>
            {loading ? "Please wait…" : mode === "login" ? "Enter chat" : "Join campus"}
          </button>
        </form>
      </div>
    </div>
  );
}
