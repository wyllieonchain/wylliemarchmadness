"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

export default function LoginPage() {
  const router = useRouter();
  const supabase = createClient();

  const [email, setEmail] = useState("");
  const [codeSent, setCodeSent] = useState(false);
  const [loading, setLoading] = useState(false);
  const [authenticating, setAuthenticating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (window.location.hash.includes('access_token')) {
      setAuthenticating(true);
    }
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event) => {
      if (event === 'SIGNED_IN') {
        router.push('/picks');
      }
    });
    return () => subscription.unsubscribe();
  }, [supabase, router]);

  async function handleSendCode() {
    setLoading(true);
    setError(null);
    const { error: otpError } = await supabase.auth.signInWithOtp({ email });
    if (otpError) {
      setError(otpError.message);
    } else {
      setCodeSent(true);
    }
    setLoading(false);
  }

  return (
    <div className="min-h-screen flex items-center justify-center px-4">
      <div className="w-full max-w-sm">
        <div className="text-center mb-10">
          <img src="/w.png" alt="W" className="w-16 h-16 object-contain mx-auto mb-5" />
          <h1 className="text-2xl font-bold tracking-tight text-white mb-2">
            WYLLIE MARCH MADNESS
          </h1>
          <p className="text-[#9b8ab8] text-sm">
            Family bracket pool
          </p>
        </div>

        <div className="glass-card p-7 space-y-6">
          {authenticating && (
            <div className="text-center py-8">
              <div className="animate-spin w-8 h-8 border-2 border-[#7c3aed] border-t-transparent rounded-full mx-auto mb-4" />
              <p className="text-sm text-white/80">Signing you in...</p>
            </div>
          )}

          {!authenticating && <>
          <div>
            <label htmlFor="email" className="block text-xs font-medium text-[#9b8ab8] mb-2 uppercase tracking-wider">
              Email
            </label>
            <input
              id="email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter' && email && !codeSent) handleSendCode(); }}
              placeholder="you@example.com"
              disabled={codeSent}
              className="w-full glass-card-sm px-4 py-3.5 text-white placeholder-[#6b5a8a] text-sm focus:outline-none focus:ring-2 focus:ring-[#7c3aed]/30 disabled:opacity-50 transition-all"
            />
          </div>

          {codeSent && (
            <div className="text-center py-4 glass-card-sm">
              <p className="text-sm text-[#a78bfa] font-medium mb-1">Check your email</p>
              <p className="text-xs text-[#9b8ab8]">
                Magic link sent to <span className="text-white/90">{email}</span>
              </p>
            </div>
          )}

          {error && (
            <p className="text-sm text-red bg-red/10 rounded-xl px-4 py-3 border border-red/20">{error}</p>
          )}

          {!codeSent && (
            <button
              onClick={handleSendCode}
              disabled={loading || !email}
              className="w-full rounded-xl bg-[#7c3aed] hover:bg-[#6d28d9] text-white font-semibold py-3.5 text-sm transition-all disabled:opacity-30 disabled:cursor-not-allowed"
            >
              {loading ? "Sending..." : "Send Magic Link"}
            </button>
          )}

          {codeSent && (
            <button
              onClick={() => { setCodeSent(false); setError(null); }}
              className="w-full text-center text-xs text-[#9b8ab8] hover:text-white transition-colors"
            >
              Use a different email
            </button>
          )}
          </>}
        </div>
      </div>
    </div>
  );
}
