import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

const TOURNAMENT_ID = 'a0000000-0000-0000-0000-000000000001';

// Seed matchups by position in region bracket (1-indexed game number within region)
// Game 1: 1v16, Game 2: 8v9, Game 3: 5v12, Game 4: 4v13
// Game 5: 6v11, Game 6: 3v14, Game 7: 7v10, Game 8: 2v15
const SEED_MATCHUPS: [number, number][] = [
  [1, 16], [8, 9], [5, 12], [4, 13],
  [6, 11], [3, 14], [7, 10], [2, 15],
];

const REGIONS = ['East', 'South', 'West', 'Midwest'] as const;

// Map region to game_number offset (0-indexed region * 15)
function regionOffset(regionIndex: number): number {
  return regionIndex * 15;
}

// Determine round from game position within region (1-15)
function roundForRegionGame(pos: number): number {
  if (pos <= 8) return 1;   // Round of 64
  if (pos <= 12) return 2;  // Round of 32
  if (pos <= 14) return 3;  // Sweet 16
  return 4;                 // Elite 8
}

// Build next_game_id mapping within a region
// R64 games 1-8 feed into R32 games 9-12:
//   1,2 -> 9 | 3,4 -> 10 | 5,6 -> 11 | 7,8 -> 12
// R32 games 9-12 feed into S16 games 13-14:
//   9,10 -> 13 | 11,12 -> 14
// S16 games 13-14 feed into E8 game 15:
//   13,14 -> 15
function nextGameInRegion(pos: number): number | null {
  if (pos <= 8) return 9 + Math.floor((pos - 1) / 2);
  if (pos <= 12) return 13 + Math.floor((pos - 9) / 2);
  if (pos <= 14) return 15;
  return null; // E8 winner goes to Final Four (cross-region)
}

interface EspnTeam {
  id: string;
  location: string;
  abbreviation: string;
  displayName: string;
  logo?: string;
  seed?: string;
}

interface ManualTeam {
  name: string;
  short_name: string;
  seed: number;
  region: string;
  espn_id?: string;
  logo_url?: string;
}

async function fetchEspnTeams(): Promise<ManualTeam[] | null> {
  // Try multiple date ranges around Selection Sunday / first round
  const today = new Date();
  const dates: string[] = [];

  // Generate dates for the tournament window (March 18-24 typically)
  for (let offset = -2; offset <= 7; offset++) {
    const d = new Date(today);
    d.setDate(d.getDate() + offset);
    dates.push(
      `${d.getFullYear()}${String(d.getMonth() + 1).padStart(2, '0')}${String(d.getDate()).padStart(2, '0')}`
    );
  }

  const teams: ManualTeam[] = [];
  const seenEspnIds = new Set<string>();

  for (const dateStr of dates) {
    try {
      const url = `https://site.api.espn.com/apis/site/v2/sports/basketball/mens-college-basketball/scoreboard?dates=${dateStr}&groups=100&limit=100`;
      console.log(`[seed-bracket] Fetching ESPN data for ${dateStr}`);
      const res = await fetch(url, { signal: AbortSignal.timeout(10000) });
      if (!res.ok) continue;

      const data = await res.json();
      const events = data?.events ?? [];

      for (const event of events) {
        const competitions = event?.competitions ?? [];
        for (const comp of competitions) {
          const competitors = comp?.competitors ?? [];
          for (const c of competitors) {
            const team: EspnTeam = c.team;
            const seed = c.curatedRank?.current ?? parseInt(c.seed ?? '0', 10);
            if (!team?.id || seenEspnIds.has(team.id)) continue;
            if (!seed || seed < 1 || seed > 16) continue;

            seenEspnIds.add(team.id);

            // Try to extract region from event name or notes
            let region = '';
            const eventName: string = event.name ?? '';
            const notes: string = (event.competitions?.[0]?.notes?.[0]?.headline ?? '');
            for (const r of REGIONS) {
              if (eventName.includes(r) || notes.includes(r)) {
                region = r;
                break;
              }
            }

            teams.push({
              name: team.displayName ?? team.location,
              short_name: team.abbreviation,
              seed,
              region,
              espn_id: team.id,
              logo_url: team.logo ?? `https://a.espncdn.com/i/teamlogos/ncaa/500/${team.id}.png`,
            });
          }
        }
      }
    } catch (err) {
      console.warn(`[seed-bracket] ESPN fetch failed for ${dateStr}:`, err);
    }
  }

  // Also try the header endpoint for bracket data
  if (teams.length < 64) {
    try {
      const headerUrl =
        'https://site.api.espn.com/apis/v2/scoreboard/header?sport=basketball&league=mens-college-basketball';
      console.log('[seed-bracket] Trying ESPN header endpoint');
      const res = await fetch(headerUrl, { signal: AbortSignal.timeout(10000) });
      if (res.ok) {
        const data = await res.json();
        const events = data?.sports?.[0]?.leagues?.[0]?.events ?? [];
        for (const event of events) {
          const competitors = event?.competitors ?? [];
          for (const c of competitors) {
            if (seenEspnIds.has(c.id)) continue;
            const seed = parseInt(c.seed ?? '0', 10);
            if (!seed || seed < 1 || seed > 16) continue;

            seenEspnIds.add(c.id);
            teams.push({
              name: c.displayName ?? c.name,
              short_name: c.abbreviation ?? c.shortName,
              seed,
              region: '',
              espn_id: c.id,
              logo_url: c.logo ?? `https://a.espncdn.com/i/teamlogos/ncaa/500/${c.id}.png`,
            });
          }
        }
      }
    } catch (err) {
      console.warn('[seed-bracket] ESPN header fetch failed:', err);
    }
  }

  if (teams.length >= 64) {
    return teams.slice(0, 68); // Could have play-in teams; take what we get
  }

  console.log(`[seed-bracket] Only found ${teams.length} teams from ESPN (need 64)`);
  return null;
}

