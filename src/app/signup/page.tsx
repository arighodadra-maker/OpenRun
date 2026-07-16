"use client";

import Link from "next/link";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { isSupabaseConfigured } from "@/lib/supabase/config";
import { AuthShell, Field, NotConfigured } from "@/components/AuthUI";

export default function SignUpPage() {
  const router = useRouter();
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [age, setAge] = useState("");
  const [experience, setExperience] = useState("");
  const [status, setStatus] = useState<"idle" | "loading" | "check-email">("idle");
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setStatus("loading");

    const supabase = createClient();
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: { full_name: fullName },
        emailRedirectTo: `${window.location.origin}/auth/callback`,
      },
    });

    if (error) {
      setError(error.message);
      setStatus("idle");
      return;
    }

    // If email confirmation is on, there's no session yet — tell them to check email.
    if (data.session && data.user) {
      // Save the starter info onto the auto-created profile row.
      await supabase
        .from("profiles")
        .update({
          age: age ? Number(age) : null,
          years_experience: experience ? Number(experience) : null,
        })
        .eq("id", data.user.id);
      router.push("/");
      router.refresh();
    } else {
      setStatus("check-email");
    }
  }

  if (!isSupabaseConfigured) return <NotConfigured />;

  if (status === "check-email") {
    return (
      <AuthShell title="Almost there">
        <p className="text-sm text-neutral-300">
          We sent a confirmation link to <span className="text-court">{email}</span>. Click it to
          finish creating your account, then come back and log in.
        </p>
        <Link href="/login" className="mt-4 inline-block text-sm text-court hover:underline">
          Go to log in →
        </Link>
      </AuthShell>
    );
  }

  return (
    <AuthShell title="Create your account">
      <form onSubmit={handleSubmit} className="space-y-3">
        <Field label="Display name" value={fullName} onChange={setFullName} type="text"
          placeholder="e.g. Alex" required />
        <Field label="Email" value={email} onChange={setEmail} type="email"
          placeholder="you@example.com" required />
        <Field label="Password" value={password} onChange={setPassword} type="password"
          placeholder="at least 6 characters" required />
        <div className="grid grid-cols-2 gap-3">
          <Field label="Age" value={age} onChange={setAge} type="number" placeholder="e.g. 17" />
          <Field label="Years playing" value={experience} onChange={setExperience} type="number"
            placeholder="e.g. 5" />
        </div>

        {error && <p className="text-sm text-red-400">{error}</p>}

        <button
          type="submit"
          disabled={status === "loading"}
          className="w-full py-2.5 rounded bg-court text-black font-semibold hover:opacity-90 disabled:opacity-50"
        >
          {status === "loading" ? "Creating…" : "Sign up"}
        </button>
      </form>
      <p className="mt-4 text-sm text-neutral-400">
        Already have an account?{" "}
        <Link href="/login" className="text-court hover:underline">Log in</Link>
      </p>
    </AuthShell>
  );
}
