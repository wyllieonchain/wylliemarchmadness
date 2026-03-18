import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

const TABLES = ['profiles', 'tournaments', 'teams', 'games', 'picks'] as const;

export async function POST() {
  try {
    const results: Record<string, { exists: boolean; count: number | null; error?: string }> = {};
    let allExist = true;

    for (const table of TABLES) {
      try {
        const { count, error } = await supabase
          .from(table)
          .select('*', { count: 'exact', head: true });

        if (error) {
          results[table] = { exists: false, count: null, error: error.message };
          allExist = false;
        } else {
          results[table] = { exists: true, count: count ?? 0 };
        }
      } catch (err) {
        results[table] = { exists: false, count: null, error: String(err) };
        allExist = false;
      }
    }

    if (!allExist) {
      const missingTables = Object.entries(results)
        .filter(([, v]) => !v.exists)
        .map(([k]) => k);

      return NextResponse.json({
        status: 'incomplete',
        message: 'Some tables are missing. Run the migration SQL files in the Supabase dashboard.',
        instructions: [
          '1. Go to https://supabase.com/dashboard → select your project',
          '2. Navigate to SQL Editor → New Query',
          '3. Run supabase/migrations/001_schema.sql',
          '4. Run supabase/migrations/002_rls.sql',
          '5. Run supabase/migrations/003_seed_tournament.sql',
          '6. Re-run this endpoint to verify',
        ],
        missing_tables: missingTables,
        tables: results,
      }, { status: 400 });
    }

    return NextResponse.json({
      status: 'ok',
      message: 'All tables exist and are accessible.',
      tables: results,
    });
  } catch (err) {
    console.error('[setup-db] Unexpected error:', err);
    return NextResponse.json(
      { error: 'Internal server error', details: String(err) },
      { status: 500 }
    );
  }
}
