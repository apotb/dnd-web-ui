-- PostgREST cannot disambiguate the 6- and 7-argument overloads when the last arg has a default.

DROP FUNCTION IF EXISTS public.apply_combat_move(UUID, TEXT, INTEGER, INTEGER, INTEGER, BOOLEAN);

GRANT EXECUTE ON FUNCTION public.apply_combat_move(
  UUID,
  TEXT,
  INTEGER,
  INTEGER,
  INTEGER,
  BOOLEAN,
  TEXT[]
) TO authenticated;
