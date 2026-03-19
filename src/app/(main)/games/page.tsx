'use client';

import { useState, useMemo, useEffect } from 'react';
import { createBrowserClient } from '@supabase/ssr';
import { useGames, useTeams, useAllPicks, useUser } from '@/lib/hooks';
import { ROUND_NAMES, getGameRound } from '@/lib/constants';
import type { Game, Team, Profile } from '@/types/database';

export default function GamesPage() {
  useUser();
  const { games, loading: gamesLoading } = useGames();
  const { teams, loading: teamsLoading } = useTeams();
  const { picks, loading: picksLoading } = useAllPicks();
  const [profiles, setProfiles] = useState<Map<string, Profile>>(new Map());
  const [expandedGame, setExpandedGame] = useState<string | null>(null);

  const supabase = createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );

  useEffect(() => {
    supabase
      .from('profiles')
      .select('*')
      .then(({ data }) => {
        if (data) {
          const map = new Map<string, Profile>();
          (data as Profile[]).forEach(p => map.set(p.id, p));
          setProfiles(map);
        }
      });
  }, [supabase]);

  const teamMap = useMemo(() => {
    const m = new Map<string, Team>();
    teams.forEach(t => m.set(t.id, t));
    return m;
  }, [teams]);

  const picksByGame = useMemo(() => {
    const m = new Map<number, Map<string, string[]>>();
    picks.forEach(p => {
      if (!m.has(p.game_number)) m.set(p.game_number, new Map());
      const gameMap = m.get(p.game_number)!;
      if (!gameMap.has(p.team_id)) gameMap.set(p.team_id, []);
      gameMap.get(p.team_id)!.push(p.user_id);
    });
    return m;
  }, [picks]);

  const sortByTime = (a: Game, b: Game) => {
    if (a.start_time && b.start_time) return new Date(a.start_time).getTime() - new Date(b.start_time).getTime();
    if (a.start_time) return -1;
    if (b.start_time) return 1;
    return a.game_number - b.game_number;
  };

  const liveGames = games.filter(g => g.status === 'live').sort(sortByTime);
  const upcomingGames = games.filter(g => g.status === 'upcoming').sort(sortByTime);
  const completedGames = games.filter(g => g.status === 'final').sort((a, b) => sortByTime(b, a));

  const loading = gamesLoading || teamsLoading || picksLoading;

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="animate-pulse text-[#9b8ab8]">Loading games...</div>
      </div>
    );
  }

  const toggleExpand = (gameId: string) => {
    setExpandedGame(prev => (prev === gameId ? null : gameId));
  };

  return (
    <div className="max-w-2xl mx-auto space-y-10">
      <h1 className="text-2xl font-bold text-white">Games</h1>
      {liveGames.length > 0 && (
        <GameSection
          title="Live Now"
          games={liveGames}
          teamMap={teamMap}
          picksByGame={picksByGame}
          profiles={profiles}
          expandedGame={expandedGame}
          onToggle={toggleExpand}
        />
      )}

      {upcomingGames.length > 0 && (
        <GameSection
          title="Up Next"
          games={upcomingGames}
          teamMap={teamMap}
          picksByGame={picksByGame}
          profiles={profiles}
          expandedGame={expandedGame}
          onToggle={toggleExpand}
        />
      )}

      {completedGames.length > 0 && (
        <GameSection
          title="Completed"
          games={completedGames}
          teamMap={teamMap}
          picksByGame={picksByGame}
          profiles={profiles}
          expandedGame={expandedGame}
          onToggle={toggleExpand}
        />
      )}

      {games.length === 0 && (
        <div className="text-center py-20">
          <p className="text-[#9b8ab8] text-lg">No games yet</p>
          <p className="text-[#6b5a8a] text-sm mt-2">Games will appear once the tournament begins.</p>
        </div>
      )}
    </div>
  );
}

function GameSection({
  title,
  games,
  teamMap,
  picksByGame,
  profiles,
  expandedGame,
  onToggle,
}: {
  title: string;
  games: Game[];
  teamMap: Map<string, Team>;
  picksByGame: Map<number, Map<string, string[]>>;
  profiles: Map<string, Profile>;
  expandedGame: string | null;
  onToggle: (gameId: string) => void;
}) {
  return (
    <div>
      <h2 className="text-xs font-medium text-[#9b8ab8] uppercase tracking-wider mb-3">{title}</h2>
      <div className="space-y-2.5">
        {games.map(game => (
          <GameCard
            key={game.id}
            game={game}
            teamMap={teamMap}
            picksByGame={picksByGame}
            profiles={profiles}
            isExpanded={expandedGame === game.id}
            onToggle={() => onToggle(game.id)}
          />
        ))}
      </div>
    </div>
  );
}

