-- Row Level Security Policies

-- Enable RLS on all tables
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tournaments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.teams ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.games ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.picks ENABLE ROW LEVEL SECURITY;

-- Profiles: users can read all profiles, update only their own
CREATE POLICY "Profiles are viewable by all authenticated users"
  ON public.profiles FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Users can update their own profile"
  ON public.profiles FOR UPDATE
  TO authenticated
  USING (auth.uid() = id)
  WITH CHECK (auth.uid() = id);

-- Tournaments: readable by all authenticated users
CREATE POLICY "Tournaments are viewable by all authenticated users"
  ON public.tournaments FOR SELECT
  TO authenticated
  USING (true);

-- Teams: readable by all authenticated users
CREATE POLICY "Teams are viewable by all authenticated users"
  ON public.teams FOR SELECT
  TO authenticated
  USING (true);

-- Games: readable by all authenticated users
CREATE POLICY "Games are viewable by all authenticated users"
  ON public.games FOR SELECT
  TO authenticated
  USING (true);

-- Picks: users can read all picks (for leaderboard/comparison), manage their own
CREATE POLICY "Picks are viewable by all authenticated users"
  ON public.picks FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Users can insert their own picks"
  ON public.picks FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own picks"
  ON public.picks FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete their own picks"
  ON public.picks FOR DELETE
  TO authenticated
  USING (auth.uid() = user_id);
