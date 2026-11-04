-- Energy maximum raised to 6 (D118). Soccer's live setting moves from 3 to 6
-- unless an admin had already set something else; refill stays 15 minutes.
-- Clubs keep the energy they have and refill up to the new maximum.
UPDATE public.sport_settings
SET energy_max = 6, updated_at = now()
WHERE sport = 'soccer' AND energy_max = 3;
