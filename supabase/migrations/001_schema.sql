-- Wyllie March Madness - Database Schema
-- Run this in Supabase SQL Editor (Dashboard > SQL Editor > New Query)

-- 1. Profiles table (extends auth.users)
CREATE TABLE IF NOT EXISTS public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  display_name TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 2. Tournaments table
CREATE TABLE IF NOT EXISTS public.tournaments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  lock_time TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 3. Teams table
CREATE TABLE IF NOT EXISTS public.teams (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tournament_id UUID NOT NULL REFERENCES public.tournaments(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  short_name TEXT NOT NULL,
  seed INT NOT NULL CHECK (seed BETWEEN 1 AND 16),
  region TEXT NOT NULL,
  logo_url TEXT,
  espn_id TEXT,
  eliminated BOOLEAN DEFAULT FALSE
);

-- 4. Games table
CREATE TABLE IF NOT EXISTS public.games (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tournament_id UUID NOT NULL REFERENCES public.tournaments(id) ON DELETE CASCADE,
  round INT NOT NULL CHECK (round BETWEEN 1 AND 6),
  region TEXT,
  game_number INT NOT NULL,
  team_a_id UUID REFERENCES public.teams(id),
  team_b_id UUID REFERENCES public.teams(id),
  winner_id UUID REFERENCES public.teams(id),
  score_a INT,
  score_b INT,
  status TEXT NOT NULL DEFAULT 'upcoming' CHECK (status IN ('upcoming', 'live', 'final')),
  start_time TIMESTAMPTZ,
  espn_game_id TEXT,
  next_game_id UUID REFERENCES public.games(id),
  UNIQUE(tournament_id, game_number)
);

-- 5. Picks table
CREATE TABLE IF NOT EXISTS public.picks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  tournament_id UUID NOT NULL REFERENCES public.tournaments(id) ON DELETE CASCADE,
  game_number INT NOT NULL,
  team_id UUID NOT NULL REFERENCES public.teams(id),
  points_earned INT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, tournament_id, game_number)
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_teams_tournament ON public.teams(tournament_id);
CREATE INDEX IF NOT EXISTS idx_teams_espn ON public.teams(espn_id);
CREATE INDEX IF NOT EXISTS idx_games_tournament ON public.games(tournament_id);
CREATE INDEX IF NOT EXISTS idx_games_status ON public.games(status);
CREATE INDEX IF NOT EXISTS idx_games_espn ON public.games(espn_game_id);
CREATE INDEX IF NOT EXISTS idx_picks_user ON public.picks(user_id);
CREATE INDEX IF NOT EXISTS idx_picks_tournament ON public.picks(tournament_id);
CREATE INDEX IF NOT EXISTS idx_picks_game ON public.picks(tournament_id, game_number);

-- Auto-create profile on signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (id)
  VALUES (NEW.id);
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- Updated_at trigger for picks
CREATE OR REPLACE FUNCTION public.update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS picks_updated_at ON public.picks;
CREATE TRIGGER picks_updated_at
  BEFORE UPDATE ON public.picks
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();
