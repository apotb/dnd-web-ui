-- Grant execute on the opportunity-attack overload of apply_combat_move.

GRANT EXECUTE ON FUNCTION public.apply_combat_move(
  UUID,
  TEXT,
  INTEGER,
  INTEGER,
  INTEGER,
  BOOLEAN,
  TEXT[]
) TO authenticated;
