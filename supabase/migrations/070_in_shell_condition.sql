-- Homebrew condition for Tortle Shell Defense (applied via combat feature effects).

INSERT INTO public.conditions (slug, name, description, is_standard, source) VALUES
  (
    'in-shell',
    'In Shell',
    $desc$Withdrawn into your shell (Shell Defense).
• +4 AC
• Speed 0
• Advantage on Strength and Constitution saving throws
• Disadvantage on Dexterity saving throws
• Cannot take reactions
• Can only use Emerge from Shell (bonus action) until you emerge$desc$,
    false,
    'Tortle'
  )
ON CONFLICT (slug) DO NOTHING;
