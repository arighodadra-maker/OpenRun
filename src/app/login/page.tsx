"use client";

import Link from "next/link";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { isSupabaseConfigured } from "@/lib/supabase/config";
import { AuthShell, Field, NotConfigured } from "@/components/AuthUI";

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);

    const supabase = createClient();
    const { error } = await supabase.auth.signInWithPassword({ email, password });

    if (error) {
      setError(error.message);
      setLoading(false);
      return;
    }
    router.push("/");
    router.refresh();
  }

  if (!isSupabaseConfigured) return <NotConfigured />;

  return (
    <AuthShell title="Log in">
      <form onSubmit={handleSubmit} className="space-y-3">
        <Field label="Email" value={email} onChange={setEmail} type="email"
          placeholder="you@example.com" required />
        <Field label="Password" value={password} onChange={setPassword} type="password"
          placeholder="your password" required />

        {error && <p className="text-sm text-red-400">{error}</p>}

        <button
          type="submit"
          disabled={loading}
          className="w-full py-2.5 rounded bg-court text-black font-semibold hover:opacity-90 disabled:opacity-50"
        >
          {loading ? "Logging in…" : "Log in"}
        </button>
      </form>
      <p className="mt-4 text-sm text-neutral-400">
        New here?{" "}
        <Link href="/signup" className="text-court hover:underline">Create an account</Link>
      </p>
    </AuthShell>
  );
}
