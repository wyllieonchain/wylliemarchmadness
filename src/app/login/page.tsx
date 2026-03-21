"use client";

import { useState, useEffect, useRef, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

type View = 'login' | 'signup' | 'forgot' | 'reset';

export default function LoginPage() {
  return (
    <Suspense>
      <LoginForm />
    </Suspense>
  );
}

function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const supabase = createClient();

  const code = searchParams.get('code');
  const isReset = searchParams.get('reset') === '1';
  const urlError = searchParams.get('error_description');
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [view, setView] = useState<View>(isReset ? 'reset' : (code ? 'reset' : (urlError ? 'forgot' : 'login')));
  const [loading, setLoading] = useState(false);
  const [authenticating, setAuthenticating] = useState(!!code);
  const [error, setError] = useState<string | null>(urlError ? 'Reset link expired. Request a new one below.' : null);
  const [message, setMessage] = useState<string | null>(null);
  const isRecoveryRef = useRef(!!code || isReset);

  useEffect(() => {
    // If there's a code param (from password reset email), exchange it for a session
    if (code) {
      supabase.auth.exchangeCodeForSession(code).then(({ error }) => {
        setAuthenticating(false);
        if (error) {
          setError('Reset link expired or already used. Try again.');
          setView('forgot');
          isRecoveryRef.current = false;
        } else {
          setView('reset');
        }
      });
    }

    if (window.location.hash.includes('access_token')) {
      setAuthenticating(true);
    }
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event) => {
      if (event === 'PASSWORD_RECOVERY') {
        isRecoveryRef.current = true;
        setAuthenticating(false);
        setView('reset');
      } else if (event === 'SIGNED_IN' && !isRecoveryRef.current) {
        router.push('/picks');
      }
    });
    return () => subscription.unsubscribe();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function handleResetPassword() {
    setLoading(true);
    setError(null);
    const { error } = await supabase.auth.updateUser({ password });
    if (error) {
      setError(error.message);
    } else {
      router.push('/picks');
    }
    setLoading(false);
  }

  async function handleForgotPassword() {
    setLoading(true);
    setError(null);
    setMessage(null);
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/login`,
    });
    if (error) {
      setError(error.message);
    } else {
      setMessage("Check your email for a password reset link.");
    }
    setLoading(false);
  }

  async function handleSubmit() {
    setLoading(true);
    setError(null);
    setMessage(null);

    if (view === 'signup') {
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
        if (signInError.message.includes('Invalid login credentials')) {
          setError("Invalid email or password.");
        } else {
          setError(signInError.message);
        }
      }
    }
    setLoading(false);
  }

  function switchView(newView: View) {
    setView(newView);
    setError(null);
    setMessage(null);
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
          {/* Reset password (from email link) */}
          {view === 'reset' && (
            <>
              <p className="text-sm text-white text-center">Set your new password</p>
              <div>
                <label htmlFor="new-password" className="block text-xs font-medium text-[#9b8ab8] mb-2 uppercase tracking-wider">
                  New Password
                </label>
                <input
                  id="new-password"
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  onKeyDown={(e) => { if (e.key === 'Enter' && password) handleResetPassword(); }}
                  placeholder="••••••••"
                  className="w-full glass-card-sm px-4 py-3.5 text-white placeholder-[#6b5a8a] text-sm focus:outline-none focus:ring-2 focus:ring-[#7c3aed]/30 transition-all"
                />
              </div>
              {error && (
                <p className="text-sm text-red bg-red/10 rounded-xl px-4 py-3 border border-red/20">{error}</p>
              )}
              <button
                onClick={handleResetPassword}
                disabled={loading || !password}
                className="w-full rounded-xl bg-[#7c3aed] hover:bg-[#6d28d9] text-white font-semibold py-3.5 text-sm transition-all disabled:opacity-30 disabled:cursor-not-allowed"
              >
                {loading ? "..." : "Update Password"}
              </button>
            </>
          )}

          {/* Signing in spinner */}
          {authenticating && view !== 'reset' && (
            <div className="text-center py-8">
              <div className="animate-spin w-8 h-8 border-2 border-[#7c3aed] border-t-transparent rounded-full mx-auto mb-4" />
              <p className="text-sm text-white/80">Signing you in...</p>
            </div>
          )}

          {/* Forgot password form */}
          {!authenticating && view === 'forgot' && (
            <>
              <p className="text-sm text-white text-center">Enter your email to reset your password</p>
              <div>
                <label htmlFor="email" className="block text-xs font-medium text-[#9b8ab8] mb-2 uppercase tracking-wider">
                  Email
                </label>
                <input
                  id="email"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  onKeyDown={(e) => { if (e.key === 'Enter' && email) handleForgotPassword(); }}
                  placeholder="you@example.com"
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
                onClick={handleForgotPassword}
                disabled={loading || !email}
                className="w-full rounded-xl bg-[#7c3aed] hover:bg-[#6d28d9] text-white font-semibold py-3.5 text-sm transition-all disabled:opacity-30 disabled:cursor-not-allowed"
              >
                {loading ? "..." : "Send Reset Link"}
              </button>
              <button
                onClick={() => switchView('login')}
                className="w-full text-center text-xs text-[#9b8ab8] hover:text-white transition-colors"
              >
                Back to sign in
              </button>
            </>
          )}

          {/* Login / Signup form */}
          {!authenticating && (view === 'login' || view === 'signup') && <>
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
            {loading ? "..." : view === 'signup' ? "Create Account" : "Sign In"}
          </button>

          {view === 'login' && (
            <button
              onClick={() => switchView('forgot')}
              className="w-full text-center text-xs text-[#9b8ab8] hover:text-white transition-colors"
            >
              Forgot password?
            </button>
          )}

          <button
            onClick={() => switchView(view === 'signup' ? 'login' : 'signup')}
            className="w-full text-center text-xs text-[#9b8ab8] hover:text-white transition-colors"
          >
            {view === 'signup' ? "Already have an account? Sign in" : "New here? Create account"}
          </button>
          </>}
        </div>
      </div>
    </div>
  );
}