function GameCard({
  game,
  teamMap,
  picksByGame,
  profiles,
  isExpanded,
  onToggle,
}: {
  game: Game;
  teamMap: Map<string, Team>;
  picksByGame: Map<number, Map<string, string[]>>;
  profiles: Map<string, Profile>;
  isExpanded: boolean;
  onToggle: () => void;
}) {
  const teamA = game.team_a_id ? teamMap.get(game.team_a_id) ?? null : null;
  const teamB = game.team_b_id ? teamMap.get(game.team_b_id) ?? null : null;
  const isLive = game.status === 'live';
  const isFinal = game.status === 'final';
  const round = getGameRound(game.game_number);
  const roundName = ROUND_NAMES[round];

  const gamePicks = picksByGame.get(game.game_number);

  const teamAPickUsers = teamA && gamePicks ? gamePicks.get(teamA.id) || [] : [];
  const teamBPickUsers = teamB && gamePicks ? gamePicks.get(teamB.id) || [] : [];

  return (
    <div
      className={`glass-card overflow-hidden transition-all ${
        isLive ? 'ring-1 ring-green/30' : ''
      }`}
    >
      <button
        onClick={onToggle}
        className="w-full text-left px-5 py-4 hover:bg-white/[0.02] transition-all"
      >
        {/* Round label + status + time */}
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <span className="text-xs text-[#9b8ab8] font-medium">{roundName}</span>
            {game.region && (
              <span className="text-xs text-[#6b5a8a]">{game.region}</span>
            )}
          </div>
          <div className="flex items-center gap-2">
            {isLive ? (
              <>
                <span className="w-2 h-2 rounded-full bg-green animate-pulse" />
                {game.status_detail ? (
                  <span className="text-xs text-green font-medium">{game.status_detail}</span>
                ) : (
                  <span className="text-xs text-green font-medium">LIVE</span>
                )}
              </>
            ) : isFinal ? (
              <span className="text-xs text-[#6b5a8a] font-medium">FINAL</span>
            ) : game.start_time ? (
              <span className="text-xs text-[#6b5a8a]">
                {new Date(game.start_time).toLocaleString('en-US', {
                  weekday: 'short',
                  month: 'short',
                  day: 'numeric',
                  hour: 'numeric',
                  minute: '2-digit',
                })}
              </span>
            ) : null}
          </div>
        </div>

        {/* Matchup */}
        <div className="space-y-2">
          <TeamScoreLine
            team={teamA}
            score={game.score_a}
            isWinner={game.winner_id === teamA?.id}
            showScore={isLive || isFinal}
          />
          <TeamScoreLine
            team={teamB}
            score={game.score_b}
            isWinner={game.winner_id === teamB?.id}
            showScore={isLive || isFinal}
          />
        </div>
      </button>

      {/* Expanded: who picked whom */}
      {isExpanded && (teamA || teamB) && (
        <div className="border-t border-white/[0.04] px-5 py-4 space-y-4">
          <p className="text-xs text-[#9b8ab8] font-medium uppercase tracking-wider">Pool Picks</p>

          {teamA && (
            <div className="space-y-1.5">
              <p className="text-sm">
                <span className="text-[#6b5a8a] text-xs mr-1.5">({teamA.seed})</span>
                <span className="font-medium">{teamA.name}</span>
                <span className="text-[#6b5a8a] text-xs ml-2">
                  {teamAPickUsers.length} {teamAPickUsers.length === 1 ? 'pick' : 'picks'}
                </span>
              </p>
              {teamAPickUsers.length > 0 ? (
                <div className="flex flex-wrap gap-1.5">
                  {teamAPickUsers.map(uid => (
                    <span
                      key={uid}
                      className="text-xs bg-[#7c3aed]/15 text-[#a78bfa] px-2 py-0.5 rounded"
                    >
                      {profiles.get(uid)?.display_name || 'Unknown'}
                    </span>
                  ))}
                </div>
              ) : (
                <p className="text-xs text-[#6b5a8a]">No one</p>
              )}
            </div>
          )}

          {teamB && (
            <div className="space-y-1.5">
              <p className="text-sm">
                <span className="text-[#6b5a8a] text-xs mr-1.5">({teamB.seed})</span>
                <span className="font-medium">{teamB.name}</span>
                <span className="text-[#6b5a8a] text-xs ml-2">
                  {teamBPickUsers.length} {teamBPickUsers.length === 1 ? 'pick' : 'picks'}
                </span>
              </p>
              {teamBPickUsers.length > 0 ? (
                <div className="flex flex-wrap gap-1.5">
                  {teamBPickUsers.map(uid => (
                    <span
                      key={uid}
                      className="text-xs bg-[#7c3aed]/15 text-[#a78bfa] px-2 py-0.5 rounded"
                    >
                      {profiles.get(uid)?.display_name || 'Unknown'}
                    </span>
                  ))}
                </div>
              ) : (
                <p className="text-xs text-[#6b5a8a]">No one</p>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function TeamScoreLine({
  team,
  score,
  isWinner,
  showScore,
}: {
  team: Team | null;
  score: number | null | undefined;
  isWinner: boolean;
  showScore: boolean;
}) {
  if (!team) {
    return (
      <div className="flex items-center justify-between">
        <span className="text-sm text-[#6b5a8a]">TBD</span>
      </div>
    );
  }

  return (
    <div className="flex items-center justify-between">
      <div className="flex items-center gap-2.5">
        <span className="w-5 text-center text-xs text-[#9b8ab8] font-mono">{team.seed}</span>
        {team.logo_url && (
          <img src={team.logo_url} alt="" className="w-5 h-5 object-contain" />
        )}
        <span className={`text-sm ${isWinner ? 'font-bold' : ''} ${team.eliminated ? 'line-through text-[#6b5a8a]' : ''}`}>
          {team.name}
        </span>
      </div>
      {showScore && score !== null && score !== undefined && (
        <span className={`text-sm font-mono tabular-nums ${isWinner ? 'font-bold' : 'text-[#6b5a8a]'}`}>
          {score}
        </span>
      )}
    </div>
  );
}
