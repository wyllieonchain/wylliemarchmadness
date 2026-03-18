"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

export default function SetNamePage() {
  const router = useRouter();
  const supabase = createClient();

  const [displayName, setDisplayName] = useState("");
  const [loading, setLoading] = useState(false);
  const [checking, setChecking] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function checkProfile() {
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) {
        router.push("/login");
        return;
      }

      const { data: profile } = await supabase
        .from("profiles")
        .select("display_name")
        .eq("id", user.id)
        .single();

      if (profile?.display_name) {
        router.push("/picks");
        return;
      }

      setChecking(false);
    }

    checkProfile();
  }, [router, supabase]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);

    const trimmed = displayName.trim();
    if (!trimmed) {
      setError("Please enter a display name.");
      setLoading(false);
      return;
    }

    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      router.push("/login");
      return;
    }

    const { error: upsertError } = await supabase
      .from("profiles")
      .upsert({ id: user.id, display_name: trimmed });

    if (upsertError) {
      setError(upsertError.message);
      setLoading(false);
      return;
    }

    router.push("/picks");
  }

  if (checking) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-[#9b8ab8] text-sm animate-pulse">Loading...</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center px-4">
      <div className="w-full max-w-sm">
        <div className="text-center mb-10">
          <div className="text-4xl mb-4">👋</div>
          <h1 className="text-2xl font-bold tracking-tight text-white mb-2">
            Welcome to the pool!
          </h1>
          <p className="text-[#9b8ab8] text-sm">
            What should we call you?
          </p>
        </div>

        <form
          onSubmit={handleSubmit}
          className="glass-card p-7 space-y-6"
        >
          <div>
            <label
              htmlFor="displayName"
              className="block text-xs font-medium text-[#9b8ab8] mb-2 uppercase tracking-wider"
            >
              Display Name
            </label>
            <input
              id="displayName"
              type="text"
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
              placeholder="e.g. Uncle Steve"
              maxLength={30}
              autoFocus
              className="w-full glass-card-sm px-4 py-3.5 text-white placeholder-[#6b5a8a] text-sm focus:outline-none focus:ring-2 focus:ring-[#7c3aed]/30 transition-all"
            />
            <p className="text-xs text-[#6b5a8a] mt-2 text-right">
              <span className={displayName.length > 25 ? "text-[#a78bfa]" : ""}>
                {displayName.length}
              </span>
              /30
            </p>
          </div>

          {error && (
            <p className="text-sm text-red bg-red/10 rounded-xl px-4 py-3 border border-red/20">
              {error}
            </p>
          )}

          <button
            type="submit"
            disabled={loading || !displayName.trim()}
            className="w-full rounded-xl bg-[#7c3aed] hover:bg-[#6d28d9] text-white font-semibold py-3.5 text-sm transition-all disabled:opacity-30 disabled:cursor-not-allowed"
          >
            {loading ? "Saving..." : "Let's Go!"}
          </button>
        </form>
      </div>
    </div>
  );
}
