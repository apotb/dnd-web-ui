"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

interface DmLoginInlineProps {
  isDm: boolean;
}

export function DmLoginInline({ isDm }: DmLoginInlineProps) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function login() {
    if (!password) return;
    setLoading(true);

    const res = await fetch("/api/dm/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "same-origin",
      body: JSON.stringify({ password }),
    });

    if (!res.ok) {
      setError("Wrong password");
      setOpen(false);
      setPassword("");
      setLoading(false);
      return;
    }

    setPassword("");
    setOpen(false);
    setError(null);
    router.refresh();
    setLoading(false);
  }

  async function logout() {
    await fetch("/api/dm/logout", { method: "POST" });
    router.refresh();
  }

  function closeForm() {
    setOpen(false);
    setPassword("");
    setError(null);
  }

  function dismissError() {
    setError(null);
    setOpen(false);
  }

  const showForm = open && !error;

  return (
    <div
      className={`retro-header-aside${showForm && !isDm ? " retro-header-aside-open" : ""}`}
    >
      {isDm ? (
        <button type="button" className="retro-inline-link" onClick={logout}>
          Log out
        </button>
      ) : error ? (
        <button
          type="button"
          className="retro-inline-link retro-inline-error-link"
          onClick={dismissError}
        >
          {error}
        </button>
      ) : !showForm ? (
        <button
          type="button"
          className="retro-inline-link"
          onClick={() => setOpen(true)}
        >
          DM Login
        </button>
      ) : (
        <div className="retro-inline-login-wrap">
          <form
            className="retro-inline-login"
            onSubmit={(e) => {
              e.preventDefault();
              login();
            }}
          >
            <button type="button" className="retro-inline-btn" onClick={closeForm}>
              ←
            </button>
            <input
              type="password"
              className="retro-inline-input"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              autoFocus
              autoComplete="current-password"
            />
            <button
              type="submit"
              className="retro-inline-btn"
              disabled={loading || !password}
            >
              {loading ? "…" : "→"}
            </button>
          </form>
        </div>
      )}
    </div>
  );
}
