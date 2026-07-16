"use client";

import Link from "next/link";

/** Shared auth-screen shell + form field, used by login, signup, and profile. */
export function AuthShell({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <main className="min-h-screen flex flex-col items-center justify-center px-4">
      <div className="w-full max-w-sm">
        <Link href="/" className="flex items-center gap-2 mb-6 justify-center">
          <div className="w-7 h-7 rounded-full bg-court flex items-center justify-center text-black font-black">
            ▲
          </div>
          <span className="font-bold tracking-tight">OpenRun</span>
        </Link>
        <div className="rounded-xl border border-neutral-800 bg-neutral-950 p-6">
          <h1 className="text-lg font-semibold mb-4">{title}</h1>
          {children}
        </div>
      </div>
    </main>
  );
}

export function Field({
  label,
  value,
  onChange,
  type,
  placeholder,
  required,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  type: string;
  placeholder?: string;
  required?: boolean;
}) {
  return (
    <label className="block">
      <span className="text-xs text-neutral-400">{label}</span>
      <input
        type={type}
        value={value}
        placeholder={placeholder}
        required={required}
        onChange={(e) => onChange(e.target.value)}
        className="mt-1 w-full rounded bg-neutral-900 border border-neutral-800 px-3 py-2 text-sm outline-none focus:border-court"
      />
    </label>
  );
}

export function NotConfigured() {
  return (
    <AuthShell title="Sign-up not set up yet">
      <p className="text-sm text-neutral-300">
        Supabase keys haven&apos;t been added yet, so accounts aren&apos;t live. Add
        <code className="text-court"> NEXT_PUBLIC_SUPABASE_URL</code> and
        <code className="text-court"> NEXT_PUBLIC_SUPABASE_ANON_KEY</code> to
        <code> .env.local</code> and restart the server.
      </p>
      <Link href="/" className="mt-4 inline-block text-sm text-court hover:underline">← Back to map</Link>
    </AuthShell>
  );
}
