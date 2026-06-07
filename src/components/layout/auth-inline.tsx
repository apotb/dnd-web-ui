"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { formatAuthError } from "@/lib/auth/auth-errors";

interface AuthInlineProps {
  userEmail: string | null;
}

export function AuthInline({ userEmail }: AuthInlineProps) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [mode, setMode] = useState<"signin" | "signup">("signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [message, setMessage] = useState<{
    text: string;
    type: "error" | "success";
  } | null>(null);
  const [loading, setLoading] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setMessage(null);

    const supabase = createClient();
    const result =
      mode === "signin"
        ? await supabase.auth.signInWithPassword({ email, password })
        : await supabase.auth.signUp({ email, password });

    if (result.error) {
      setMessage({ text: formatAuthError(result.error.message), type: "error" });
      setLoading(false);
      return;
    }

    if (mode === "signup") {
      setMessage({
        text: "Account created. Click again to sign in.",
        type: "success",
      });
      setMode("signin");
      setOpen(false);
      setLoading(false);
      return;
    }

    setEmail("");
    setPassword("");
    setOpen(false);
    router.refresh();
    setLoading(false);
  }

  async function logout() {
    const supabase = createClient();
    await supabase.auth.signOut();
    router.refresh();
  }

  function closeForm() {
    setOpen(false);
    setEmail("");
    setPassword("");
    setMessage(null);
  }

  function openForm(nextMode: "signin" | "signup") {
    setMode(nextMode);
    setOpen(true);
    setMessage(null);
  }

  function dismissMessage() {
    const reopenSignIn = message?.type === "success";
    setMessage(null);
    if (reopenSignIn) {
      openForm("signin");
    }
  }

  if (userEmail) {
    return (
      <div className="retro-header-aside">
        <span className="retro-header-user">{userEmail}</span>
        <button type="button" className="retro-inline-link" onClick={logout}>
          Log out
        </button>
      </div>
    );
  }

  if (message) {
    return (
      <div className="retro-header-aside retro-header-aside-message">
        <button
          type="button"
          className={`retro-inline-link retro-inline-message-link${
            message.type === "success"
              ? " retro-inline-success-link"
              : " retro-inline-error-link"
          }`}
          onClick={dismissMessage}
        >
          {message.text}
        </button>
      </div>
    );
  }

  if (open) {
    return (
      <div className="retro-header-aside">
        <div className="retro-inline-login-wrap">
          <form className="retro-inline-login" onSubmit={submit}>
            <button type="button" className="retro-inline-btn" onClick={closeForm}>
              ←
            </button>
            <input
              type="email"
              className="retro-inline-input retro-inline-input-email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="Email"
              autoFocus
              autoComplete="email"
              required
            />
            <input
              type="password"
              className="retro-inline-input"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Password"
              autoComplete={mode === "signin" ? "current-password" : "new-password"}
              minLength={6}
              required
            />
            <button
              type="submit"
              className="retro-inline-btn"
              disabled={loading || !email || !password}
            >
              {loading ? "…" : mode === "signup" ? "+" : "→"}
            </button>
          </form>
        </div>
      </div>
    );
  }

  return (
    <div className="retro-header-aside retro-header-auth-links">
      <button
        type="button"
        className="retro-inline-link"
        onClick={() => openForm("signin")}
      >
        Log in
      </button>
      <button
        type="button"
        className="retro-inline-link"
        onClick={() => openForm("signup")}
      >
        Sign up
      </button>
    </div>
  );
}
