export type Profile = {
  id: string;
  display_name: string;
  created_at: string;
};

export type Tournament = {
  id: string;
  name: string;
  lock_time: string;
  created_at: string;
};

export type Team = {
  id: string;
  tournament_id: string;
  name: string;
  short_name: string;
  seed: number;
  region: string;
  logo_url: string | null;
  espn_id: string;
  eliminated: boolean;
};

export type Game = {
  id: string;
  tournament_id: string;
  round: number;
  region: string | null;
  game_number: number;
  team_a_id: string | null;
  team_b_id: string | null;
  winner_id: string | null;
  score_a: number | null;
  score_b: number | null;
  status: 'upcoming' | 'live' | 'final';
  status_detail: string | null;
  finished_at: string | null;
  start_time: string | null;
  espn_game_id: string | null;
  next_game_id: string | null;
};

export type Pick = {
  id: string;
  user_id: string;
  tournament_id: string;
  game_number: number;
  team_id: string;
  points_earned: number | null;
  created_at: string;
  updated_at: string;
};

// Extended types with joins
export type GameWithTeams = Game & {
  team_a: Team | null;
  team_b: Team | null;
  winner: Team | null;
};

export type PickWithTeam = Pick & {
  team: Team;
};

export type LeaderboardEntry = {
  user_id: string;
  display_name: string;
  total_points: number;
  possible_points: number;
  correct_picks: number;
  total_picks: number;
};