export async function POST(request: NextRequest) {
  try {
    // Ensure tournament exists
    const { data: tournament } = await supabase
      .from('tournaments')
      .select('id')
      .eq('id', TOURNAMENT_ID)
      .single();

    if (!tournament) {
      // Create it
      const { error: tErr } = await supabase.from('tournaments').upsert({
        id: TOURNAMENT_ID,
        name: "2026 NCAA Men's Tournament",
        lock_time: '2026-03-19T12:15:00-04:00',
      });
      if (tErr) {
        console.error('[seed-bracket] Failed to create tournament:', tErr);
        return NextResponse.json({ error: 'Failed to create tournament', details: tErr.message }, { status: 500 });
      }
    }

    // Try ESPN first, fall back to manual body
    let teams: ManualTeam[];
    let source: string;

    const espnTeams = await fetchEspnTeams();
    if (espnTeams && espnTeams.length >= 64) {
      teams = espnTeams;
      source = 'espn';
      console.log(`[seed-bracket] Using ${teams.length} teams from ESPN`);
    } else {
      // Try manual JSON body
      let body: { teams?: ManualTeam[] } = {};
      try {
        body = await request.json();
      } catch {
        // No body provided
      }

      if (!body.teams || body.teams.length === 0) {
        return NextResponse.json(
          {
            error: 'ESPN data not available and no manual teams provided',
            hint: 'POST with body: { "teams": [{ "name": "Duke", "short_name": "DUKE", "seed": 1, "region": "East", "espn_id": "150" }, ...] }',
            espn_teams_found: espnTeams?.length ?? 0,
          },
          { status: 400 }
        );
      }

      teams = body.teams;
      source = 'manual';
      console.log(`[seed-bracket] Using ${teams.length} manually provided teams`);
    }

    // Validate: need exactly 4 regions with 16 teams each (or at least 64 total)
    const regionTeams: Record<string, ManualTeam[]> = {};
    for (const r of REGIONS) {
      regionTeams[r] = teams.filter((t) => t.region === r);
    }

    const regionCounts = REGIONS.map((r) => regionTeams[r].length);
    if (regionCounts.some((c) => c !== 16)) {
      // If regions aren't assigned, we can't build the bracket properly
      const assigned = teams.filter((t) => REGIONS.includes(t.region as typeof REGIONS[number]));
      if (assigned.length < 64) {
        return NextResponse.json(
          {
            error: 'Teams must have valid regions (East, South, West, Midwest) with 16 teams each',
            region_counts: Object.fromEntries(REGIONS.map((r) => [r, regionTeams[r].length])),
            total_with_region: assigned.length,
          },
          { status: 400 }
        );
      }
    }

    // Upsert teams
    const teamRows = teams.map((t) => ({
      tournament_id: TOURNAMENT_ID,
      name: t.name,
      short_name: t.short_name,
      seed: t.seed,
      region: t.region,
      logo_url: t.logo_url ?? null,
      espn_id: t.espn_id ?? null,
      eliminated: false,
    }));

    // Delete existing teams/games for clean re-seed
    await supabase.from('picks').delete().eq('tournament_id', TOURNAMENT_ID);
    await supabase.from('games').delete().eq('tournament_id', TOURNAMENT_ID);
    await supabase.from('teams').delete().eq('tournament_id', TOURNAMENT_ID);

    const { data: insertedTeams, error: teamErr } = await supabase
      .from('teams')
      .insert(teamRows)
      .select('id, name, seed, region, espn_id');

    if (teamErr || !insertedTeams) {
      console.error('[seed-bracket] Team insert error:', teamErr);
      return NextResponse.json({ error: 'Failed to insert teams', details: teamErr?.message }, { status: 500 });
    }

    // Build lookup: region -> seed -> team_id
    const teamLookup: Record<string, Record<number, string>> = {};
    for (const t of insertedTeams) {
      if (!teamLookup[t.region]) teamLookup[t.region] = {};
      teamLookup[t.region][t.seed] = t.id;
    }

    // Build all 63 games
    // Phase 1: Create games without next_game_id (need IDs first)
    interface GameRow {
      tournament_id: string;
      round: number;
      region: string | null;
      game_number: number;
      team_a_id: string | null;
      team_b_id: string | null;
      status: string;
    }

    const gameRows: GameRow[] = [];

    // Region games (1-60)
    for (let ri = 0; ri < REGIONS.length; ri++) {
      const region = REGIONS[ri];
      const offset = regionOffset(ri);

      for (let pos = 1; pos <= 15; pos++) {
        const gameNumber = offset + pos;
        const round = roundForRegionGame(pos);

        let teamAId: string | null = null;
        let teamBId: string | null = null;

        // Only R64 games (pos 1-8) get teams assigned initially
        if (pos <= 8) {
          const [seedA, seedB] = SEED_MATCHUPS[pos - 1];
          teamAId = teamLookup[region]?.[seedA] ?? null;
          teamBId = teamLookup[region]?.[seedB] ?? null;
        }

        gameRows.push({
          tournament_id: TOURNAMENT_ID,
          round,
          region,
          game_number: gameNumber,
          team_a_id: teamAId,
          team_b_id: teamBId,
          status: 'upcoming',
        });
      }
    }

    // Final Four games (61-62) - round 5
    gameRows.push({
      tournament_id: TOURNAMENT_ID,
      round: 5,
      region: null,
      game_number: 61,
      team_a_id: null, // East E8 winner
      team_b_id: null, // South E8 winner (historically; assignment may vary)
      status: 'upcoming',
    });
    gameRows.push({
      tournament_id: TOURNAMENT_ID,
      round: 5,
      region: null,
      game_number: 62,
      team_a_id: null, // West E8 winner
      team_b_id: null, // Midwest E8 winner
      status: 'upcoming',
    });

    // Championship game (63) - round 6
    gameRows.push({
      tournament_id: TOURNAMENT_ID,
      round: 6,
      region: null,
      game_number: 63,
      team_a_id: null,
      team_b_id: null,
      status: 'upcoming',
    });

    const { data: insertedGames, error: gameErr } = await supabase
      .from('games')
      .insert(gameRows)
      .select('id, game_number');

    if (gameErr || !insertedGames) {
      console.error('[seed-bracket] Game insert error:', gameErr);
      return NextResponse.json({ error: 'Failed to insert games', details: gameErr?.message }, { status: 500 });
    }

    // Build game_number -> id lookup
    const gameIdLookup: Record<number, string> = {};
    for (const g of insertedGames) {
      gameIdLookup[g.game_number] = g.id;
    }

    // Phase 2: Update next_game_id for all games
    const updates: { id: string; next_game_id: string }[] = [];

    // Region games: within-region next_game_id
    for (let ri = 0; ri < REGIONS.length; ri++) {
      const offset = regionOffset(ri);
      for (let pos = 1; pos <= 14; pos++) {
        const gameNumber = offset + pos;
        const nextPos = nextGameInRegion(pos);
        if (nextPos !== null) {
          const nextGameNumber = offset + nextPos;
          updates.push({
            id: gameIdLookup[gameNumber],
            next_game_id: gameIdLookup[nextGameNumber],
          });
        }
      }
    }

    // Elite 8 winners (pos 15 in each region) -> Final Four
    // East (game 15) -> Game 61 | South (game 30) -> Game 61
    // West (game 45) -> Game 62 | Midwest (game 60) -> Game 62
    const e8ToFf: Record<number, number> = {
      15: 61,  // East E8 -> FF game 1
      30: 61,  // South E8 -> FF game 1
      45: 62,  // West E8 -> FF game 2
      60: 62,  // Midwest E8 -> FF game 2
    };

    for (const [fromGame, toGame] of Object.entries(e8ToFf)) {
      updates.push({
        id: gameIdLookup[parseInt(fromGame)],
        next_game_id: gameIdLookup[toGame],
      });
    }

    // Final Four -> Championship
    updates.push({ id: gameIdLookup[61], next_game_id: gameIdLookup[63] });
    updates.push({ id: gameIdLookup[62], next_game_id: gameIdLookup[63] });

    // Batch update next_game_id
    for (const update of updates) {
      const { error: updateErr } = await supabase
        .from('games')
        .update({ next_game_id: update.next_game_id })
        .eq('id', update.id);

      if (updateErr) {
        console.error(`[seed-bracket] Failed to update next_game_id for game ${update.id}:`, updateErr);
      }
    }

    console.log(`[seed-bracket] Seeded ${insertedTeams.length} teams and ${insertedGames.length} games from ${source}`);

    return NextResponse.json({
      success: true,
      source,
      teams_count: insertedTeams.length,
      games_count: insertedGames.length,
      regions: Object.fromEntries(REGIONS.map((r) => [r, regionTeams[r]?.length ?? 0])),
    });
  } catch (err) {
    console.error('[seed-bracket] Unexpected error:', err);
    return NextResponse.json(
      { error: 'Internal server error', details: String(err) },
      { status: 500 }
    );
  }
}
