export const TOURNAMENT_ID = 'a0000000-0000-0000-0000-000000000001';

export const REGIONS = ['East', 'South', 'West', 'Midwest'] as const;
export type Region = (typeof REGIONS)[number];

export const ROUND_NAMES: Record<number, string> = {
  1: 'Round of 64',
  2: 'Round of 32',
  3: 'Sweet 16',
  4: 'Elite 8',
  5: 'Final Four',
  6: 'Championship',
};

export const GAMES_PER_REGION = 15; // 8 + 4 + 2 + 1
export const TOTAL_GAMES = 63;

// Game number ranges per region (1-indexed)
// East: 1-15, South: 16-30, West: 31-45, Midwest: 46-60
// Final Four: 61-62, Championship: 63
export function getRegionGameRange(region: Region): [number, number] {
  const idx = REGIONS.indexOf(region);
  return [idx * GAMES_PER_REGION + 1, (idx + 1) * GAMES_PER_REGION];
}

export function getGameRegion(gameNumber: number): Region | 'Final Four' {
  if (gameNumber >= 61) return 'Final Four';
  const idx = Math.floor((gameNumber - 1) / GAMES_PER_REGION);
  return REGIONS[idx];
}

export function getGameRound(gameNumber: number): number {
  if (gameNumber === 63) return 6;
  if (gameNumber >= 61) return 5;
  const inRegion = ((gameNumber - 1) % GAMES_PER_REGION);
  if (inRegion < 8) return 1;
  if (inRegion < 12) return 2;
  if (inRegion < 14) return 3;
  return 4;
}

// For a game in round R at position P within its region,
// the next game (in round R+1) that the winner feeds into
export function getNextGameNumber(gameNumber: number): number | null {
  if (gameNumber === 63) return null; // Championship has no next game

  if (gameNumber >= 61) return 63; // Final Four winners go to championship

  const regionOffset = Math.floor((gameNumber - 1) / GAMES_PER_REGION) * GAMES_PER_REGION;
  const inRegion = (gameNumber - 1) % GAMES_PER_REGION;

  if (inRegion < 8) {
    // Round 1 -> Round 2
    return regionOffset + 8 + Math.floor(inRegion / 2) + 1;
  }
  if (inRegion < 12) {
    // Round 2 -> Sweet 16
    return regionOffset + 12 + Math.floor((inRegion - 8) / 2) + 1;
  }
  if (inRegion < 14) {
    // Sweet 16 -> Elite 8
    return regionOffset + 14 + Math.floor((inRegion - 12) / 2) + 1;
  }
  // Elite 8 -> Final Four
  // East(15) & South(30) -> game 61, West(45) & Midwest(60) -> game 62
  if (regionOffset < 30) return 61;
  return 62;
}

// Get the two feeder game numbers for a given game
export function getFeederGames(gameNumber: number): [number, number] | null {
  if (gameNumber === 63) return [61, 62];

  if (gameNumber === 61) return [15, 30]; // East & South champions
  if (gameNumber === 62) return [45, 60]; // West & Midwest champions

  const regionOffset = Math.floor((gameNumber - 1) / GAMES_PER_REGION) * GAMES_PER_REGION;
  const inRegion = (gameNumber - 1) % GAMES_PER_REGION;

  if (inRegion < 8) return null; // Round 1 games have no feeders (teams are seeded)

  if (inRegion < 12) {
    // Round 2: fed by two Round 1 games
    const base = (inRegion - 8) * 2;
    return [regionOffset + base + 1, regionOffset + base + 2];
  }
  if (inRegion < 14) {
    // Sweet 16: fed by two Round 2 games
    const base = 8 + (inRegion - 12) * 2;
    return [regionOffset + base + 1, regionOffset + base + 2];
  }
  // Elite 8: fed by two Sweet 16 games
  const base = 12 + (inRegion - 14) * 2;
  return [regionOffset + base + 1, regionOffset + base + 2];
}
