-- Character-creation items: tools, instruments, gaming sets, and common background gear.
-- Sets subcategory on existing tool rows so the creator can query by type.

-- ── Re-tag existing tools ───────────────────────────────────────────────────
UPDATE public.items SET subcategory = 'musical_instrument' WHERE slug = 'lute';
UPDATE public.items SET subcategory = 'explorer_tools', name = 'Navigator''s tools' WHERE slug = 'navigators-tools';
UPDATE public.items SET subcategory = 'kit'                WHERE slug IN (
  'disguise-kit', 'forgery-kit', 'herbalism-kit', 'thieves-tools'
);

INSERT INTO public.items (slug, name, category, subcategory, source, rarity, weight_lb, cost_gp, description, properties) VALUES

-- ── Musical instruments ─────────────────────────────────────────────────────
('bagpipes',      'Bagpipes',      'tool', 'musical_instrument', 'SRD', 'common', 6,   30,  'A set of wind-powered pipes.', '{}'),
('drum',          'Drum',          'tool', 'musical_instrument', 'SRD', 'common', 3,    6,  'A handheld percussion instrument.', '{}'),
('dulcimer',      'Dulcimer',      'tool', 'musical_instrument', 'SRD', 'common', 10,  25,  'A stringed instrument played with hammers.', '{}'),
('flute',         'Flute',         'tool', 'musical_instrument', 'SRD', 'common', 1,    2,  'A woodwind instrument.', '{}'),
('lyre',          'Lyre',          'tool', 'musical_instrument', 'SRD', 'common', 2,   30,  'A small U-shaped stringed instrument.', '{}'),
('horn',          'Horn',          'tool', 'musical_instrument', 'SRD', 'common', 2,    3,  'A brass wind instrument.', '{}'),
('pan-flute',     'Pan flute',     'tool', 'musical_instrument', 'SRD', 'common', 2,   12,  'A set of tuned pipes bound together.', '{}'),
('shawm',         'Shawm',         'tool', 'musical_instrument', 'SRD', 'common', 1,    2,  'A reed instrument with a piercing tone.', '{}'),
('viol',          'Viol',          'tool', 'musical_instrument', 'SRD', 'common', 1,   30,  'A bowed string instrument.', '{}'),

-- ── Artisan's tools ─────────────────────────────────────────────────────────
('alchemists-supplies',    'Alchemist''s supplies',    'tool', 'artisans_tools', 'SRD', 'common', 8,  50, 'Tools for alchemical work.', '{}'),
('brewers-supplies',       'Brewer''s supplies',       'tool', 'artisans_tools', 'SRD', 'common', 9,  20, 'Tools for brewing beer and ale.', '{}'),
('calligraphers-supplies', 'Calligrapher''s supplies', 'tool', 'artisans_tools', 'SRD', 'common', 5,  10, 'Ink, brushes, and parchment for fine writing.', '{}'),
('carpenters-tools',       'Carpenter''s tools',       'tool', 'artisans_tools', 'SRD', 'common', 6,   8, 'Saws, hammers, and nails for woodworking.', '{}'),
('cartographers-tools',    'Cartographer''s tools',    'tool', 'explorer_tools', 'SRD', 'common', 6,  15, 'Compass, calipers, and ink for mapmaking.', '{}'),
('cobblers-tools',         'Cobbler''s tools',         'tool', 'artisans_tools', 'SRD', 'common', 5,   5, 'Awls, knives, and lasts for shoe repair.', '{}'),
('cooks-utensils',         'Cook''s utensils',         'tool', 'artisans_tools', 'SRD', 'common', 8,   1, 'Pots, pans, and utensils for cooking.', '{}'),
('glassblowers-tools',     'Glassblower''s tools',     'tool', 'artisans_tools', 'SRD', 'common', 5,  30, 'Blowpipe and tools for shaping glass.', '{}'),
('jewelers-tools',         'Jeweler''s tools',         'tool', 'artisans_tools', 'SRD', 'common', 2,  25, 'Files, pliers, and lenses for gem work.', '{}'),
('leatherworkers-tools',   'Leatherworker''s tools',   'tool', 'artisans_tools', 'SRD', 'common', 5,   5, 'Knives, awls, and thread for leather.', '{}'),
('masons-tools',           'Mason''s tools',           'tool', 'artisans_tools', 'SRD', 'common', 8,  10, 'Chisels and hammers for stone work.', '{}'),
('painters-supplies',      'Painter''s supplies',      'tool', 'artisans_tools', 'SRD', 'common', 5,  10, 'Paints, brushes, and canvas.', '{}'),
('potters-tools',          'Potter''s tools',          'tool', 'artisans_tools', 'SRD', 'common', 3,  10, 'Clay, wheel tools, and kiln accessories.', '{}'),
('smiths-tools',           'Smith''s tools',           'tool', 'artisans_tools', 'SRD', 'common', 8,  20, 'Hammers, tongs, and an anvil for metalwork.', '{}'),
('tinkers-tools',          'Tinker''s tools',          'tool', 'artisans_tools', 'SRD', 'common', 10, 50, 'Tools for repairing and assembling devices.', '{}'),
('weavers-tools',          'Weaver''s tools',          'tool', 'artisans_tools', 'SRD', 'common', 5,   1, 'Loom parts and thread for weaving cloth.', '{}'),
('woodcarvers-tools',      'Woodcarver''s tools',      'tool', 'artisans_tools', 'SRD', 'common', 5,   1, 'Knives and gouges for carving wood.', '{}'),

