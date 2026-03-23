'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import { createBrowserClient } from '@supabase/ssr';
import { useUser, useTeams, useGames, useUserPicks, useTournament } from '@/lib/hooks';
import { TOURNAMENT_ID, REGIONS, getRegionGameRange, getNextGameNumber, getFeederGames, getGameRound, ROUND_NAMES, TOTAL_GAMES } from '@/lib/constants';
import type { Team, Game, Pick } from '@/types/database';
import type { Region } from '@/lib/constants';

type Tab = Region | 'Final Four';

export default function PicksPage() {
  const { user } = useUser();
  const { tournament } = useTournament();
  const { teams, loading: teamsLoading } = useTeams();
  const { games, loading: gamesLoading } = useGames();
  const { picks: savedPicks, loading: picksLoading, refetch: refetchPicks } = useUserPicks(user?.id);

  const [activeTab, setActiveTab] = useState<Tab>('East');
  const [localPicks, setLocalPicks] = useState<Map<number, string>>(new Map());
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [editing, setEditing] = useState(false);

  const supabase = createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );

  const isLocked = tournament ? new Date() > new Date(tournament.lock_time) : false;

  const cacheKey = user ? `draft-picks-${user.id}` : null;

  useEffect(() => {
    if (savedPicks.length > 0) {
      const map = new Map<number, string>();
      savedPicks.forEach(p => map.set(p.game_number, p.team_id));
      setLocalPicks(map);
      setSubmitted(true);
      if (cacheKey) localStorage.removeItem(cacheKey);
    } else if (cacheKey) {
      try {
        const cached = localStorage.getItem(cacheKey);
        if (cached) {
          const entries: [number, string][] = JSON.parse(cached);
          if (entries.length > 0) {
            setLocalPicks(new Map(entries));
          }
        }
      } catch { /* ignore bad cache */ }
    }
  }, [savedPicks, cacheKey]);

  useEffect(() => {
    if (!cacheKey || submitted) return;
    if (localPicks.size === 0) return;
    localStorage.setItem(cacheKey, JSON.stringify(Array.from(localPicks.entries())));
  }, [localPicks, cacheKey, submitted]);

  const teamMap = useMemo(() => {
    const m = new Map<string, Team>();
    teams.forEach(t => m.set(t.id, t));
    return m;
  }, [teams]);

  const playInPartners = useMemo(() => {
    const m = new Map<string, Team>();
    const byRegionSeed = new Map<string, Team[]>();
    teams.forEach(t => {
      const key = `${t.region}-${t.seed}`;
      if (!byRegionSeed.has(key)) byRegionSeed.set(key, []);
      byRegionSeed.get(key)!.push(t);
    });
    byRegionSeed.forEach(group => {
      if (group.length === 2) {
        m.set(group[0].id, group[1]);
        m.set(group[1].id, group[0]);
      }
    });
    return m;
  }, [teams]);

  const gameMap = useMemo(() => {
    const m = new Map<number, Game>();
    games.forEach(g => m.set(g.game_number, g));
    return m;
  }, [games]);

  const getTeamsForGame = useCallback((gameNumber: number): [Team | null, Team | null] => {
    const game = gameMap.get(gameNumber);
    if (!game) return [null, null];

    const feeders = getFeederGames(gameNumber);
    if (!feeders) {
      return [
        game.team_a_id ? teamMap.get(game.team_a_id) || null : null,
        game.team_b_id ? teamMap.get(game.team_b_id) || null : null,
      ];
    }

    const [feeder1, feeder2] = feeders;
    let teamA: Team | null = null;
    let teamB: Team | null = null;

    if (game.team_a_id) teamA = teamMap.get(game.team_a_id) || null;
    if (game.team_b_id) teamB = teamMap.get(game.team_b_id) || null;

    if (!teamA) {
      const pickTeamId = localPicks.get(feeder1);
      if (pickTeamId) teamA = teamMap.get(pickTeamId) || null;
    }
    if (!teamB) {
      const pickTeamId = localPicks.get(feeder2);
      if (pickTeamId) teamB = teamMap.get(pickTeamId) || null;
    }

    return [teamA, teamB];
  }, [gameMap, teamMap, localPicks]);

  const handlePick = useCallback((gameNumber: number, teamId: string) => {
    if (isLocked && !editing) return;
    if (submitted && !editing) return;

    setLocalPicks(prev => {
      const next = new Map(prev);
      const currentPick = next.get(gameNumber);

      if (currentPick === teamId) return prev;

      next.set(gameNumber, teamId);

      if (currentPick) {
        const clearDownstream = (gn: number, oldTeamId: string) => {
          const nextGN = getNextGameNumber(gn);
          if (!nextGN) return;

          const downstreamPick = next.get(nextGN);
          if (downstreamPick === oldTeamId) {
            next.delete(nextGN);
            clearDownstream(nextGN, oldTeamId);
          }
        };
        clearDownstream(gameNumber, currentPick);
      }

      return next;
    });
  }, [isLocked, submitted, editing]);

  const pickCount = localPicks.size;
  const canSubmit = pickCount === TOTAL_GAMES;

  const handleSubmit = async () => {
    if (!user || !canSubmit) return;
    setSubmitting(true);

    const picksData = Array.from(localPicks.entries()).map(([gameNumber, teamId]) => ({
      user_id: user.id,
      tournament_id: TOURNAMENT_ID,
      game_number: gameNumber,
      team_id: teamId,
    }));

    const { error } = await supabase
      .from('picks')
      .upsert(picksData, { onConflict: 'user_id,tournament_id,game_number' });

    if (error) {
      console.error('Error submitting picks:', error);
      alert('Error submitting picks. Please try again.');
    } else {
      setSubmitted(true);
      setEditing(false);
      refetchPicks();
    }
    setSubmitting(false);
  };

  const loading = teamsLoading || gamesLoading || picksLoading;

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="animate-pulse text-[#9b8ab8]">Loading bracket...</div>
      </div>
    );
  }

  const tabs: Tab[] = [...REGIONS, 'Final Four'];
  const progressPct = (pickCount / TOTAL_GAMES) * 100;

  // Count picks per tab to determine completeness
  const getTabGameRange = (tab: Tab): [number, number] => {
    if (tab === 'Final Four') return [61, 63];
    const [s, e] = getRegionGameRange(tab as Region);
    return [s, e];
  };
  const isTabComplete = (tab: Tab): boolean => {
    const [s, e] = getTabGameRange(tab);
    for (let gn = s; gn <= e; gn++) {
      if (!localPicks.has(gn)) return false;
    }
    return true;
  };
  const nextIncompleteTab = tabs.find(t => t !== activeTab && !isTabComplete(t)) || null;
  const currentTabComplete = isTabComplete(activeTab);

  return (
    <div className="max-w-2xl mx-auto">
      {/* Header */}
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-white mb-4">Your Bracket</h1>

        {!isLocked && !submitted && (
          <div className="glass-card-sm px-5 py-4 mb-4 flex items-center gap-3">
            <span className="text-lg">⏰</span>
            <p className="text-[#a78bfa] text-sm">
              Lock in before {tournament ? new Date(tournament.lock_time).toLocaleString('en-US', {
                weekday: 'long',
                month: 'long',
                day: 'numeric',
                hour: 'numeric',
                minute: '2-digit',
                timeZoneName: 'short',
              }) : 'the deadline'}
            </p>
          </div>
        )}

        {submitted && !editing && !isLocked && (
          <div className="glass-card-sm px-5 py-4 mb-4 flex items-center justify-between border-green/20">
            <div className="flex items-center gap-2">
              <span className="text-lg">✅</span>
              <p className="text-green text-sm font-medium">Picks locked in!</p>
            </div>
            <button
              onClick={() => setEditing(true)}
              className="text-[#a78bfa] text-sm font-medium hover:text-white transition-colors"
            >
              Edit
            </button>
          </div>
        )}

        {(!submitted || editing) && (
          <div className="flex items-center justify-between">
            <span className="text-[#9b8ab8] text-sm">{pickCount}/{TOTAL_GAMES} picks</span>
            <div className="w-36 h-2 bg-white/[0.04] rounded-full overflow-hidden">
              <div
                className="h-full bg-[#7c3aed] rounded-full transition-all duration-500 ease-out"
                style={{ width: `${progressPct}%` }}
              />
            </div>
          </div>
        )}
      </div>

      {/* Summary view when submitted */}
      {submitted && !editing ? (
        <PicksSummary localPicks={localPicks} teamMap={teamMap} savedPicks={savedPicks} games={games} />
      ) : (
        <>
          {/* Region Tabs */}
          <div className="flex gap-1.5 mb-6 overflow-x-auto hide-scrollbar">
            {tabs.map(tab => (
              <button
                key={tab}
                onClick={() => setActiveTab(tab)}
                className={`px-4 py-2 rounded-full text-sm font-medium whitespace-nowrap transition-all ${
                  activeTab === tab
                    ? 'bg-[#7c3aed] text-white'
                    : 'bg-white/[0.04] text-[#9b8ab8] hover:text-white hover:bg-white/[0.07]'
                }`}
              >
                {tab}
              </button>
            ))}
          </div>

          {/* Bracket Content */}
          <BracketRegion
            tab={activeTab}
            gameMap={gameMap}
            teamMap={teamMap}
            localPicks={localPicks}
            getTeamsForGame={getTeamsForGame}
            onPick={handlePick}
            canEdit={(!submitted || editing) && !isLocked}
            playInPartners={playInPartners}
          />

          {/* Navigation / Submit Button */}
          {(!submitted || editing) && !isLocked && (
            <div className="mt-8 mb-4">
              {canSubmit ? (
                <button
                  onClick={handleSubmit}
                  disabled={submitting}
                  className="w-full py-4 rounded-2xl font-semibold text-base transition-all bg-[#7c3aed] hover:bg-[#6d28d9] text-white"
                >
                  {submitting ? 'Submitting...' : editing ? 'Save Changes' : `Submit All ${TOTAL_GAMES} Picks`}
                </button>
              ) : currentTabComplete && nextIncompleteTab ? (
                <button
                  onClick={() => { setActiveTab(nextIncompleteTab); window.scrollTo({ top: 0, behavior: 'smooth' }); }}
                  className="w-full py-4 rounded-2xl font-semibold text-base transition-all bg-[#7c3aed] hover:bg-[#6d28d9] text-white"
                >
                  Go to {nextIncompleteTab}
                </button>
              ) : (
                <div className="w-full py-4 rounded-2xl font-semibold text-base text-center bg-white/[0.04] text-[#6b5a8a]">
                  {pickCount}/{TOTAL_GAMES} picks made
                </div>
              )}
            </div>
          )}
        </>
      )}
    </div>
  );
}

