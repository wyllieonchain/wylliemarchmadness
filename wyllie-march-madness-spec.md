# Wyllie March Madness — Project Spec

## Overview
A family bracket pool app with custom scoring (1pt × winning team's seed per correct pick). ~10 users. Built with Next.js + Supabase. Mobile-first, dark theme.

## Tech Stack
- **Frontend:** Next.js 14 (App Router), Tailwind CSS, TypeScript
- **Backend/DB:** Supabase (Postgres + Auth + Realtime)
- **Auth:** Supabase magic link (email OTP — user enters email, gets a 6-digit code)
- **Data:** ESPN scoreboard scraper on a cron (every 60s during games, less often otherwise)
- **Deployment:** Vercel (frontend) + Supabase hosted

---

## Scoring System

**1 point × winning team's seed** for every correct pick, every round. Flat — no escalation.

Examples:
- Pick 1-seed Duke to beat 16-seed Siena → correct → 1 × 1 = **1 pt**
- Pick 12-seed UNI to beat 5-seed St. John's → correct → 1 × 12 = **12 pts**
- Pick 12-seed UNI to beat 4-seed Kansas (Round 2) → correct → 1 × 12 = **12 pts**

This rewards upset picks heavily. A correct 16-seed champion run would be worth 16 pts × 6 rounds = 96 pts.

**Possible points** = sum of points a user can still earn from their remaining alive picks.

---

## Data Model (Supabase)

### `users`
Handled by Supabase Auth (magic link). Add a `profiles` table:
```
profiles
- id (uuid, FK to auth.users)
- display_name (text, required)
- created_at (timestamptz)
```

### `tournaments`
```
tournaments
- id (uuid, PK)
- name (text) — e.g., "2026 NCAA Men's Tournament"
- lock_time (timestamptz) — Thursday March 19, 2026 12:15 PM ET
- created_at (timestamptz)
```

### `teams`
```
teams
- id (uuid, PK)
- tournament_id (uuid, FK)
- name (text) — e.g., "Duke"
- short_name (text) — e.g., "DUKE"
- seed (int) — 1-16
- region (text) — "East", "South", "West", "Midwest"
- logo_url (text, nullable)
- espn_id (text) — for matching scraper data
- eliminated (boolean, default false)
```

### `games`
```
games
- id (uuid, PK)
- tournament_id (uuid, FK)
- round (int) — 1=Round of 64, 2=Round of 32, 3=Sweet 16, 4=Elite 8, 5=Final Four, 6=Championship
- region (text, nullable) — null for Final Four / Championship
- game_number (int) — position in bracket (1-63)
- team_a_id (uuid, FK to teams, nullable) — null if TBD
- team_b_id (uuid, FK to teams, nullable)
- winner_id (uuid, FK to teams, nullable) — null until game completed
- score_a (int, nullable)
- score_b (int, nullable)
- status (text) — "upcoming", "live", "final"
- start_time (timestamptz, nullable)
- espn_game_id (text, nullable)
- next_game_id (uuid, FK to games, nullable) — winner feeds into this game
```

### `picks`
```
picks
- id (uuid, PK)
- user_id (uuid, FK to profiles)
- tournament_id (uuid, FK)
- game_number (int) — which bracket slot (1-63)
- team_id (uuid, FK to teams) — who they picked to win
- points_earned (int, nullable) — calculated after game completes
- created_at (timestamptz)
- updated_at (timestamptz)

UNIQUE(user_id, tournament_id, game_number)
```

---

## Pages / Routes

### `/` → Redirect to `/picks`

### `/picks` (default, authenticated)

**Before picks submitted:**
- Prompt: "Make your picks before Thursday 12:15 PM ET"
- CTA button → opens bracket picker

**Bracket Picker UI (mobile-first):**
- Tab bar at top: East | South | West | Midwest | Final Four
- Each region shows matchups as cards (like the ESPN screenshots)
- Tap a team to pick them → they advance to next round slot
- Picks flow forward: picking Duke in R1 auto-slots them in R2 matchup
- If user changes a pick, cascade forward (clear downstream picks for that slot)
- "Submit Picks" button at bottom (disabled until all 63 picks made)
- Show pick count: "47/63 picks made"

**After picks submitted:**
- Show completed bracket (read-only) with results overlaid
- Correct picks highlighted green, wrong picks red, pending picks neutral
- "Edit Picks" button (only visible before lock time)
- Below bracket: **"My Best Picks"** section — shows user's picks sorted by potential points (seed × remaining rounds they have that team going), highlighting which teams are still alive

### `/leaderboard`
- Table: Rank | Name | Points | Possible Points
- Sorted by current points, tiebreak by possible points
- Tap a row to see that person's bracket
- Update in near-real-time via Supabase Realtime or polling

### `/games`
- **Live Now:** Cards showing current games with live scores, team logos, seeds
  - Expandable: shows who in the pool picked each team
- **Up Next:** Upcoming games with scheduled time
- **Recent:** Completed games with final scores
- Each game card shows seed matchup and is expandable

### `/settings`
- Display name
- Logout

---

## Navigation
- Top bar: "WYLLIE MARCH MADNESS" (left-aligned or centered, bold)
- Bottom tab bar (mobile): Picks | Games | Leaderboard
- Desktop: top nav links

---

## ESPN Data Scraper

Use ESPN's public scoreboard endpoints to get game data:

```
# Scoreboard (all games for a date)
https://site.api.espn.com/apis/site/v2/sports/basketball/mens-college-basketball/scoreboard?dates=YYYYMMDD&groups=100&limit=50

# Tournament bracket
https://site.api.espn.com/apis/v2/scoreboard/header?sport=basketball&league=mens-college-basketball
```

**Cron schedule:**
- During active games: every 60 seconds
- Between game windows: every 5 minutes
- Off days: every 30 minutes

**Scraper logic:**
1. Fetch scoreboard data
2. Match ESPN game IDs to our `games` table
3. Update scores, status, winner
4. When a game completes → calculate `points_earned` for all picks on that game
5. Update `teams.eliminated` for losing team

Run as a Supabase Edge Function or a simple Node cron job.

---

## Auth Flow

1. User lands on `/` → redirected to `/login`
2. Enter email → Supabase sends magic link / OTP code
3. User enters 6-digit code
4. First login → prompt for display name → save to `profiles`
5. Subsequent logins → straight to `/picks`

---

## Key UX Details

- **Dark theme** (like the ESPN app screenshots — dark background, light text)
- **Mobile-first** — designed for phones, works on desktop
- **Lock indicator:** Show countdown to pick deadline prominently on `/picks`
- **Pick cascading:** When a user picks Team A to win Round 1, Team A appears in their Round 2 matchup. If they later change Round 1 to Team B, all downstream picks involving Team A are cleared
- **Points animation:** When scores update and a pick is correct, briefly flash the points earned
- **Color coding on bracket:** Green = correct, Red = eliminated, Gray = pending, Gold border = high-value pick (seed ≥ 10)

---

## MVP Priorities (ship by Wednesday night)

1. ✅ Supabase schema + auth
2. ✅ Bracket picker UI (mobile-first, region tabs)
3. ✅ Pick submission + storage
4. ✅ ESPN scraper for game results
5. ✅ Scoring engine (1pt × seed)
6. ✅ Leaderboard with points + possible points
7. ✅ Games page with live scores + who picked whom
8. ⬜ Edit picks (before lock)
9. ⬜ "My Best Picks" section
10. ⬜ Real-time updates via Supabase Realtime

---

## Seed Data

The tournament bracket needs to be seeded with all 64 teams (excluding First Four — treat play-in winners as the team that fills the slot). Pull from ESPN bracket data or hardcode from selection results.

---

## Environment Variables

```
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=
ESPN_SCRAPE_INTERVAL=60000
```
