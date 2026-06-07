import { Suspense } from "react";
import { LoginForm } from "@/components/auth/login-form";
import { RetroShell } from "@/components/layout/retro-shell";

export default function LoginPage() {
  return (
    <RetroShell>
      <h2 className="page-title">Log in</h2>
      <p className="retro-note">
        Sign in or create an account to claim and edit your character sheet.
      </p>
      <Suspense fallback={null}>
        <LoginForm />
      </Suspense>
    </RetroShell>
  );
}
