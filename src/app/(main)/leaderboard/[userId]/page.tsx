'use client';

import { useState, useEffect, useMemo } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useTeams, useGames, useAllPicks } from '@/lib/hooks';
import type { Team, Pick, Game } from '@/types/database';
import { createBrowserClient } from '@supabase/ssr';

export default function UserPicksPage() {
  const params = useParams();
  const router = useRouter();
  const userId = params.userId as string;

  const { teams, loading: teamsLoading } = useTeams();
  const { games, loading: gamesLoading } = useGames();
  const { picks: allPicks, loading: picksLoading } = useAllPicks();

  const [displayName, setDisplayName] = useState<string | null>(null);
  const [profileLoading, setProfileLoading] = useState(true);

  const supabase = useMemo(() => createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  ), []);

  // Fetch display name
  useEffect(() => {
    supabase
      .from('profiles')
      .select('display_name')
      .eq('id', userId)
      .single()
      .then(({ data }) => {
        setDisplayName(data?.display_name || 'Unknown');
        setProfileLoading(false);
      });
  }, [supabase, userId]);

  const teamMap = useMemo(() => {
    const m = new Map<string, Team>();
    teams.forEach(t => m.set(t.id, t));
    return m;
  }, [teams]);

  const userPicks = useMemo(() =>
    allPicks.filter(p => p.user_id === userId),
    [allPicks, userId]
  );

  const localPicks = useMemo(() => {
    const m = new Map<number, string>();
    userPicks.forEach(p => m.set(p.game_number, p.team_id));
    return m;
  }, [userPicks]);

  const loading = teamsLoading || gamesLoading || picksLoading || profileLoading;

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="animate-pulse text-[#9b8ab8]">Loading picks...</div>
      </div>
    );
  }

  return (
    <div className="max-w-2xl mx-auto">
      {/* Header with back button */}
      <div className="mb-6">
        <button
          onClick={() => router.push('/leaderboard')}
          className="flex items-center gap-2 text-[#9b8ab8] hover:text-white transition-colors mb-4"
        >
          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 19.5L8.25 12l7.5-7.5" />
          </svg>
          <span className="text-sm">Leaderboard</span>
        </button>
        <h1 className="text-2xl font-bold text-white">{displayName}&apos;s Picks</h1>
      </div>

      {userPicks.length === 0 ? (
        <div className="glass-card p-10 text-center">
          <p className="text-[#9b8ab8]">No picks submitted yet</p>
        </div>
      ) : (
        <UserPicksSummary
          localPicks={localPicks}
          teamMap={teamMap}
          savedPicks={userPicks}
          games={games}
        />
      )}
    </div>
  );
}

