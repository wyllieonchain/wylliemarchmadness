'use client';

import { useEffect, useState, useCallback } from 'react';
import { createBrowserClient } from '@supabase/ssr';
import type { User } from '@supabase/supabase-js';
import type { Profile, Tournament, Team, Game, Pick } from '@/types/database';
import { TOURNAMENT_ID } from '@/lib/constants';

function useSupabase() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );
}

export function useUser() {
  const supabase = useSupabase();
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      setUser(data.user);
      setLoading(false);
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null);
    });

    return () => subscription.unsubscribe();
  }, [supabase]);

  return { user, loading };
}

export function useProfile(userId: string | undefined) {
  const supabase = useSupabase();
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!userId) { setLoading(false); return; }
    supabase
      .from('profiles')
      .select('*')
      .eq('id', userId)
      .single()
      .then(({ data }) => {
        setProfile(data as Profile | null);
        setLoading(false);
      });
  }, [userId, supabase]);

  return { profile, loading };
}

export function useTournament() {
  const supabase = useSupabase();
  const [tournament, setTournament] = useState<Tournament | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    supabase
      .from('tournaments')
      .select('*')
      .eq('id', TOURNAMENT_ID)
      .single()
      .then(({ data }) => {
        setTournament(data as Tournament | null);
        setLoading(false);
      });
  }, [supabase]);

  return { tournament, loading };
}

export function useTeams() {
  const supabase = useSupabase();
  const [teams, setTeams] = useState<Team[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    supabase
      .from('teams')
      .select('*')
      .eq('tournament_id', TOURNAMENT_ID)
      .order('region')
      .order('seed')
      .then(({ data }) => {
        setTeams((data as Team[]) || []);
        setLoading(false);
      });
  }, [supabase]);

  return { teams, loading };
}

export function useGames() {
  const supabase = useSupabase();
  const [games, setGames] = useState<Game[]>([]);
  const [loading, setLoading] = useState(true);

  const refetch = useCallback(() => {
    supabase
      .from('games')
      .select('*')
      .eq('tournament_id', TOURNAMENT_ID)
      .order('game_number')
      .then(({ data }) => {
        setGames((data as Game[]) || []);
        setLoading(false);
      });
  }, [supabase]);

  useEffect(() => {
    refetch();
    // Poll every 30s for live updates
    const interval = setInterval(refetch, 30000);
    return () => clearInterval(interval);
  }, [refetch]);

  return { games, loading, refetch };
}

export function useUserPicks(userId: string | undefined) {
  const supabase = useSupabase();
  const [picks, setPicks] = useState<Pick[]>([]);
  const [loading, setLoading] = useState(true);

  const refetch = useCallback(() => {
    if (!userId) { setLoading(false); return; }
    supabase
      .from('picks')
      .select('*')
      .eq('user_id', userId)
      .eq('tournament_id', TOURNAMENT_ID)
      .order('game_number')
      .then(({ data }) => {
        setPicks((data as Pick[]) || []);
        setLoading(false);
      });
  }, [userId, supabase]);

  useEffect(() => { refetch(); }, [refetch]);

  return { picks, loading, refetch };
}

export function useAllPicks() {
  const supabase = useSupabase();
  const [picks, setPicks] = useState<Pick[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    supabase
      .from('picks')
      .select('*')
      .eq('tournament_id', TOURNAMENT_ID)
      .then(({ data }) => {
        setPicks((data as Pick[]) || []);
        setLoading(false);
      });
  }, [supabase]);

  return { picks, loading };
}

export function useLeaderboard() {
  const supabase = useSupabase();
  const [leaderboard, setLeaderboard] = useState<Array<{
    user_id: string;
    display_name: string;
    total_points: number;
    possible_points: number;
    correct_picks: number;
  }>>([]);
  const [loading, setLoading] = useState(true);

  const refetch = useCallback(async () => {
    // Fetch all picks with team info
    const { data: picks } = await supabase
      .from('picks')
      .select('*, team:teams(*)')
      .eq('tournament_id', TOURNAMENT_ID);

    // Fetch all profiles
    const { data: profiles } = await supabase
      .from('profiles')
      .select('*');

    // Fetch all games
    const { data: games } = await supabase
      .from('games')
      .select('*')
      .eq('tournament_id', TOURNAMENT_ID);

    if (!picks || !profiles || !games) { setLoading(false); return; }

    const profileMap = new Map((profiles as Profile[]).map(p => [p.id, p]));

    // Group picks by user
    const userPicks = new Map<string, Array<{ pick: Pick; team: Team }>>();
    for (const p of picks as Array<Pick & { team: Team }>) {
      if (!userPicks.has(p.user_id)) userPicks.set(p.user_id, []);
      userPicks.get(p.user_id)!.push({ pick: p, team: p.team });
    }

    const gamesArr = games as Game[];

    // Start from ALL profiles so everyone shows up, even without picks
    const board = (profiles as Profile[]).map(profile => {
      const userPickList = userPicks.get(profile.id) || [];
      let totalPoints = 0;
      let possiblePoints = 0;
      let correctPicks = 0;

      for (const { pick, team } of userPickList) {
        const game = gamesArr.find(g => g.game_number === pick.game_number);
        const isFinal = game?.status === 'final';

        if (pick.points_earned !== null && pick.points_earned > 0) {
          totalPoints += pick.points_earned;
          correctPicks++;
        }

        // Possible = earned points from final games + seed for future games with alive teams
        if (isFinal) {
          if (pick.points_earned && pick.points_earned > 0) {
            possiblePoints += pick.points_earned;
          }
        } else if (!team.eliminated) {
          possiblePoints += team.seed;
        }
      }

      return {
        user_id: profile.id,
        display_name: profile.display_name || 'Unknown',
        total_points: totalPoints,
        possible_points: possiblePoints,
        correct_picks: correctPicks,
      };
    });

    board.sort((a, b) => b.total_points - a.total_points || b.possible_points - a.possible_points);
    setLeaderboard(board);
    setLoading(false);
  }, [supabase]);

  useEffect(() => {
    refetch();
    const interval = setInterval(refetch, 30000);
    return () => clearInterval(interval);
  }, [refetch]);

  return { leaderboard, loading, refetch };
}
