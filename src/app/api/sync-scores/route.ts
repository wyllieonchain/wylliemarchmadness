import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import https from 'https';

// Use Node.js https module to bypass Next.js fetch cache entirely
function fetchJson(url: string): Promise<unknown> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => { reject(new Error('Timeout')); }, 10000);
    https.get(url, (res) => {
      let body = '';
      res.on('data', (chunk: string) => { body += chunk; });
      res.on('end', () => {
        clearTimeout(timer);
        try { resolve(JSON.parse(body)); }
        catch { reject(new Error('Invalid JSON')); }
      });
    }).on('error', (err) => { clearTimeout(timer); reject(err); });
  });
}

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

const TOURNAMENT_ID = 'a0000000-0000-0000-0000-000000000001';


interface EspnCompetitor {
  team: { id: string };
  score?: string;
  winner?: boolean;
  seed?: string;
}

interface EspnCompetition {
  id: string;
  competitors: EspnCompetitor[];
  status: {
    type: { name: string; completed: boolean; detail?: string; shortDetail?: string };
    clock?: number;
    displayClock?: string;
    period?: number;
  };
}

interface EspnEvent {
  id: string;
  competitions: EspnCompetition[];
}

export async function GET(request: NextRequest) {
  // Verify cron secret (Vercel sends this automatically, or pass as query param for manual trigger)
  const authHeader = request.headers.get('authorization');
  const cronSecret = process.env.CRON_SECRET;
  if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    // Fetch yesterday + today + next 7 days (yesterday needed because Vercel runs in UTC)
    const datesToFetch: string[] = [];
    for (let i = -1; i <= 7; i++) {
      const d = new Date();
      d.setDate(d.getDate() + i);
      datesToFetch.push(`${d.getFullYear()}${String(d.getMonth() + 1).padStart(2, '0')}${String(d.getDate()).padStart(2, '0')}`);
    }

    const events: EspnEvent[] = [];
    for (const dateStr of datesToFetch) {
      try {
        const url = `https://site.api.espn.com/apis/site/v2/sports/basketball/mens-college-basketball/scoreboard?dates=${dateStr}&groups=100&limit=50`;
        const data = await fetchJson(url) as { events?: EspnEvent[] };
        const dayEvents: EspnEvent[] = data?.events ?? [];
        events.push(...dayEvents);
      } catch {
        // Skip days that fail
      }
    }

    // Log a sample live game score to verify fresh data
    const sampleLive = events.find(e => e.competitions[0]?.status?.type?.name === 'STATUS_IN_PROGRESS');
    if (sampleLive) {
      const sc = sampleLive.competitions[0];
      console.log(`[sync-scores] Sample live: ${sc.competitors[0]?.score}-${sc.competitors[1]?.score} ${sc.status?.type?.shortDetail}`);
    }
    console.log(`[sync-scores] Fetched ${events.length} ESPN events across ${datesToFetch.length} days`);

    if (events.length === 0) {
      return NextResponse.json({ message: 'No games found', updated: 0 });
    }

    // Get all ESPN game IDs from today's events
    const espnGameIds = events.map((e) => e.competitions[0]?.id ?? e.id).filter(Boolean);

    // Fetch our games that have matching espn_game_id
    const { data: ourGames, error: gamesErr } = await supabase
      .from('games')
      .select('id, game_number, espn_game_id, team_a_id, team_b_id, winner_id, status, next_game_id')
      .eq('tournament_id', TOURNAMENT_ID)
      .in('espn_game_id', espnGameIds);

    if (gamesErr) {
      console.error('[sync-scores] Failed to fetch games:', gamesErr);
      return NextResponse.json({ error: 'Database error', details: gamesErr.message }, { status: 500 });
    }

    // Build espn_game_id -> our game lookup from matched games
    const gameLookup = new Map((ourGames ?? []).map((g) => [g.espn_game_id, g]));

    // Fetch team espn_id -> team info mapping
    const { data: allTeams } = await supabase
      .from('teams')
      .select('id, espn_id, seed, region')
      .eq('tournament_id', TOURNAMENT_ID);

    const espnToTeam = new Map((allTeams ?? []).map((t) => [t.espn_id, t]));
    const espnToTeamId = new Map((allTeams ?? []).map((t) => [t.espn_id, t.id]));
    const teamSeedLookup = new Map((allTeams ?? []).map((t) => [t.id, t.seed]));

    // Fetch ALL games for team-based matching fallback
    const { data: allGames } = await supabase
      .from('games')
      .select('id, game_number, espn_game_id, team_a_id, team_b_id, winner_id, status, next_game_id, round')
      .eq('tournament_id', TOURNAMENT_ID);

    // For events not matched by espn_game_id, try matching by team ESPN IDs
    for (const event of events) {
      const comp = event.competitions[0];
      if (!comp) continue;
      const espnId = comp.id ?? event.id;
      if (gameLookup.has(espnId)) continue; // already matched

      const [c1, c2] = comp.competitors;
      const team1 = espnToTeam.get(String(c1?.team?.id));
      const team2 = espnToTeam.get(String(c2?.team?.id));
      if (!team1 || !team2) continue;

      // Check if this is a play-in game (same region + seed)
      const isPlayIn = team1.region === team2.region && team1.seed === team2.seed;

      if (isPlayIn) {
        // Play-in game: find the R64 game that has either of these teams
        const playInGame = (allGames ?? []).find(
          (g) =>
            g.round === 1 &&
            (g.team_a_id === team1.id || g.team_a_id === team2.id ||
             g.team_b_id === team1.id || g.team_b_id === team2.id)
        );

        if (playInGame && comp.status?.type?.completed) {
          const winner = comp.competitors.find((c: EspnCompetitor) => c.winner);
          const loser = comp.competitors.find((c: EspnCompetitor) => !c.winner);
          const winnerId = winner ? espnToTeamId.get(winner.team.id) : null;
          const loserId = loser ? espnToTeamId.get(loser.team.id) : null;

          if (winnerId && loserId) {
            // Swap the play-in slot to the winner if needed
            const updateFields: Record<string, string> = {};
            if (playInGame.team_a_id === loserId) updateFields.team_a_id = winnerId;
            if (playInGame.team_b_id === loserId) updateFields.team_b_id = winnerId;

            if (Object.keys(updateFields).length > 0) {
              await supabase.from('games').update(updateFields).eq('id', playInGame.id);
              console.log(`[sync-scores] Play-in: swapped ${loserId} -> ${winnerId} in game ${playInGame.game_number}`);
            }

            // Eliminate the loser
            await supabase.from('teams').update({ eliminated: true }).eq('id', loserId);
            console.log(`[sync-scores] Play-in complete: eliminated ${loserId}`);
          }
        }
        continue; // Don't add play-in to gameLookup
      }

      // Regular game: find matching game by both team IDs
      const matchedGame = (allGames ?? []).find(
        (g) =>
          (g.team_a_id === team1.id && g.team_b_id === team2.id) ||
          (g.team_a_id === team2.id && g.team_b_id === team1.id)
      );

      if (matchedGame) {
        // Set espn_game_id for future fast lookups
        await supabase.from('games').update({ espn_game_id: espnId }).eq('id', matchedGame.id);
        gameLookup.set(espnId, matchedGame);
        console.log(`[sync-scores] Matched ESPN event ${espnId} to game ${matchedGame.game_number} by team IDs`);
      }
    }

    let updatedCount = 0;
    const errors: string[] = [];

    for (const event of events) {
      const comp = event.competitions[0];
      if (!comp) continue;

      const espnId = comp.id ?? event.id;
      const game = gameLookup.get(espnId);
      if (!game) continue;

      // Determine competitors (ESPN lists home/away)
      const compA = comp.competitors.find((c) => espnToTeamId.get(c.team.id) === game.team_a_id);
      const compB = comp.competitors.find((c) => espnToTeamId.get(c.team.id) === game.team_b_id);

      // If we can't match by team_id, just use order
      const [c1, c2] = comp.competitors;

      const scoreA = parseInt((compA ?? c1)?.score ?? '0', 10) || null;
      const scoreB = parseInt((compB ?? c2)?.score ?? '0', 10) || null;

      // Map ESPN status to ours
      const espnStatus = comp.status?.type?.name ?? '';
      const isCompleted = comp.status?.type?.completed ?? false;
      let status: 'upcoming' | 'live' | 'final';
      if (isCompleted) {
        status = 'final';
      } else if (espnStatus === 'STATUS_IN_PROGRESS' || espnStatus === 'STATUS_HALFTIME') {
        status = 'live';
      } else {
        status = 'upcoming';
      }

      // Build status detail string for live games (e.g. "5:32 - 2nd Half")
      const statusDetail = comp.status?.type?.shortDetail || comp.status?.type?.detail || null;

      const updateData: Record<string, unknown> = {
        score_a: scoreA,
        score_b: scoreB,
        status,
        status_detail: status === 'live' ? statusDetail : null,
      };

      // Update start_time from ESPN if available
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const espnDate = (comp as any).date ?? (event as any).date;
      if (espnDate) {
        updateData.start_time = espnDate;
      }

      // Handle game going final
      const wasNotFinal = game.status !== 'final';
      const isNowFinal = status === 'final';

      if (isNowFinal && wasNotFinal) {
        updateData.finished_at = new Date().toISOString();
        // Determine winner
        const winner = comp.competitors.find((c) => c.winner);
        let winnerId: string | null = null;
        let loserId: string | null = null;

        if (winner) {
          winnerId = espnToTeamId.get(winner.team.id) ?? null;
          const loser = comp.competitors.find((c) => !c.winner);
          loserId = loser ? (espnToTeamId.get(loser.team.id) ?? null) : null;
        } else if (scoreA !== null && scoreB !== null) {
          // Fallback: higher score wins
          if (scoreA > scoreB) {
            winnerId = game.team_a_id;
            loserId = game.team_b_id;
          } else {
            winnerId = game.team_b_id;
            loserId = game.team_a_id;
          }
        }

        if (winnerId) {
          updateData.winner_id = winnerId;

          // Mark loser as eliminated
          if (loserId) {
            const { error: elimErr } = await supabase
              .from('teams')
              .update({ eliminated: true })
              .eq('id', loserId);

            if (elimErr) {
              errors.push(`Failed to eliminate team ${loserId}: ${elimErr.message}`);
            }
          }

          // Calculate points for picks on this game
          const { data: picks, error: picksErr } = await supabase
            .from('picks')
            .select('id, team_id')
            .eq('tournament_id', TOURNAMENT_ID)
            .eq('game_number', game.game_number);

          if (picksErr) {
            errors.push(`Failed to fetch picks for game ${game.game_number}: ${picksErr.message}`);
          } else if (picks && picks.length > 0) {
            for (const pick of picks) {
              const pointsEarned =
                pick.team_id === winnerId ? (teamSeedLookup.get(pick.team_id) ?? 0) : 0;

              const { error: pickUpdateErr } = await supabase
                .from('picks')
                .update({ points_earned: pointsEarned })
                .eq('id', pick.id);

              if (pickUpdateErr) {
                errors.push(`Failed to update pick ${pick.id}: ${pickUpdateErr.message}`);
              }
            }
            console.log(
              `[sync-scores] Scored ${picks.length} picks for game ${game.game_number}, winner seed: ${teamSeedLookup.get(winnerId)}`
            );
          }

          // Advance winner to next game
          if (game.next_game_id) {
            // Determine if winner goes into team_a_id or team_b_id slot
            // Convention: lower game_number feeds into team_a, higher into team_b
            const { data: nextGame } = await supabase
              .from('games')
              .select('id, team_a_id, team_b_id')
              .eq('id', game.next_game_id)
              .single();

            if (nextGame) {
              const advanceField = nextGame.team_a_id === null ? 'team_a_id' : 'team_b_id';
              const { error: advanceErr } = await supabase
                .from('games')
                .update({ [advanceField]: winnerId })
                .eq('id', game.next_game_id);

              if (advanceErr) {
                errors.push(`Failed to advance winner to game ${game.next_game_id}: ${advanceErr.message}`);
              } else {
                console.log(
                  `[sync-scores] Advanced winner ${winnerId} to next game (${advanceField})`
                );
              }
            }
          }
        }
      }

      // Update the game
      const { error: updateErr } = await supabase
        .from('games')
        .update(updateData)
        .eq('id', game.id);

      if (updateErr) {
        errors.push(`Failed to update game ${game.game_number}: ${updateErr.message}`);
      } else {
        updatedCount++;
      }
    }

    console.log(`[sync-scores] Updated ${updatedCount}/${events.length} games`);

    return NextResponse.json({
      success: true,
      dates: datesToFetch,
      espn_events: events.length,
      matched_games: gameLookup.size,
      updated: updatedCount,
      ...(errors.length > 0 && { errors }),
    });
  } catch (err) {
    console.error('[sync-scores] Unexpected error:', err);
    return NextResponse.json(
      { error: 'Internal server error', details: String(err) },
      { status: 500 }
    );
  }
}
