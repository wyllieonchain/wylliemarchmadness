'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { createBrowserClient } from '@supabase/ssr';
import { useUser, useProfile } from '@/lib/hooks';

export default function SettingsPage() {
  const router = useRouter();
  const { user } = useUser();
  const { profile, loading: profileLoading } = useProfile(user?.id);
  const [displayName, setDisplayName] = useState('');
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [loggingOut, setLoggingOut] = useState(false);

  const supabase = createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );

  useEffect(() => {
    if (profile?.display_name) {
      setDisplayName(profile.display_name);
    }
  }, [profile]);

  const handleSave = async () => {
    if (!user || !displayName.trim()) return;
    setSaving(true);
    setSaved(false);

    const { error } = await supabase
      .from('profiles')
      .update({ display_name: displayName.trim() })
      .eq('id', user.id);

    if (error) {
      console.error('Error updating display name:', error);
      alert('Failed to update display name. Please try again.');
    } else {
      setSaved(true);
      setTimeout(() => setSaved(false), 3000);
    }
    setSaving(false);
  };

  const handleLogout = async () => {
    setLoggingOut(true);
    await supabase.auth.signOut();
    router.push('/login');
  };

  if (profileLoading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="animate-pulse text-[#9b8ab8]">Loading settings...</div>
      </div>
    );
  }

  return (
    <div className="max-w-lg mx-auto space-y-6">
      <h1 className="text-2xl font-bold text-white">Settings</h1>

      {/* Display Name */}
      <div className="glass-card p-6">
        <h2 className="text-xs font-medium text-[#9b8ab8] uppercase tracking-wider mb-5">
          Display Name
        </h2>
        <div className="space-y-4">
          <input
            type="text"
            value={displayName}
            onChange={e => setDisplayName(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter') handleSave(); }}
            placeholder="Enter your display name"
            maxLength={30}
            className="w-full glass-card-sm px-4 py-3.5 text-sm text-white placeholder:text-[#6b5a8a] focus:outline-none focus:ring-2 focus:ring-[#7c3aed]/30 transition-all"
          />
          <div className="flex items-center justify-between">
            <span className="text-xs text-[#6b5a8a]">
              {displayName.length}/30 characters
            </span>
            {saved && (
              <span className="text-xs text-green font-medium">Saved!</span>
            )}
          </div>
          <button
            onClick={handleSave}
            disabled={saving || !displayName.trim() || displayName === profile?.display_name}
            className={`w-full py-3.5 rounded-xl text-sm font-semibold transition-all ${
              !saving && displayName.trim() && displayName !== profile?.display_name
                ? 'bg-[#7c3aed] hover:bg-[#6d28d9] text-white'
                : 'bg-white/[0.04] text-[#6b5a8a] cursor-not-allowed'
            }`}
          >
            {saving ? 'Saving...' : 'Save'}
          </button>
        </div>
      </div>

      {/* Account */}
      <div className="glass-card p-6">
        <h2 className="text-xs font-medium text-[#9b8ab8] uppercase tracking-wider mb-5">
          Account
        </h2>
        {user && (
          <p className="text-sm text-[#9b8ab8] mb-4 truncate">{user.email}</p>
        )}
        <button
          onClick={handleLogout}
          disabled={loggingOut}
          className="w-full py-3.5 rounded-xl text-sm font-semibold border border-red/20 text-red hover:bg-red/[0.06] transition-all"
        >
          {loggingOut ? 'Logging out...' : 'Log Out'}
        </button>
      </div>
    </div>
  );
}
