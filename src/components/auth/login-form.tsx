"use client";

import { createClient } from "@/lib/supabase/client";
import { formatAuthError } from "@/lib/auth/auth-errors";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useRouter, useSearchParams } from "next/navigation";
import { useState } from "react";

export function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const next = searchParams.get("next") ?? "/";
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<{
    text: string;
    type: "error" | "success";
  } | null>(null);
  const [mode, setMode] = useState<"signin" | "signup">("signin");

  async function handleSubmit(e: React.FormEvent) {
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
    } else if (mode === "signup") {
      setMessage({
        text: "Account created. You can sign in now.",
        type: "success",
      });
      setMode("signin");
    } else {
      router.push(next);
      router.refresh();
    }

    setLoading(false);
  }

  return (
    <Card className="w-full max-w-md">
      <CardHeader>
        <CardTitle>D&amp;D Campaign Manager</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="candy-btn-row login-form-mode-row">
          <button
            type="button"
            className={`candy-btn${mode === "signin" ? " candy-btn-active" : ""}`}
            onClick={() => {
              setMode("signin");
              setMessage(null);
            }}
          >
            Log in
          </button>
          <button
            type="button"
            className={`candy-btn${mode === "signup" ? " candy-btn-active" : ""}`}
            onClick={() => {
              setMode("signup");
              setMessage(null);
            }}
          >
            Sign up
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4 login-form-fields">
          <div className="space-y-2">
            <Label htmlFor="email">Email</Label>
            <Input
              id="email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="password">Password</Label>
            <Input
              id="password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              minLength={6}
            />
          </div>
          {message ? (
            <p
              className={
                message.type === "success"
                  ? "login-form-message-success"
                  : "login-form-message-error"
              }
            >
              {message.text}
            </p>
          ) : null}
          <Button type="submit" className="w-full" disabled={loading}>
            {loading ? "..." : mode === "signin" ? "Log in" : "Sign up"}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}
