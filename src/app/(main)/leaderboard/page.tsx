'use client';

import { useState } from 'react';
import { useLeaderboard, useUser, useAllPicks, useTeams } from '@/lib/hooks';
import type { Team } from '@/types/database';

const rankEmojis: Record<number, string> = { 1: '🥇', 2: '🥈', 3: '🥉' };

export default function LeaderboardPage() {
  const { user } = useUser();
  const { leaderboard, loading } = useLeaderboard();
  const { picks, loading: picksLoading } = useAllPicks();
  const { teams, loading: teamsLoading } = useTeams();
  const [expandedUser, setExpandedUser] = useState<string | null>(null);
  const [sortBy, setSortBy] = useState<'pts' | 'poss'>('pts');

  const teamMap = new Map<string, Team>();
  teams.forEach(t => teamMap.set(t.id, t));

  // Build user -> champion & final four from picks
  const getUserHighlights = (userId: string) => {
    const userPicks = picks.filter(p => p.user_id === userId);
    const champPick = userPicks.find(p => p.game_number === 63);
    const champTeam = champPick ? teamMap.get(champPick.team_id) ?? null : null;

    const finalFourGameNumbers = [15, 30, 45, 60];
    const finalFourTeams = finalFourGameNumbers
      .map(gn => {
        const pick = userPicks.find(p => p.game_number === gn);
        return pick ? teamMap.get(pick.team_id) ?? null : null;
      })
      .filter((t): t is Team => t !== null);

    return { champTeam, finalFourTeams };
  };

  const allLoading = loading || picksLoading || teamsLoading;

  if (allLoading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="animate-pulse text-[#9b8ab8]">Loading leaderboard...</div>
      </div>
    );
  }

  return (
    <div className="max-w-2xl mx-auto">
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-white">Leaderboard</h1>
        <p className="text-[#9b8ab8] text-sm mt-1">{leaderboard.length} player{leaderboard.length !== 1 ? 's' : ''} in the pool</p>
      </div>

      {leaderboard.length === 0 ? (
        <div className="glass-card p-10 text-center">
          <div className="text-4xl mb-3">👀</div>
          <p className="text-[#9b8ab8] text-lg">No one here yet</p>
          <p className="text-[#6b5a8a] text-sm mt-2">
            Share the link with your family to get started!
          </p>
        </div>
      ) : (
        <div className="glass-card overflow-hidden">
          {/* Table Header */}
          <div className="grid grid-cols-[3rem_1fr_4.5rem_4.5rem] gap-2 px-5 py-3 border-b border-white/[0.04]">
            <span className="text-[10px] text-[#6b5a8a] font-medium uppercase tracking-wider">#</span>
            <span className="text-[10px] text-[#6b5a8a] font-medium uppercase tracking-wider">Player</span>
            <button
              onClick={() => setSortBy('pts')}
              className={`text-[10px] font-medium uppercase tracking-wider text-right ${sortBy === 'pts' ? 'text-white' : 'text-[#6b5a8a]'}`}
            >
              Pts
            </button>
            <button
              onClick={() => setSortBy('poss')}
              className={`text-[10px] font-medium uppercase tracking-wider text-right ${sortBy === 'poss' ? 'text-white' : 'text-[#6b5a8a]'}`}
            >
              Poss
            </button>
          </div>

          {/* Rows */}
          {[...leaderboard].sort((a, b) =>
            sortBy === 'poss'
              ? b.possible_points - a.possible_points || b.total_points - a.total_points
              : b.total_points - a.total_points || b.possible_points - a.possible_points
          ).map((entry, index) => {
            const isCurrentUser = user?.id === entry.user_id;
            const rank = index + 1;
            const emoji = rankEmojis[rank];
            const isExpanded = expandedUser === entry.user_id;
            const { champTeam, finalFourTeams } = isExpanded ? getUserHighlights(entry.user_id) : { champTeam: null, finalFourTeams: [] };

            return (
              <div
                key={entry.user_id}
                className={index < leaderboard.length - 1 ? 'border-b border-white/[0.04]' : ''}
              >
                <button
                  onClick={() => setExpandedUser(isExpanded ? null : entry.user_id)}
                  className={`w-full grid grid-cols-[3rem_1fr_4.5rem_4.5rem] gap-2 px-5 py-4 items-center transition-colors hover:bg-white/[0.02] text-left ${
                    isCurrentUser ? 'bg-[#7c3aed]/[0.04]' : ''
                  } ${isExpanded ? 'bg-white/[0.02]' : ''}`}
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
                  <span className="text-sm font-mono tabular-nums text-right font-bold">
                    {entry.total_points}
                  </span>
                  <span className="text-sm font-mono tabular-nums text-right text-[#6b5a8a]">
                    {entry.possible_points}
                  </span>
                </button>

                {/* Expandable champion + final four */}
                <div
                  className="grid transition-all duration-300 ease-in-out"
                  style={{ gridTemplateRows: isExpanded ? '1fr' : '0fr' }}
                >
                  <div className="overflow-hidden">
                    <div className="px-5 pb-4 pt-1 space-y-4">
                      {/* Champion */}
                      {champTeam && (
                        <div>
                          <p className="text-[10px] text-[#6b5a8a] uppercase tracking-wider mb-2">Champion</p>
                          <div className={`flex items-center gap-2 ${champTeam.eliminated ? 'opacity-50' : ''}`}>
                            {champTeam.logo_url && (
                              <img src={champTeam.logo_url} alt="" className={`w-6 h-6 object-contain ${champTeam.eliminated ? 'grayscale' : ''}`} />
                            )}
                            <span className={`text-sm font-medium ${champTeam.eliminated ? 'line-through text-[#6b5a8a]' : 'text-white'}`}>
                              {champTeam.name}
                            </span>
                            <span className="text-xs text-[#6b5a8a]">({champTeam.seed})</span>
                          </div>
                        </div>
                      )}

                      {/* Final Four */}
                      {finalFourTeams.length > 0 && (
                        <div>
                          <p className="text-[10px] text-[#6b5a8a] uppercase tracking-wider mb-2">Final Four</p>
                          <div className="grid grid-cols-2 gap-2">
                            {finalFourTeams.map(team => (
                              <div
                                key={team.id}
                                className={`flex items-center gap-2 ${team.eliminated ? 'opacity-50' : ''}`}
                              >
                                {team.logo_url && (
                                  <img src={team.logo_url} alt="" className={`w-5 h-5 object-contain ${team.eliminated ? 'grayscale' : ''}`} />
                                )}
                                <span className={`text-xs ${team.eliminated ? 'line-through text-[#6b5a8a]' : ''}`}>
                                  {team.name}
                                </span>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}

                      {!champTeam && finalFourTeams.length === 0 && (
                        <p className="text-xs text-[#6b5a8a] italic">No picks submitted yet</p>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
