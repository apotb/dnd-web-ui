-- Enemy portraits are uploaded via DM admin (combat-content storage), not bundled static files.

UPDATE public.enemies
SET data = data - 'portraitPath'
WHERE data->>'portraitPath' LIKE '/seed/%';
