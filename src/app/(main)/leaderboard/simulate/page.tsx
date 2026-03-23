'use client';

import { useState, useCallback, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { useTeams, useGames } from '@/lib/hooks';
import { getFeederGames, getNextGameNumber, getGameRound, ROUND_NAMES, TOTAL_GAMES } from '@/lib/constants';
import type { Team, Game } from '@/types/database';

export default function SimulatePage() {
  const router = useRouter();
  const { teams, loading: teamsLoading } = useTeams();
  const { games, loading: gamesLoading } = useGames();
  const [simulatedWinners, setSimulatedWinners] = useState<Map<number, string>>(new Map());

  const teamMap = useMemo(() => {
    const m = new Map<string, Team>();
    teams.forEach(t => m.set(t.id, t));
    return m;
  }, [teams]);

  const gameMap = useMemo(() => {
    const m = new Map<number, Game>();
    games.forEach(g => m.set(g.game_number, g));
    return m;
  }, [games]);

  // Remaining (non-final) games grouped by round
  const remainingByRound = useMemo(() => {
    const rounds = new Map<number, number[]>();
    for (let gn = 1; gn <= TOTAL_GAMES; gn++) {
      const game = gameMap.get(gn);
      if (!game || game.status === 'final') continue;
      const round = getGameRound(gn);
      if (!rounds.has(round)) rounds.set(round, []);
      rounds.get(round)!.push(gn);
    }
    return Array.from(rounds.entries()).sort((a, b) => a[0] - b[0]);
  }, [gameMap]);

  const remainingCount = remainingByRound.reduce((sum, [, gns]) => sum + gns.length, 0);
  const pickedCount = Array.from(simulatedWinners.keys()).filter(gn => {
    const game = gameMap.get(gn);
    return game && game.status !== 'final';
  }).length;

  // Resolve teams for a game, using real data + simulated upstream winners
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

    if (game.team_a_id) {
      teamA = teamMap.get(game.team_a_id) || null;
    }
    if (game.team_b_id) {
      teamB = teamMap.get(game.team_b_id) || null;
    }

    // Fill from real winners or simulated winners
    if (!teamA) {
      const feederGame = gameMap.get(feeder1);
      const winnerId = feederGame?.winner_id || simulatedWinners.get(feeder1);
      if (winnerId) teamA = teamMap.get(winnerId) || null;
    }
    if (!teamB) {
      const feederGame = gameMap.get(feeder2);
      const winnerId = feederGame?.winner_id || simulatedWinners.get(feeder2);
      if (winnerId) teamB = teamMap.get(winnerId) || null;
    }

    return [teamA, teamB];
  }, [gameMap, teamMap, simulatedWinners]);

  const handlePick = useCallback((gameNumber: number, teamId: string) => {
    setSimulatedWinners(prev => {
      const next = new Map(prev);
      const currentPick = next.get(gameNumber);
      if (currentPick === teamId) return prev;

      next.set(gameNumber, teamId);

      // Clear downstream picks that depended on old winner
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
  }, []);

  const handleGenerate = () => {
    const data = Object.fromEntries(simulatedWinners);
    sessionStorage.setItem('simulate-winners', JSON.stringify(data));
    router.push('/leaderboard/simulate/results');
  };

  const loading = teamsLoading || gamesLoading;

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="animate-pulse text-[#9b8ab8]">Loading games...</div>
      </div>
    );
  }

  const progressPct = remainingCount > 0 ? (pickedCount / remainingCount) * 100 : 0;

  return (
    <div className="max-w-2xl mx-auto">
      {/* Header */}
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
        <h1 className="text-2xl font-bold text-white mb-1">Situation Analyzer</h1>
        <p className="text-[#9b8ab8] text-sm">Pick winners for remaining games to simulate the leaderboard</p>
      </div>

      {/* Progress */}
      <div className="flex items-center justify-between mb-6">
        <span className="text-[#9b8ab8] text-sm">{pickedCount}/{remainingCount} games</span>
        <div className="w-36 h-2 bg-white/[0.04] rounded-full overflow-hidden">
          <div
            className="h-full bg-[#7c3aed] rounded-full transition-all duration-500 ease-out"
            style={{ width: `${progressPct}%` }}
          />
        </div>
      </div>

      {/* Games by round */}
      <div className="space-y-8">
        {remainingByRound.map(([round, gameNumbers]) => (
          <div key={round}>
            <h3 className="text-xs font-medium text-[#9b8ab8] uppercase tracking-wider mb-3">
              {ROUND_NAMES[round] || `Round ${round}`}
            </h3>
            <div className="space-y-2.5">
              {gameNumbers.map(gn => {
                const [teamA, teamB] = getTeamsForGame(gn);
                const picked = simulatedWinners.get(gn);

                return (
                  <div key={gn} className="glass-card overflow-hidden">
                    <SimTeamRow
                      team={teamA}
                      isPicked={picked === teamA?.id}
                      onClick={() => teamA && handlePick(gn, teamA.id)}
                      canEdit={!!teamA}
                    />
                    <div className="border-t border-white/[0.04]" />
                    <SimTeamRow
                      team={teamB}
                      isPicked={picked === teamB?.id}
                      onClick={() => teamB && handlePick(gn, teamB.id)}
                      canEdit={!!teamB}
                    />
                  </div>
                );
              })}
            </div>
          </div>
        ))}
      </div>

      {/* Generate button */}
      <div className="mt-8 mb-4">
        <button
          onClick={handleGenerate}
          disabled={pickedCount === 0}
          className="w-full py-4 rounded-2xl font-semibold text-base transition-all bg-[#7c3aed] hover:bg-[#6d28d9] text-white disabled:opacity-30 disabled:cursor-not-allowed"
        >
          Generate Leaderboard
        </button>
      </div>
    </div>
  );
}

function SimTeamRow({
  team,
  isPicked,
  onClick,
  canEdit,
}: {
  team: Team | null;
  isPicked: boolean;
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
        isPicked ? 'border-l-[3px] border-l-white bg-white/[0.04]' : 'border-l-[3px] border-transparent'
      } ${canEdit ? 'hover:bg-white/[0.03] cursor-pointer' : 'cursor-default'}`}
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
    </button>
  );
}
