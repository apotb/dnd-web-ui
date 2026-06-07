import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function POST(request: Request) {
  const { password } = (await request.json()) as { password?: string };

  const dmEmail = process.env.DM_EMAIL?.trim();

  if (!dmEmail) {
    return NextResponse.json(
      { error: "DM_EMAIL is not set in .env.local on the server." },
      { status: 500 }
    );
  }

  if (!password) {
    return NextResponse.json({ error: "Enter your password." }, { status: 400 });
  }

  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithPassword({
    email: dmEmail,
    password,
  });

  if (error) {
    return NextResponse.json(
      {
        error:
          error.message === "Invalid login credentials"
            ? "Wrong password. Use the same password as your Supabase user."
            : error.message,
      },
      { status: 401 }
    );
  }

  return NextResponse.json({ ok: true });
}
