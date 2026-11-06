-- One AI world switch per sport (D208): Admin -> Sports' AI world switch
-- (sport_settings.ai_enabled) is now the only one. If the old switch in
-- Admin -> AI clubs (ai_settings.enabled) was off, the sport's AI world
-- starts off too, so no AI club starts playing by surprise. The old column
-- stays, unused, until a later cleanup.
UPDATE public.sport_settings s
SET ai_enabled = s.ai_enabled AND a.enabled
FROM public.ai_settings a
WHERE a.sport = s.sport;
