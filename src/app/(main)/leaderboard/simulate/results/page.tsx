'use client';

import { useState, useEffect, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { useTeams, useGames, useAllPicks, useUser } from '@/lib/hooks';
import type { Team, Pick } from '@/types/database';
import { createBrowserClient } from '@supabase/ssr';
import type { Profile } from '@/types/database';

const rankEmojis: Record<number, string> = { 1: '🥇', 2: '🥈', 3: '🥉' };

export default function SimulateResultsPage() {
  const router = useRouter();
  const { user } = useUser();
  const { teams, loading: teamsLoading } = useTeams();
  const { games, loading: gamesLoading } = useGames();
  const { picks, loading: picksLoading } = useAllPicks();

  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [profilesLoading, setProfilesLoading] = useState(true);
  const [simulatedWinners, setSimulatedWinners] = useState<Record<number, string> | null>(null);

  const supabase = useMemo(() => createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  ), []);

  // Load profiles
  useEffect(() => {
    supabase.from('profiles').select('*').then(({ data }) => {
      setProfiles((data as Profile[]) || []);
      setProfilesLoading(false);
    });
  }, [supabase]);

  // Load simulated winners from sessionStorage
  useEffect(() => {
    try {
      const raw = sessionStorage.getItem('simulate-winners');
      if (raw) {
        const parsed = JSON.parse(raw);
        // Convert string keys to numbers
        const winners: Record<number, string> = {};
        for (const [k, v] of Object.entries(parsed)) {
          winners[Number(k)] = v as string;
        }
        setSimulatedWinners(winners);
      } else {
        router.replace('/leaderboard/simulate');
      }
    } catch {
      router.replace('/leaderboard/simulate');
    }
  }, [router]);

  const teamMap = useMemo(() => {
    const m = new Map<string, Team>();
    teams.forEach(t => m.set(t.id, t));
    return m;
  }, [teams]);

  const finalGameNumbers = useMemo(() => {
    const s = new Set<number>();
    games.forEach(g => { if (g.status === 'final') s.add(g.game_number); });
    return s;
  }, [games]);

  // Compute simulated leaderboard
  const results = useMemo(() => {
    if (!simulatedWinners || profilesLoading || picksLoading || teamsLoading || gamesLoading) return null;

    // Group picks by user
    const userPicks = new Map<string, Pick[]>();
    for (const pick of picks) {
      if (!userPicks.has(pick.user_id)) userPicks.set(pick.user_id, []);
      userPicks.get(pick.user_id)!.push(pick);
    }

    return profiles.map(profile => {
      const pickList = userPicks.get(profile.id) || [];
      let currentPoints = 0;
      let simulatedPoints = 0;

      for (const pick of pickList) {
        const isFinal = finalGameNumbers.has(pick.game_number);
        const team = teamMap.get(pick.team_id);
        const seed = team?.seed ?? 0;

        if (isFinal) {
          // Real points
          const earned = pick.points_earned && pick.points_earned > 0 ? pick.points_earned : 0;
          currentPoints += earned;
          simulatedPoints += earned;
        } else {
          // Simulated
          const simWinner = simulatedWinners[pick.game_number];
          if (simWinner && simWinner === pick.team_id) {
            simulatedPoints += seed;
          }
        }
      }

      return {
        user_id: profile.id,
        display_name: profile.display_name || 'Unknown',
        current_points: currentPoints,
        simulated_points: simulatedPoints,
        delta: simulatedPoints - currentPoints,
      };
    }).sort((a, b) => b.simulated_points - a.simulated_points || b.delta - a.delta);
  }, [simulatedWinners, profiles, picks, teamMap, finalGameNumbers, profilesLoading, picksLoading, teamsLoading, gamesLoading]);

  const loading = teamsLoading || gamesLoading || picksLoading || profilesLoading || !simulatedWinners;

  if (loading || !results) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="animate-pulse text-[#9b8ab8]">Simulating...</div>
      </div>
    );
  }

  return (
    <div className="max-w-2xl mx-auto">
      {/* Header */}
      <div className="mb-6">
        <button
          onClick={() => router.push('/leaderboard/simulate')}
          className="flex items-center gap-2 text-[#9b8ab8] hover:text-white transition-colors mb-4"
        >
          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 19.5L8.25 12l7.5-7.5" />
          </svg>
          <span className="text-sm">Edit Simulation</span>
        </button>
        <h1 className="text-2xl font-bold text-white mb-1">Simulated Leaderboard</h1>
        <p className="text-[#9b8ab8] text-sm">Based on your predicted outcomes</p>
      </div>

      {/* Results table */}
      <div className="glass-card overflow-hidden">
        {/* Header row */}
        <div className="grid grid-cols-[2.5rem_1fr_3.5rem_4rem_3rem] gap-2 px-5 py-3 border-b border-white/[0.04]">
          <span className="text-[10px] text-[#6b5a8a] font-medium uppercase tracking-wider">#</span>
          <span className="text-[10px] text-[#6b5a8a] font-medium uppercase tracking-wider">Player</span>
          <span className="text-[10px] text-[#6b5a8a] font-medium uppercase tracking-wider text-right">Now</span>
          <span className="text-[10px] text-[#6b5a8a] font-medium uppercase tracking-wider text-right">Sim</span>
          <span className="text-[10px] text-[#6b5a8a] font-medium uppercase tracking-wider text-right">+/-</span>
        </div>

        {results.map((entry, index) => {
          const isCurrentUser = user?.id === entry.user_id;
          const rank = index + 1;
          const emoji = rankEmojis[rank];

          return (
            <div
              key={entry.user_id}
              className={`grid grid-cols-[2.5rem_1fr_3.5rem_4rem_3rem] gap-2 px-5 py-4 items-center ${
                index < results.length - 1 ? 'border-b border-white/[0.04]' : ''
              } ${isCurrentUser ? 'bg-[#7c3aed]/[0.04]' : ''}`}
            >
              <span className={`text-sm font-mono tabular-nums ${emoji ? 'text-lg' : rank <= 3 ? 'text-[#a78bfa] font-bold' : 'text-[#6b5a8a]'}`}>
                {emoji || rank}
              </span>
              <div className="flex items-center gap-2 min-w-0">
                <span className={`text-sm truncate ${isCurrentUser ? 'font-medium text-[#a78bfa]' : ''}`}>
                  {entry.display_name}
                </span>
                {isCurrentUser && (
                  <span className="shrink-0 text-[10px] bg-[#7c3aed]/20 text-[#a78bfa] px-1.5 py-0.5 rounded-full font-medium">
                    YOU
                  </span>
                )}
              </div>
              <span className="text-sm font-mono tabular-nums text-right text-[#6b5a8a]">
                {entry.current_points}
              </span>
              <span className="text-sm font-mono tabular-nums text-right font-bold">
                {entry.simulated_points}
              </span>
              <span className={`text-sm font-mono tabular-nums text-right ${entry.delta > 0 ? 'text-green' : 'text-[#6b5a8a]'}`}>
                {entry.delta > 0 ? `+${entry.delta}` : entry.delta}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
