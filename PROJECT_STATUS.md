# Wyllie March Madness — Project Status

> **Read this first.** Full spec is in `wyllie-march-madness-spec.md`.

## Current State: BUILT — Needs polish + deployment

The entire app is built, compiles clean (zero TS/ESLint errors), and the database is live with the 2026 bracket seeded from ESPN.

---

## Tech Stack
- **Next.js 14** (App Router) + **Tailwind CSS** + **TypeScript**
- **Supabase** (Postgres + Auth via email OTP)
- **ESPN scoreboard API** for live scores
- Dark theme, mobile-first, orange accent (#f97316)

## Quick Start
```bash
cd /Users/main/dev/personal/march-madness-site
npm run dev    # http://localhost:3000
```

---

## Supabase Details
- **Project ID:** tytfmfdfocqhhrczizmi
- **URL:** https://tytfmfdfocqhhrczizmi.supabase.co
- **Region:** West US (Oregon)
- **Keys:** in `.env.local` (NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_ANON_KEY, SUPABASE_SERVICE_ROLE_KEY)
- **Key format:** `sb_publishable_...` and `sb_secret_...` (newer Supabase format, NOT JWT)
- **Tournament ID constant:** `a0000000-0000-0000-0000-000000000001`
- **CLI:** `npx supabase db query --linked "SQL HERE"` (already linked, authenticated)
- **DB pooler connection DOES NOT WORK** ("Tenant or user not found") — use CLI instead

## Database State
- Schema: APPLIED (profiles, tournaments, teams, games, picks + RLS + triggers)
- Tournament: SEEDED ("2026 NCAA Men's Tournament", lock_time: March 19 2026 12:15 PM ET)
- Teams: 68 teams from ESPN (16 per region + play-in extras)
- Games: 63 games created with correct seed matchups and next_game_id linking
- Migrations in: `supabase/migrations/001_schema.sql`, `002_rls.sql`, `003_seed_tournament.sql`

---

## File Structure
```
src/
├── app/
│   ├── layout.tsx              # Root layout (Geist font, dark bg)
│   ├── page.tsx                # Redirect to /picks
│   ├── login/
│   │   ├── layout.tsx          # Bare layout (no nav)
│   │   └── page.tsx            # Email OTP login flow
│   ├── set-name/
│   │   └── page.tsx            # First-login display name prompt
│   ├── auth/callback/
│   │   └── route.ts            # Auth code exchange
│   ├── (main)/
│   │   ├── layout.tsx          # TopNav + BottomTabs wrapper
│   │   ├── picks/page.tsx      # Bracket picker (region tabs, cascading picks)
│   │   ├── games/page.tsx      # Live/upcoming/completed games
│   │   ├── leaderboard/page.tsx # Rankings table
│   │   └── settings/page.tsx   # Display name + logout
│   └── api/
│       ├── seed-bracket/route.ts  # POST: fetch ESPN teams, create 63 games
│       ├── sync-scores/route.ts   # GET: fetch ESPN scores, update games, score picks
│       └── setup-db/route.ts      # POST: health check (verify tables exist)
├── components/
│   ├── TopNav.tsx              # Sticky header + desktop nav
│   └── BottomTabs.tsx          # Mobile bottom tab bar
├── lib/
│   ├── constants.ts            # Tournament ID, bracket math, game numbering
│   ├── hooks.ts                # All data hooks (useUser, useTeams, useGames, etc.)
│   └── supabase/
│       ├── client.ts           # Browser client (createBrowserClient)
│       ├── server.ts           # Server client (cookies)
│       ├── admin.ts            # Service role client
│       └── middleware.ts       # Session refresh + auth redirect
├── middleware.ts               # Next.js middleware entry
└── types/
    └── database.ts             # TS types for all tables
```

## Game Numbering System (IMPORTANT)
- **East:** games 1-15 (R64: 1-8, R32: 9-12, S16: 13-14, E8: 15)
- **South:** games 16-30 (same pattern offset by 15)
- **West:** games 31-45
- **Midwest:** games 46-60
- **Final Four:** games 61-62 (East/South champ -> 61, West/Midwest champ -> 62)
- **Championship:** game 63
- See `src/lib/constants.ts` for all bracket math functions

## Bracket Seeding (Round of 64 matchups per region)
Game 1: 1v16, Game 2: 8v9, Game 3: 5v12, Game 4: 4v13, Game 5: 6v11, Game 6: 3v14, Game 7: 7v10, Game 8: 2v15

---

## What's Done (all building + compiling clean)
1. ✅ Next.js project with Tailwind dark theme
2. ✅ Supabase schema + RLS + triggers (applied to live DB)
3. ✅ Auth flow (email OTP login, set-name, middleware protection)
4. ✅ Bracket picker with region tabs, pick cascading, submit/edit
5. ✅ ESPN scraper + scoring engine (API routes)
6. ✅ Leaderboard with points + possible points
7. ✅ Games page with live/upcoming/completed + expandable pick details
8. ✅ Settings page (display name + logout)
9. ✅ Navigation (top bar + mobile bottom tabs + desktop nav)
10. ✅ Tournament seeded from live ESPN data (68 teams, 63 games)

## What Still Needs To Be Done
### Required before sharing with family
1. **Enable email auth in Supabase dashboard** — go to Authentication > Providers > Email, enable OTP
2. **ESPN game ID matching** — the `espn_game_id` column on games is currently NULL. When tournament starts, need to match our games to ESPN's game IDs so sync-scores can update them. Could be done by matching team ESPN IDs in both our games and ESPN events.
3. **Set up score sync cron** — call GET `/api/sync-scores` on a schedule (every 60s during games). Options: Vercel Cron, external cron service, or a simple setInterval in a long-running process.
4. **Deploy to Vercel** — `vercel` CLI or connect to GitHub

### Nice to have (from spec, not yet built)
- "My Best Picks" section on /picks (picks sorted by potential points)
- Points animation when scores update
- Tap leaderboard row to view that person's bracket
- Supabase Realtime subscriptions (currently using 30s polling)
- Lock indicator countdown on /picks

### Known Issues / Gotchas
- **Service role key** (`sb_secret_...`) doesn't work with Supabase REST API directly (returns "Expected 3 parts in JWT"), but works fine through the `@supabase/supabase-js` client library
- **DB pooler connection** fails with "Tenant or user not found" — always use `npx supabase db query --linked` for raw SQL
- **ESPN team count:** 68 teams seeded (includes play-in teams), but only 16 per region are used in game matchups. The extras are harmless.
- **sync-scores currently returns 0 matches** because espn_game_id isn't set on our games yet. The scraper needs to be enhanced to match by team ESPN IDs as a fallback, or espn_game_id needs to be populated manually/via a matching script once games start.

---

## Environment Variables (.env.local)
```
NEXT_PUBLIC_SUPABASE_URL=https://tytfmfdfocqhhrczizmi.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=sb_publishable_...
SUPABASE_SERVICE_ROLE_KEY=sb_secret_...
```
Also `.env` has DB_PASSWORD, DB_ID, DB_NAME, PUBLISHABLE_KEY, SB_SECRET from old project.
