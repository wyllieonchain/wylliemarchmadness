"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

export default function LoginPage() {
  const router = useRouter();
  const supabase = createClient();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [isSignUp, setIsSignUp] = useState(false);
  const [loading, setLoading] = useState(false);
  const [authenticating, setAuthenticating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

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

  async function handleSubmit() {
    setLoading(true);
    setError(null);
    setMessage(null);

    if (isSignUp) {
      const { error: signUpError } = await supabase.auth.signUp({
        email,
        password,
      });
      if (signUpError) {
        setError(signUpError.message);
      } else {
        setMessage("Account created! You're being signed in...");
      }
    } else {
      const { error: signInError } = await supabase.auth.signInWithPassword({
        email,
        password,
      });
      if (signInError) {
        // If they have no password (old magic link user), suggest signing up
        if (signInError.message.includes('Invalid login credentials')) {
          setError("Invalid email or password. If you signed up with a magic link before, click 'Create account' and use the same email to set a password.");
        } else {
          setError(signInError.message);
        }
      }
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

        <div className="glass-card p-7 space-y-5">
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
              placeholder="you@example.com"
              className="w-full glass-card-sm px-4 py-3.5 text-white placeholder-[#6b5a8a] text-sm focus:outline-none focus:ring-2 focus:ring-[#7c3aed]/30 transition-all"
            />
          </div>

          <div>
            <label htmlFor="password" className="block text-xs font-medium text-[#9b8ab8] mb-2 uppercase tracking-wider">
              Password
            </label>
            <input
              id="password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter' && email && password) handleSubmit(); }}
              placeholder="••••••••"
              className="w-full glass-card-sm px-4 py-3.5 text-white placeholder-[#6b5a8a] text-sm focus:outline-none focus:ring-2 focus:ring-[#7c3aed]/30 transition-all"
            />
          </div>

          {error && (
            <p className="text-sm text-red bg-red/10 rounded-xl px-4 py-3 border border-red/20">{error}</p>
          )}

          {message && (
            <p className="text-sm text-green bg-green/10 rounded-xl px-4 py-3 border border-green/20">{message}</p>
          )}

          <button
            onClick={handleSubmit}
            disabled={loading || !email || !password}
            className="w-full rounded-xl bg-[#7c3aed] hover:bg-[#6d28d9] text-white font-semibold py-3.5 text-sm transition-all disabled:opacity-30 disabled:cursor-not-allowed"
          >
            {loading ? "..." : isSignUp ? "Create Account" : "Sign In"}
          </button>

          <button
            onClick={() => { setIsSignUp(!isSignUp); setError(null); setMessage(null); }}
            className="w-full text-center text-xs text-[#9b8ab8] hover:text-white transition-colors"
          >
            {isSignUp ? "Already have an account? Sign in" : "New here? Create account"}
          </button>
          </>}
        </div>
      </div>
    </div>
  );
}