function UserPicksSummary({
  localPicks,
  teamMap,
  savedPicks,
  games,
}: {
  localPicks: Map<number, string>;
  teamMap: Map<string, Team>;
  savedPicks: Pick[];
  games: Game[];
}) {
  const [pointsView, setPointsView] = useState<'toDate' | 'rest'>('toDate');

  const finalFourGameNumbers = [15, 30, 45, 60];
  const finalFourTeams = finalFourGameNumbers
    .map(gn => {
      const teamId = localPicks.get(gn);
      return teamId ? teamMap.get(teamId) ?? null : null;
    })
    .filter((t): t is Team => t !== null);

  const champId = localPicks.get(63);
  const champTeam = champId ? teamMap.get(champId) ?? null : null;

  // Build earned points per team from savedPicks
  const earnedByTeam = new Map<string, number>();
  let totalEarned = 0;
  savedPicks.forEach(p => {
    if (p.points_earned && p.points_earned > 0) {
      earnedByTeam.set(p.team_id, (earnedByTeam.get(p.team_id) || 0) + p.points_earned);
      totalEarned += p.points_earned;
    }
  });

  // Build set of game_numbers that are final
  const finalGameNumbers = new Set<number>();
  games.forEach(g => {
    if (g.status === 'final') finalGameNumbers.add(g.game_number);
  });

  // Per-team data
  const teamPickData = new Map<string, { team: Team; earnedPts: number; remainingPts: number; remainingWins: number }>();
  localPicks.forEach((teamId, gameNumber) => {
    const team = teamMap.get(teamId);
    if (!team) return;
    const existing = teamPickData.get(teamId);
    const isFinal = finalGameNumbers.has(gameNumber);

    if (existing) {
      if (!isFinal) {
        existing.remainingPts += team.seed;
        existing.remainingWins += 1;
      }
    } else {
      teamPickData.set(teamId, {
        team,
        earnedPts: earnedByTeam.get(teamId) || 0,
        remainingPts: isFinal ? 0 : team.seed,
        remainingWins: isFinal ? 0 : 1,
      });
    }
  });

  const toDateTeams = Array.from(teamPickData.values())
    .filter(e => e.earnedPts > 0)
    .sort((a, b) => b.earnedPts - a.earnedPts);

  const totalRemaining = Array.from(teamPickData.values()).reduce((sum, e) => sum + (e.team.eliminated ? 0 : e.remainingPts), 0);
  const restTeams = Array.from(teamPickData.values())
    .filter(e => !e.team.eliminated && e.remainingPts > 0)
    .sort((a, b) => b.remainingPts - a.remainingPts);

  return (
    <div className="space-y-8">
      {/* Champion */}
      {champTeam && (
        <div className={`glass-card p-6 text-center ${champTeam.eliminated ? 'opacity-60' : ''}`}>
          <p className="text-xs font-medium text-[#9b8ab8] uppercase tracking-wider mb-4">Champion</p>
          <div className="flex flex-col items-center gap-3">
            {champTeam.logo_url && (
              <img src={champTeam.logo_url} alt="" className={`w-16 h-16 object-contain ${champTeam.eliminated ? 'grayscale' : ''}`} />
            )}
            <div>
              <p className={`text-lg font-bold ${champTeam.eliminated ? 'line-through text-[#6b5a8a]' : 'text-white'}`}>{champTeam.name}</p>
              <p className="text-sm text-[#9b8ab8]">({champTeam.seed}) seed</p>
            </div>
          </div>
        </div>
      )}

      {/* Final Four */}
      <div className="glass-card p-6">
        <p className="text-xs font-medium text-[#9b8ab8] uppercase tracking-wider mb-5">Final Four</p>
        <div className="grid grid-cols-4 gap-4">
          {finalFourTeams.map((team) => {
            const eliminated = team.eliminated;
            return (
              <div key={team.id} className={`flex flex-col items-center gap-2 text-center ${eliminated ? 'opacity-50' : ''}`}>
                {team.logo_url ? (
                  <img src={team.logo_url} alt="" className={`w-10 h-10 object-contain ${eliminated ? 'grayscale' : ''}`} />
                ) : (
                  <div className="w-10 h-10 rounded-full bg-white/[0.04]" />
                )}
                <div>
                  <p className={`text-xs font-medium leading-tight ${eliminated ? 'line-through text-[#6b5a8a]' : 'text-white'}`}>{team.name}</p>
                  <p className="text-[10px] text-[#6b5a8a]">{team.seed} seed</p>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Points toggle */}
      <div className="glass-card p-6">
        <div className="flex bg-white/[0.04] rounded-xl p-1 mb-5">
          <button
            onClick={() => setPointsView('toDate')}
            className={`flex-1 py-2 rounded-lg text-sm font-medium transition-all ${
              pointsView === 'toDate'
                ? 'bg-[#7c3aed] text-white'
                : 'text-[#9b8ab8] hover:text-white'
            }`}
          >
            To Date
          </button>
          <button
            onClick={() => setPointsView('rest')}
            className={`flex-1 py-2 rounded-lg text-sm font-medium transition-all ${
              pointsView === 'rest'
                ? 'bg-[#7c3aed] text-white'
                : 'text-[#9b8ab8] hover:text-white'
            }`}
          >
            Rest of Tournament
          </button>
        </div>

        {pointsView === 'toDate' ? (
          <>
            <div className="flex items-baseline justify-between mb-4">
              <p className="text-xs text-[#6b5a8a]">Points earned from correct picks</p>
              <span className="text-lg font-bold font-mono text-green">{totalEarned}</span>
            </div>
            {toDateTeams.length === 0 ? (
              <p className="text-sm text-[#6b5a8a] text-center py-4">No points earned yet</p>
            ) : (
              <div className="space-y-1">
                {toDateTeams.map((entry) => (
                  <div
                    key={entry.team.id}
                    className="flex items-center justify-between py-2.5 px-3 rounded-lg"
                  >
                    <div className="flex items-center gap-2 min-w-0">
                      {entry.team.logo_url && (
                        <img src={entry.team.logo_url} alt="" className={`w-5 h-5 object-contain shrink-0 ${entry.team.eliminated ? 'grayscale' : ''}`} />
                      )}
                      <span className={`text-sm truncate ${entry.team.eliminated ? 'text-[#6b5a8a]' : ''}`}>{entry.team.name}</span>
                      <span className="text-xs text-[#6b5a8a] shrink-0">({entry.team.seed})</span>
                    </div>
                    <span className="text-sm font-bold font-mono text-green shrink-0 ml-2">{entry.earnedPts} pts</span>
                  </div>
                ))}
              </div>
            )}
          </>
        ) : (
          <>
            <div className="flex items-baseline justify-between mb-4">
              <p className="text-xs text-[#6b5a8a]">Potential points from teams still alive</p>
              <span className="text-lg font-bold font-mono text-[#a78bfa]">{totalRemaining}</span>
            </div>
            {restTeams.length === 0 ? (
              <p className="text-sm text-[#6b5a8a] text-center py-4">No remaining picks</p>
            ) : (
              <div className="space-y-1">
                {restTeams.map((entry) => (
                  <div
                    key={entry.team.id}
                    className="flex items-center justify-between py-2.5 px-3 rounded-lg"
                  >
                    <div className="flex items-center gap-2 min-w-0">
                      {entry.team.logo_url && (
                        <img src={entry.team.logo_url} alt="" className="w-5 h-5 object-contain shrink-0" />
                      )}
                      <span className="text-sm truncate">{entry.team.name}</span>
                      <span className="text-xs text-[#6b5a8a] shrink-0">({entry.team.seed})</span>
                    </div>
                    <div className="flex items-center gap-2 shrink-0 ml-2">
                      <span className="text-xs text-[#6b5a8a] whitespace-nowrap">{entry.remainingWins}W</span>
                      <span className="text-sm font-bold font-mono text-[#a78bfa] whitespace-nowrap">{entry.remainingPts} pts</span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
