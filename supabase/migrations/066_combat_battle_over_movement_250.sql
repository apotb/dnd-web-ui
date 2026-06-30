-- Battle over movement cap: 250 ft per move.

CREATE OR REPLACE FUNCTION public.combat_battle_over_movement_cap_ft()
RETURNS INTEGER
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT 250;
$$;
