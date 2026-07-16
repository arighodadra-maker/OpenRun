import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

/**
 * Handles the redirect after a user clicks the email confirmation / magic link.
 * Exchanges the code for a session, then sends them home.
 */
export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");
  const next = searchParams.get("next") ?? "/";

  if (code) {
    const supabase = createClient();
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) {
      return NextResponse.redirect(`${origin}${next}`);
    }
  }

  return NextResponse.redirect(`${origin}/login?error=Could not sign you in`);
}
