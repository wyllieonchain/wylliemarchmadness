-- Seed the 2026 NCAA Tournament
-- Lock time: Thursday March 19, 2026 12:15 PM ET

INSERT INTO public.tournaments (id, name, lock_time)
VALUES (
  'a0000000-0000-0000-0000-000000000001',
  '2026 NCAA Men''s Tournament',
  '2026-03-19T12:15:00-04:00'
) ON CONFLICT DO NOTHING;

-- Note: Teams will be seeded via the ESPN scraper API route or manually
-- once Selection Sunday results are announced.
-- The /api/seed-bracket endpoint will handle this automatically.