function PicksSummary({
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

  // Build set of game_numbers that are final (already scored)
  const finalGameNumbers = new Set<number>();
  games.forEach(g => {
    if (g.status === 'final') finalGameNumbers.add(g.game_number);
  });

  // Count how many times each team appears in picks and calculate potential remaining points
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

  // "To Date" list: teams that have earned points, sorted by earned desc
  const toDateTeams = Array.from(teamPickData.values())
    .filter(e => e.earnedPts > 0)
    .sort((a, b) => b.earnedPts - a.earnedPts);

  // "Rest of Tournament" list: alive teams with remaining picks, sorted by remaining potential desc
  const totalRemaining = Array.from(teamPickData.values()).reduce((sum, e) => sum + (e.team.eliminated ? 0 : e.remainingPts), 0);
  const restTeams = Array.from(teamPickData.values())
    .filter(e => !e.team.eliminated && e.remainingPts > 0)
    .sort((a, b) => b.remainingPts - a.remainingPts);

  return (
    <div className="space-y-8">
      {/* Champion */}
      {champTeam && (
        <div className={`glass-card p-6 text-center ${champTeam.eliminated ? 'opacity-60' : ''}`}>
          <p className="text-xs font-medium text-[#9b8ab8] uppercase tracking-wider mb-4">Your Champion</p>
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
        <p className="text-xs font-medium text-[#9b8ab8] uppercase tracking-wider mb-5">Your Final Four</p>
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

      {/* Points toggle section */}
      <div className="glass-card p-6">
        {/* Toggle */}
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

function BracketRegion({
  tab,
  gameMap,
  teamMap,
  localPicks,
  getTeamsForGame,
  onPick,
  canEdit,
  playInPartners,
}: {
  tab: Tab;
  gameMap: Map<number, Game>;
  teamMap: Map<string, Team>;
  localPicks: Map<number, string>;
  getTeamsForGame: (gn: number) => [Team | null, Team | null];
  onPick: (gn: number, teamId: string) => void;
  canEdit: boolean;
  playInPartners: Map<string, Team>;
}) {
  if (tab === 'Final Four') {
    return (
      <div className="space-y-8">
        <RoundGroup
          title="Final Four"
          gameNumbers={[61, 62]}
          gameMap={gameMap}
          teamMap={teamMap}
          localPicks={localPicks}
          getTeamsForGame={getTeamsForGame}
          onPick={onPick}
          canEdit={canEdit}
          playInPartners={playInPartners}
        />
        <RoundGroup
          title="Championship"
          gameNumbers={[63]}
          gameMap={gameMap}
          teamMap={teamMap}
          localPicks={localPicks}
          getTeamsForGame={getTeamsForGame}
          onPick={onPick}
          canEdit={canEdit}
          playInPartners={playInPartners}
        />
      </div>
    );
  }

  const region = tab as Region;
  const [start, end] = getRegionGameRange(region);

  const rounds: { round: number; gameNumbers: number[] }[] = [];
  for (let gn = start; gn <= end; gn++) {
    const round = getGameRound(gn);
    let group = rounds.find(r => r.round === round);
    if (!group) {
      group = { round, gameNumbers: [] };
      rounds.push(group);
    }
    group.gameNumbers.push(gn);
  }

  return (
    <div className="space-y-8">
      {rounds.map(({ round, gameNumbers }) => (
        <RoundGroup
          key={round}
          title={ROUND_NAMES[round]}
          gameNumbers={gameNumbers}
          gameMap={gameMap}
          teamMap={teamMap}
          localPicks={localPicks}
          getTeamsForGame={getTeamsForGame}
          onPick={onPick}
          canEdit={canEdit}
          playInPartners={playInPartners}
        />
      ))}
    </div>
  );
}

function RoundGroup({
  title,
  gameNumbers,
  gameMap,
  teamMap,
  localPicks,
  getTeamsForGame,
  onPick,
  canEdit,
  playInPartners,
}: {
  title: string;
  gameNumbers: number[];
  gameMap: Map<number, Game>;
  teamMap: Map<string, Team>;
  localPicks: Map<number, string>;
  getTeamsForGame: (gn: number) => [Team | null, Team | null];
  onPick: (gn: number, teamId: string) => void;
  canEdit: boolean;
  playInPartners: Map<string, Team>;
}) {
  return (
    <div>
      <h3 className="text-xs font-medium text-[#9b8ab8] uppercase tracking-wider mb-3">{title}</h3>
      <div className="space-y-2.5">
        {gameNumbers.map(gn => (
          <MatchupCard
            key={gn}
            gameNumber={gn}
            game={gameMap.get(gn)}
            teamMap={teamMap}
            localPicks={localPicks}
            getTeamsForGame={getTeamsForGame}
            onPick={onPick}
            canEdit={canEdit}
            playInPartners={playInPartners}
          />
        ))}
      </div>
    </div>
  );
}

function MatchupCard({
  gameNumber,
  game,
  teamMap,
  localPicks,
  getTeamsForGame,
  onPick,
  canEdit,
  playInPartners,
}: {
  gameNumber: number;
  game: Game | undefined;
  teamMap: Map<string, Team>;
  localPicks: Map<number, string>;
  getTeamsForGame: (gn: number) => [Team | null, Team | null];
  onPick: (gn: number, teamId: string) => void;
  canEdit: boolean;
  playInPartners: Map<string, Team>;
}) {
  const [teamA, teamB] = getTeamsForGame(gameNumber);
  const picked = localPicks.get(gameNumber);
  const isGameFinal = game?.status === 'final';
  const winnerId = game?.winner_id;
  const isRound1 = game?.round === 1;

  const getPartner = (team: Team | null): Team | null => {
    if (!isRound1 || !team) return null;
    return playInPartners.get(team.id) || null;
  };

  const partnerA = getPartner(teamA);
  const partnerB = getPartner(teamB);

  const getPickStyle = (teamId: string) => {
    if (!picked) return '';
    if (picked !== teamId) return '';

    if (isGameFinal) {
      if (winnerId === teamId) return 'border-l-green bg-green/[0.06]';
      return 'border-l-red bg-red/[0.06]';
    }

    const team = teamMap.get(teamId);
    if (team?.eliminated) return 'border-l-red bg-red/[0.06]';

    return 'border-l-white bg-white/[0.04]';
  };

  return (
    <div className="glass-card overflow-hidden">
      {/* Team A side */}
      {partnerA ? (
        <PlayInSlot
          team={teamA!}
          partner={partnerA}
          isPicked={picked === teamA?.id}
          pickStyle={teamA ? getPickStyle(teamA.id) : ''}
          onClick={() => teamA && canEdit && onPick(gameNumber, teamA.id)}
          canEdit={canEdit}
        />
      ) : (
        <TeamRow
          team={teamA}
          isPicked={picked === teamA?.id}
          pickStyle={teamA ? getPickStyle(teamA.id) : ''}
          score={game?.score_a}
          isWinner={winnerId === teamA?.id}
          isLive={game?.status === 'live'}
          onClick={() => teamA && canEdit && onPick(gameNumber, teamA.id)}
          canEdit={canEdit}
        />
      )}
      <div className="border-t border-white/[0.04]" />
      {/* Team B side */}
      {partnerB ? (
        <PlayInSlot
          team={teamB!}
          partner={partnerB}
          isPicked={picked === teamB?.id}
          pickStyle={teamB ? getPickStyle(teamB.id) : ''}
          onClick={() => teamB && canEdit && onPick(gameNumber, teamB.id)}
          canEdit={canEdit}
        />
      ) : (
        <TeamRow
          team={teamB}
          isPicked={picked === teamB?.id}
          pickStyle={teamB ? getPickStyle(teamB.id) : ''}
          score={game?.score_b}
          isWinner={winnerId === teamB?.id}
          isLive={game?.status === 'live'}
          onClick={() => teamB && canEdit && onPick(gameNumber, teamB.id)}
          canEdit={canEdit}
        />
      )}
    </div>
  );
}

function PlayInSlot({
  team,
  partner,
  isPicked,
  pickStyle,
  onClick,
  canEdit,
}: {
  team: Team;
  partner: Team;
  isPicked: boolean;
  pickStyle: string;
  onClick: () => void;
  canEdit: boolean;
}) {
  return (
    <button
      onClick={onClick}
      disabled={!canEdit}
      className={`w-full px-4 py-3.5 flex items-center justify-between text-left transition-all ${
        isPicked ? pickStyle + ' border-l-[3px]' : 'border-l-[3px] border-transparent'
      } ${canEdit ? 'hover:bg-white/[0.03] cursor-pointer' : 'cursor-default'}`}
    >
      <div className="flex items-center gap-2.5 min-w-0">
        <span className="w-6 text-center text-xs text-[#9b8ab8] font-mono">{team.seed}</span>
        <div className="flex items-center gap-1.5 min-w-0">
          {team.logo_url && (
            <img src={team.logo_url} alt="" className="w-5 h-5 object-contain shrink-0" />
          )}
          <span className="text-sm truncate">{team.name}</span>
        </div>
        <span className="text-[#6b5a8a] text-xs shrink-0">/</span>
        <div className="flex items-center gap-1.5 min-w-0">
          {partner.logo_url && (
            <img src={partner.logo_url} alt="" className="w-5 h-5 object-contain shrink-0" />
          )}
          <span className="text-sm truncate">{partner.name}</span>
        </div>
      </div>
      {isPicked && (
        <span className="text-[10px] bg-white text-[#7c3aed] px-1.5 py-0.5 rounded-full font-bold tracking-wide shrink-0 ml-2">PICK</span>
      )}
    </button>
  );
}

function TeamRow({
  team,
  isPicked,
  pickStyle,
  score,
  isWinner,
  isLive,
  onClick,
  canEdit,
}: {
  team: Team | null;
  isPicked: boolean;
  pickStyle: string;
  score: number | null | undefined;
  isWinner: boolean;
  isLive: boolean;
  onClick: () => void;
  canEdit: boolean;
}) {
  if (!team) {
    return (
      <div className="px-4 py-3.5 flex items-center text-[#6b5a8a] text-sm">
        <span className="w-6 text-center text-xs">—</span>
        <span className="ml-2 italic">TBD</span>
      </div>
    );
  }

  return (
    <button
      onClick={onClick}
      disabled={!canEdit}
      className={`w-full px-4 py-3.5 flex items-center justify-between text-left transition-all ${
        isPicked ? pickStyle + ' border-l-[3px]' : 'border-l-[3px] border-transparent'
      } ${canEdit ? 'hover:bg-white/[0.03] cursor-pointer' : 'cursor-default'} ${
        isWinner ? 'font-bold' : ''
      }`}
    >
      <div className="flex items-center gap-2.5">
        <span className="w-6 text-center text-xs text-[#9b8ab8] font-mono">{team.seed}</span>
        {team.logo_url && (
          <img src={team.logo_url} alt="" className="w-5 h-5 object-contain" />
        )}
        <span className={`text-sm ${team.eliminated ? 'line-through text-[#6b5a8a]' : ''}`}>
          {team.name}
        </span>
        {isPicked && (
          <span className="text-[10px] bg-white text-[#7c3aed] px-1.5 py-0.5 rounded-full font-bold tracking-wide">PICK</span>
        )}
      </div>
      <div className="flex items-center gap-2">
        {isLive && (
          <span className="w-2 h-2 rounded-full bg-green animate-pulse" />
        )}
        {score !== null && score !== undefined && (
          <span className="text-sm font-mono tabular-nums font-bold">{score}</span>
        )}
      </div>
    </button>
  );
}