-- ── Gaming sets ─────────────────────────────────────────────────────────────
('dice-set',              'Dice set',              'tool', 'gaming_set', 'SRD', 'common', 0, 0.1, 'A set of dice for games of chance.', '{}'),
('dragonchess-set',       'Dragonchess set',       'tool', 'gaming_set', 'SRD', 'common', 0.5, 1, 'A board game popular among nobles.', '{}'),
('playing-card-set',      'Playing card set',      'tool', 'gaming_set', 'SRD', 'common', 0, 0.5, 'A deck of illustrated playing cards.', '{}'),
('three-dragon-ante-set', 'Three-Dragon Ante set', 'tool', 'gaming_set', 'SRD', 'common', 0, 1, 'Cards for the Three-Dragon Ante game.', '{}'),

-- ── Other kits ──────────────────────────────────────────────────────────────
('poisoners-kit', 'Poisoner''s kit', 'tool', 'kit', 'SRD', 'common', 2, 50, 'Vials, chemicals, and tools for crafting poisons.', '{}'),

-- ── Background / starting equipment (adventuring gear) ──────────────────────
('belt-pouch',              'Belt pouch',              'adventuring_gear', null, 'PHB', 'common', 0.5, 0.5, 'A small leather pouch worn on the belt.', '{}'),
('vestments',               'Vestments',               'adventuring_gear', null, 'PHB', 'common', 4,   0, 'Ceremonial religious garments.', '{}'),
('incense-5-sticks',        'Incense (5 sticks)',      'adventuring_gear', null, 'PHB', 'common', 0,   0, 'Five sticks of fragrant incense.', '{}'),
('prayer-book',             'Prayer book',             'adventuring_gear', null, 'PHB', 'common', 5,  25, 'A book of prayers and religious texts.', '{}'),
('prayer-wheel',            'Prayer wheel',            'adventuring_gear', null, 'PHB', 'common', 1,   5, 'A spinning cylinder inscribed with prayers.', '{}'),
('scroll-case-notes',       'Scroll case of notes',    'adventuring_gear', null, 'PHB', 'common', 1,   1, 'A case holding personal notes and writings.', '{}'),
('letter-of-introduction',  'Letter of introduction from guild', 'adventuring_gear', null, 'PHB', 'common', 0, 0, 'A formal letter introducing the bearer to guild members.', '{}'),
('insignia-of-rank',        'Insignia of rank',        'adventuring_gear', null, 'PHB', 'common', 0,   0, 'A badge or emblem showing military rank.', '{}'),
('trophy-enemy',            'Trophy from fallen enemy', 'adventuring_gear', null, 'PHB', 'common', 1,   0, 'A memento taken from a defeated foe.', '{}'),
('trophy-animal',           'Trophy from animal',      'adventuring_gear', null, 'PHB', 'common', 1,   0, 'A trophy from a hunted animal.', '{}'),
('deck-of-cards',           'Deck of cards',           'adventuring_gear', null, 'PHB', 'common', 0,   0, 'A standard deck of playing cards.', '{}'),
('belaying-pin',            'Belaying pin (club)',     'adventuring_gear', null, 'PHB', 'common', 2,   0, 'A wooden pin from a ship''s rigging; counts as a club.', '{}'),
('lucky-charm',             'Lucky charm',             'adventuring_gear', null, 'PHB', 'common', 0,   0, 'A small trinket believed to bring good fortune.', '{}'),
('small-knife',             'Small knife',             'adventuring_gear', null, 'PHB', 'common', 0.5, 0, 'A small utility knife.', '{}'),
('map-hometown',            'Map of hometown',         'adventuring_gear', null, 'PHB', 'common', 0,   0, 'A hand-drawn map of your home settlement.', '{}'),
('pet-mouse',               'Pet mouse',               'adventuring_gear', null, 'PHB', 'common', 0,   0, 'A tiny companion mouse.', '{}'),
('parent-token',            'Token from parents',      'adventuring_gear', null, 'PHB', 'common', 0,   0, 'A keepsake from your parents.', '{}'),
('scroll-pedigree',         'Scroll of pedigree',      'adventuring_gear', null, 'PHB', 'common', 0,   0, 'A document tracing noble lineage.', '{}'),
('purse',                   'Purse',                   'adventuring_gear', null, 'PHB', 'common', 0.5, 0, 'A small coin purse.', '{}'),
('walking-staff',           'Staff',                   'adventuring_gear', null, 'PHB', 'common', 4,   0, 'A sturdy walking staff.', '{}'),
('con-tools',               'Con tools (10 gp)',       'adventuring_gear', null, 'PHB', 'common', 1,  10, 'Props and supplies for confidence tricks.', '{}'),
('letter-dead-colleague',   'Letter from dead colleague', 'adventuring_gear', null, 'PHB', 'common', 0, 0, 'A final letter from a deceased mentor.', '{}'),
('leather-bound-notebook',  'Leather-bound notebook',  'adventuring_gear', null, 'PHB', 'common', 1,   5, 'A notebook bound in leather.', '{}'),
('trinket-special',         'Trinket of special significance', 'adventuring_gear', null, 'PHB', 'common', 0, 0, 'A personally meaningful trinket.', '{}'),
('wooden-case-map',         'Wooden case with map to a ruin', 'adventuring_gear', null, 'PHB', 'common', 2, 0, 'A wooden case containing an old ruin map.', '{}'),
('trinket-dig-site',        'Trinket from dig site',   'adventuring_gear', null, 'PHB', 'common', 0,   0, 'An artifact recovered from an excavation.', '{}'),
('dark-hooded-clothes',     'Dark common clothes with hood', 'adventuring_gear', null, 'PHB', 'common', 3, 0, 'Plain dark clothing with a concealing hood.', '{}'),
('mess-kit',                'Mess kit',                'adventuring_gear', null, 'SRD', 'common', 1, 0.2, 'Tin box with cup and cutlery for eating on the road.', '{}'),
('alms-box',                'Alms box',                'adventuring_gear', null, 'PHB', 'common', 1,   0, 'A small box for collecting charitable donations.', '{}'),
('censer',                  'Censer',                  'adventuring_gear', null, 'PHB', 'common', 1,   0, 'A vessel for burning incense during ceremonies.', '{}'),
('book-of-lore',            'Book of lore',            'adventuring_gear', null, 'PHB', 'common', 5,  25, 'A reference book of historical and arcane knowledge.', '{}'),
('barrel',                  'Barrel',                  'adventuring_gear', null, 'SRD', 'common', 70, 2, 'A wooden barrel.', '{}'),
('basket',                  'Basket',                  'adventuring_gear', null, 'SRD', 'common', 2,  0.4, 'A woven basket.', '{}')

ON CONFLICT (slug) DO UPDATE SET
  name        = EXCLUDED.name,
  category    = EXCLUDED.category,
  subcategory = EXCLUDED.subcategory,
  weight_lb   = EXCLUDED.weight_lb,
  cost_gp     = EXCLUDED.cost_gp,
  description = EXCLUDED.description,
  properties  = EXCLUDED.properties,
  updated_at  = now();
