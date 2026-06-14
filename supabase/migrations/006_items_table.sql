-- Item catalog: shared across all campaigns. DMs can add/edit/remove.
-- Players can browse but not modify.

CREATE TABLE public.items (
  id          UUID    PRIMARY KEY DEFAULT gen_random_uuid(),
  slug        TEXT    NOT NULL UNIQUE,
  name        TEXT    NOT NULL,
  category    TEXT    NOT NULL DEFAULT 'other'
                      CHECK (category IN (
                        'weapon','armor','shield','adventuring_gear','tool',
                        'ammunition','focus','pack','mount_vehicle',
                        'trade_goods','magic_item','other'
                      )),
  subcategory TEXT,   -- e.g. 'simple_melee','martial_ranged','light_armor'
  source      TEXT    NOT NULL DEFAULT 'SRD',
  rarity      TEXT    NOT NULL DEFAULT 'common'
                      CHECK (rarity IN (
                        'common','uncommon','rare','very_rare',
                        'legendary','artifact','varies'
                      )),
  weight_lb   DECIMAL(10,4),
  cost_gp     DECIMAL(10,4),
  description TEXT    NOT NULL DEFAULT '',
  properties  JSONB   NOT NULL DEFAULT '{}',
  -- weapons: { damage, damageType, versatileDamage, weaponCategory,
  --            weaponRange, weaponProperties[], rangeNormal, rangeLong,
  --            throwRangeNormal, throwRangeLong }
  -- armor:   { armorType, armorClass, dexBonus, maxDexBonus,
  --            strengthRequirement, stealthDisadvantage }
  -- magic:   { requiresAttunement, attunementClasses[] }
  requires_attunement BOOLEAN NOT NULL DEFAULT false,
  is_magic            BOOLEAN NOT NULL DEFAULT false,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_items_slug     ON public.items(slug);
CREATE INDEX idx_items_category ON public.items(category);
CREATE INDEX idx_items_name     ON public.items USING gin(to_tsvector('english', name));

CREATE TRIGGER items_updated_at
  BEFORE UPDATE ON public.items
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ---------------------------------------------------------------------------
-- RLS
-- ---------------------------------------------------------------------------

ALTER TABLE public.items ENABLE ROW LEVEL SECURITY;

-- Public read (unauthenticated players browsing items)
CREATE POLICY "Anyone can view items"
  ON public.items FOR SELECT
  USING (true);

-- Any DM (of any campaign) can manage items
CREATE POLICY "DMs can manage items"
  ON public.items FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM public.campaign_members
      WHERE user_id = auth.uid() AND role = 'dm'
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.campaign_members
      WHERE user_id = auth.uid() AND role = 'dm'
    )
  );

-- ---------------------------------------------------------------------------
-- Seed: PHB equipment with full stats
-- ---------------------------------------------------------------------------

INSERT INTO public.items (slug, name, category, subcategory, source, rarity, weight_lb, cost_gp, description, properties) VALUES

-- ── Simple melee weapons ──────────────────────────────────────────────────
('club','Club','weapon','simple_melee','SRD','common',2,0.1,'A simple wooden club.',
 '{"damage":"1d4","damageType":"bludgeoning","weaponCategory":"simple","weaponRange":"melee","weaponProperties":["light"]}'),

('dagger','Dagger','weapon','simple_melee','SRD','common',1,2,'A short blade for quick strikes.',
 '{"damage":"1d4","damageType":"piercing","weaponCategory":"simple","weaponRange":"melee","weaponProperties":["finesse","light","thrown"],"throwRangeNormal":20,"throwRangeLong":60}'),

('greatclub','Greatclub','weapon','simple_melee','SRD','common',10,0.2,'A massive two-handed club.',
 '{"damage":"1d8","damageType":"bludgeoning","weaponCategory":"simple","weaponRange":"melee","weaponProperties":["two-handed"]}'),

('handaxe','Handaxe','weapon','simple_melee','SRD','common',2,5,'A small axe balanced for throwing.',
 '{"damage":"1d6","damageType":"slashing","weaponCategory":"simple","weaponRange":"melee","weaponProperties":["light","thrown"],"throwRangeNormal":20,"throwRangeLong":60}'),

('javelin','Javelin','weapon','simple_melee','SRD','common',2,0.5,'A thrown piercing weapon.',
 '{"damage":"1d6","damageType":"piercing","weaponCategory":"simple","weaponRange":"melee","weaponProperties":["thrown"],"throwRangeNormal":30,"throwRangeLong":120}'),

('light-hammer','Light Hammer','weapon','simple_melee','SRD','common',2,2,'A small hammer suitable for throwing.',
 '{"damage":"1d4","damageType":"bludgeoning","weaponCategory":"simple","weaponRange":"melee","weaponProperties":["light","thrown"],"throwRangeNormal":20,"throwRangeLong":60}'),

('mace','Mace','weapon','simple_melee','SRD','common',4,5,'A metal-headed striking weapon.',
 '{"damage":"1d6","damageType":"bludgeoning","weaponCategory":"simple","weaponRange":"melee","weaponProperties":[]}'),

('quarterstaff','Quarterstaff','weapon','simple_melee','SRD','common',4,0.2,'A sturdy wooden staff.',
 '{"damage":"1d6","damageType":"bludgeoning","weaponCategory":"simple","weaponRange":"melee","weaponProperties":["versatile"],"versatileDamage":"1d8"}'),

('sickle','Sickle','weapon','simple_melee','SRD','common',2,1,'A curved blade on a short handle.',
 '{"damage":"1d4","damageType":"slashing","weaponCategory":"simple","weaponRange":"melee","weaponProperties":["light"]}'),

('spear','Spear','weapon','simple_melee','SRD','common',3,1,'A long thrusting weapon.',
 '{"damage":"1d6","damageType":"piercing","weaponCategory":"simple","weaponRange":"melee","weaponProperties":["thrown","versatile"],"throwRangeNormal":20,"throwRangeLong":60,"versatileDamage":"1d8"}'),

-- ── Simple ranged weapons ─────────────────────────────────────────────────
('light-crossbow','Light Crossbow','weapon','simple_ranged','SRD','common',5,25,'A crossbow small enough to wield one-handed.',
 '{"damage":"1d8","damageType":"piercing","weaponCategory":"simple","weaponRange":"ranged","weaponProperties":["ammunition","loading","two-handed"],"rangeNormal":80,"rangeLong":320}'),

('dart','Dart','weapon','simple_ranged','SRD','common',0.25,0.05,'A small thrown missile.',
 '{"damage":"1d4","damageType":"piercing","weaponCategory":"simple","weaponRange":"ranged","weaponProperties":["finesse","thrown"],"throwRangeNormal":20,"throwRangeLong":60}'),

('shortbow','Shortbow','weapon','simple_ranged','SRD','common',2,25,'A small bow for swift attacks.',
 '{"damage":"1d6","damageType":"piercing","weaponCategory":"simple","weaponRange":"ranged","weaponProperties":["ammunition","two-handed"],"rangeNormal":80,"rangeLong":320}'),

('sling','Sling','weapon','simple_ranged','SRD','common',0,0.1,'A strip of cloth used to hurl stones.',
 '{"damage":"1d4","damageType":"bludgeoning","weaponCategory":"simple","weaponRange":"ranged","weaponProperties":["ammunition"],"rangeNormal":30,"rangeLong":120}'),

-- ── Martial melee weapons ─────────────────────────────────────────────────
('battleaxe','Battleaxe','weapon','martial_melee','SRD','common',4,10,'A versatile axe of war.',
 '{"damage":"1d8","damageType":"slashing","weaponCategory":"martial","weaponRange":"melee","weaponProperties":["versatile"],"versatileDamage":"1d10"}'),

('flail','Flail','weapon','martial_melee','SRD','common',2,10,'A spiked ball on a chain.',
 '{"damage":"1d8","damageType":"bludgeoning","weaponCategory":"martial","weaponRange":"melee","weaponProperties":[]}'),

('glaive','Glaive','weapon','martial_melee','SRD','common',6,20,'A blade on a long pole.',
 '{"damage":"1d10","damageType":"slashing","weaponCategory":"martial","weaponRange":"melee","weaponProperties":["heavy","reach","two-handed"]}'),

('greataxe','Greataxe','weapon','martial_melee','SRD','common',7,30,'A massive two-handed axe.',
 '{"damage":"1d12","damageType":"slashing","weaponCategory":"martial","weaponRange":"melee","weaponProperties":["heavy","two-handed"]}'),

('greatsword','Greatsword','weapon','martial_melee','SRD','common',6,50,'The largest of two-handed swords.',
 '{"damage":"2d6","damageType":"slashing","weaponCategory":"martial","weaponRange":"melee","weaponProperties":["heavy","two-handed"]}'),

('halberd','Halberd','weapon','martial_melee','SRD','common',6,20,'An axe-blade on a pike.',
 '{"damage":"1d10","damageType":"slashing","weaponCategory":"martial","weaponRange":"melee","weaponProperties":["heavy","reach","two-handed"]}'),

('lance','Lance','weapon','martial_melee','SRD','common',6,10,'A cavalry weapon for mounted combat.',
 '{"damage":"1d12","damageType":"piercing","weaponCategory":"martial","weaponRange":"melee","weaponProperties":["reach","special"]}'),

('longsword','Longsword','weapon','martial_melee','SRD','common',3,15,'A straight double-edged sword.',
 '{"damage":"1d8","damageType":"slashing","weaponCategory":"martial","weaponRange":"melee","weaponProperties":["versatile"],"versatileDamage":"1d10"}'),

('maul','Maul','weapon','martial_melee','SRD','common',10,10,'A heavy two-handed hammer.',
 '{"damage":"2d6","damageType":"bludgeoning","weaponCategory":"martial","weaponRange":"melee","weaponProperties":["heavy","two-handed"]}'),

('morningstar','Morningstar','weapon','martial_melee','SRD','common',4,15,'A spiked mace.',
 '{"damage":"1d8","damageType":"piercing","weaponCategory":"martial","weaponRange":"melee","weaponProperties":[]}'),

('pike','Pike','weapon','martial_melee','SRD','common',18,5,'An extremely long spear for formation fighting.',
 '{"damage":"1d10","damageType":"piercing","weaponCategory":"martial","weaponRange":"melee","weaponProperties":["heavy","reach","two-handed"]}'),

('rapier','Rapier','weapon','martial_melee','SRD','common',2,25,'A slender thrusting blade.',
 '{"damage":"1d8","damageType":"piercing","weaponCategory":"martial","weaponRange":"melee","weaponProperties":["finesse"]}'),

('scimitar','Scimitar','weapon','martial_melee','SRD','common',3,25,'A curved slashing sword.',
 '{"damage":"1d6","damageType":"slashing","weaponCategory":"martial","weaponRange":"melee","weaponProperties":["finesse","light"]}'),

('shortsword','Shortsword','weapon','martial_melee','SRD','common',2,10,'A light blade for quick strikes.',
 '{"damage":"1d6","damageType":"piercing","weaponCategory":"martial","weaponRange":"melee","weaponProperties":["finesse","light"]}'),

('trident','Trident','weapon','martial_melee','SRD','common',4,5,'A three-pronged polearm.',
 '{"damage":"1d6","damageType":"piercing","weaponCategory":"martial","weaponRange":"melee","weaponProperties":["thrown","versatile"],"throwRangeNormal":20,"throwRangeLong":60,"versatileDamage":"1d8"}'),

('war-pick','War Pick','weapon','martial_melee','SRD','common',2,5,'A pick designed for combat.',
 '{"damage":"1d8","damageType":"piercing","weaponCategory":"martial","weaponRange":"melee","weaponProperties":[]}'),

('warhammer','Warhammer','weapon','martial_melee','SRD','common',2,15,'A heavy single-handed hammer.',
 '{"damage":"1d8","damageType":"bludgeoning","weaponCategory":"martial","weaponRange":"melee","weaponProperties":["versatile"],"versatileDamage":"1d10"}'),

('whip','Whip','weapon','martial_melee','SRD','common',3,2,'A long braided leather weapon.',
 '{"damage":"1d4","damageType":"slashing","weaponCategory":"martial","weaponRange":"melee","weaponProperties":["finesse","reach"]}'),

-- ── Martial ranged weapons ────────────────────────────────────────────────
('blowgun','Blowgun','weapon','martial_ranged','SRD','common',1,10,'A long tube for propelling needles.',
 '{"damage":"1","damageType":"piercing","weaponCategory":"martial","weaponRange":"ranged","weaponProperties":["ammunition","loading"],"rangeNormal":25,"rangeLong":100}'),

('hand-crossbow','Hand Crossbow','weapon','martial_ranged','SRD','common',3,75,'A compact crossbow for one-handed use.',
 '{"damage":"1d6","damageType":"piercing","weaponCategory":"martial","weaponRange":"ranged","weaponProperties":["ammunition","light","loading"],"rangeNormal":30,"rangeLong":120}'),

('heavy-crossbow','Heavy Crossbow','weapon','martial_ranged','SRD','common',18,50,'A powerful two-handed crossbow.',
 '{"damage":"1d10","damageType":"piercing","weaponCategory":"martial","weaponRange":"ranged","weaponProperties":["ammunition","heavy","loading","two-handed"],"rangeNormal":100,"rangeLong":400}'),

('longbow','Longbow','weapon','martial_ranged','SRD','common',2,50,'A tall bow for long-range shooting.',
 '{"damage":"1d8","damageType":"piercing","weaponCategory":"martial","weaponRange":"ranged","weaponProperties":["ammunition","heavy","two-handed"],"rangeNormal":150,"rangeLong":600}'),

('net','Net','weapon','martial_ranged','SRD','common',3,1,'A weighted net for entangling foes.',
 '{"damage":"0","damageType":"","weaponCategory":"martial","weaponRange":"ranged","weaponProperties":["special","thrown"],"throwRangeNormal":5,"throwRangeLong":15}'),

-- ── Light armor ───────────────────────────────────────────────────────────
('padded-armor','Padded Armor','armor','light_armor','SRD','common',8,5,'Quilted layers of cloth and batting.',
 '{"armorType":"light","armorClass":11,"dexBonus":true,"maxDexBonus":null,"strengthRequirement":0,"stealthDisadvantage":true}'),

('leather-armor','Leather Armor','armor','light_armor','SRD','common',10,10,'Hardened leather shaped to the body.',
 '{"armorType":"light","armorClass":11,"dexBonus":true,"maxDexBonus":null,"strengthRequirement":0,"stealthDisadvantage":false}'),

('studded-leather','Studded Leather Armor','armor','light_armor','SRD','common',13,45,'Leather reinforced with close-set rivets.',
 '{"armorType":"light","armorClass":12,"dexBonus":true,"maxDexBonus":null,"strengthRequirement":0,"stealthDisadvantage":false}'),

-- ── Medium armor ──────────────────────────────────────────────────────────
('hide-armor','Hide Armor','armor','medium_armor','SRD','common',12,10,'Crude armor made from thick furs and pelts.',
 '{"armorType":"medium","armorClass":12,"dexBonus":true,"maxDexBonus":2,"strengthRequirement":0,"stealthDisadvantage":false}'),

('chain-shirt','Chain Shirt','armor','medium_armor','SRD','common',20,50,'A shirt of interlocking metal rings.',
 '{"armorType":"medium","armorClass":13,"dexBonus":true,"maxDexBonus":2,"strengthRequirement":0,"stealthDisadvantage":false}'),

('scale-mail','Scale Mail','armor','medium_armor','SRD','common',45,50,'Overlapping metal scales on leather.',
 '{"armorType":"medium","armorClass":14,"dexBonus":true,"maxDexBonus":2,"strengthRequirement":0,"stealthDisadvantage":true}'),

('breastplate','Breastplate','armor','medium_armor','SRD','common',20,400,'A fitted metal chest piece.',
 '{"armorType":"medium","armorClass":14,"dexBonus":true,"maxDexBonus":2,"strengthRequirement":0,"stealthDisadvantage":false}'),

('half-plate','Half Plate','armor','medium_armor','SRD','common',40,750,'Metal plates covering most of the body.',
 '{"armorType":"medium","armorClass":15,"dexBonus":true,"maxDexBonus":2,"strengthRequirement":0,"stealthDisadvantage":true}'),

-- ── Heavy armor ───────────────────────────────────────────────────────────
('ring-mail','Ring Mail','armor','heavy_armor','SRD','common',40,30,'Leather with heavy metal rings sewn through it.',
 '{"armorType":"heavy","armorClass":14,"dexBonus":false,"maxDexBonus":0,"strengthRequirement":0,"stealthDisadvantage":true}'),

('chain-mail','Chain Mail','armor','heavy_armor','SRD','common',55,75,'A suit of interlocking metal rings.',
 '{"armorType":"heavy","armorClass":16,"dexBonus":false,"maxDexBonus":0,"strengthRequirement":13,"stealthDisadvantage":true}'),

('splint-armor','Splint Armor','armor','heavy_armor','SRD','common',60,200,'Narrow vertical strips of metal riveted to leather.',
 '{"armorType":"heavy","armorClass":17,"dexBonus":false,"maxDexBonus":0,"strengthRequirement":15,"stealthDisadvantage":true}'),

('plate-armor','Plate Armor','armor','heavy_armor','SRD','common',65,1500,'Full coverage articulated metal plates.',
 '{"armorType":"heavy","armorClass":18,"dexBonus":false,"maxDexBonus":0,"strengthRequirement":15,"stealthDisadvantage":true}'),

-- ── Shield ────────────────────────────────────────────────────────────────
('shield','Shield','shield',null,'SRD','common',6,10,'A wooden or metal board carried in one hand.',
 '{"armorClass":2}'),

-- ── Ammunition ────────────────────────────────────────────────────────────
('arrow','Arrow','ammunition',null,'SRD','common',0.05,0.05,'A shaft for shortbow or longbow.','{}'),
('crossbow-bolt','Crossbow Bolt','ammunition',null,'SRD','common',0.075,0.05,'A quarrel for crossbows.','{}'),

-- ── Adventuring gear (selection) ──────────────────────────────────────────
('abacus','Abacus','adventuring_gear',null,'SRD','common',2,2,'A counting frame.','{}'),
('acid-vial','Acid (vial)','adventuring_gear',null,'SRD','common',1,25,'A vial of corrosive acid. As an action, you can splash it on a creature within 5 feet (attack roll) for 2d6 acid damage.','{}'),
('alchemists-fire','Alchemist''s Fire (flask)','adventuring_gear',null,'SRD','common',1,50,'A sticky, adhesive fluid that ignites when exposed to air. As an action, throw it at a creature within 20 feet (attack roll). On a hit, the target takes 1d4 fire damage at the start of each turn until it uses an action to smother the flames (DC 10 Dex save).','{}'),
('backpack','Backpack','adventuring_gear',null,'SRD','common',5,2,'A leather pack for carrying gear.','{}'),
('ball-bearings','Ball Bearings (bag of 1,000)','adventuring_gear',null,'SRD','common',2,1,'As an action, scatter on the ground in a 10-foot square. Creatures that move through it must succeed on a DC 10 Dex save or fall prone.','{}'),
('bedroll','Bedroll','adventuring_gear',null,'SRD','common',7,1,'A rolled-up sleeping pad and blanket.','{}'),
('bell','Bell','adventuring_gear',null,'SRD','common',0,1,'A small brass bell.','{}'),
('blanket','Blanket','adventuring_gear',null,'SRD','common',3,0.5,'A warm wool blanket.','{}'),
('block-and-tackle','Block and Tackle','adventuring_gear',null,'SRD','common',5,1,'A set of pulleys and rope. Gives advantage on Str checks to lift heavy objects.','{}'),
('book','Book','adventuring_gear',null,'SRD','common',5,25,'A bound book of blank or written pages.','{}'),
('bottle-glass','Bottle, Glass','adventuring_gear',null,'SRD','common',2,2,'A glass bottle for liquids.','{}'),
('bucket','Bucket','adventuring_gear',null,'SRD','common',2,0.05,'A wooden bucket.','{}'),
('caltrops','Caltrops (bag of 20)','adventuring_gear',null,'SRD','common',2,1,'Scatter over a 5-foot square. Creatures that enter must succeed on a DC 15 Dex save or stop moving and take 1 piercing damage.','{}'),
('candle','Candle','adventuring_gear',null,'SRD','common',0,0.01,'Sheds bright light in a 5-foot radius and dim light for another 5 feet for 1 hour.','{}'),
('case-crossbow','Case, Crossbow Bolt','adventuring_gear',null,'SRD','common',1,1,'Holds up to 20 crossbow bolts.','{}'),
('case-map','Case, Map or Scroll','adventuring_gear',null,'SRD','common',1,1,'A cylindrical leather case for maps.','{}'),
('chain','Chain (10 feet)','adventuring_gear',null,'SRD','common',10,5,'Iron chain with 10 hp per link (AC 19).','{}'),
('chalk','Chalk (1 piece)','adventuring_gear',null,'SRD','common',0,0.01,'Used to write on stone or wood.','{}'),
('chest','Chest','adventuring_gear',null,'SRD','common',25,5,'A lockable wooden chest.','{}'),
('clothes-common','Clothes, Common','adventuring_gear',null,'SRD','common',3,0.5,'Basic everyday clothing.','{}'),
('clothes-costume','Clothes, Costume','adventuring_gear',null,'SRD','common',4,5,'Elaborate costume clothing.','{}'),
('clothes-fine','Clothes, Fine','adventuring_gear',null,'SRD','common',6,15,'Expensive high-quality clothing.','{}'),
('clothes-travelers','Clothes, Traveler''s','adventuring_gear',null,'SRD','common',4,2,'Sturdy clothing for long journeys.','{}'),
('component-pouch','Component Pouch','focus',null,'SRD','common',2,25,'A small watertight pouch for spell material components.','{}'),
('crowbar','Crowbar','adventuring_gear',null,'SRD','common',5,2,'Grants advantage on Str checks where leverage can be applied.','{}'),
('flask','Flask or Tankard','adventuring_gear',null,'SRD','common',1,0.02,'Holds 1 pint of liquid.','{}'),
('grappling-hook','Grappling Hook','adventuring_gear',null,'SRD','common',4,2,'Attached to rope for climbing or pulling.','{}'),
('hammer','Hammer','adventuring_gear',null,'SRD','common',3,1,'A small hammer for driving pitons.','{}'),
('hammer-sledge','Hammer, Sledge','adventuring_gear',null,'SRD','common',10,2,'A large two-handed hammer.','{}'),
('healers-kit','Healer''s Kit','adventuring_gear',null,'SRD','common',3,5,'A leather pouch of bandages and salves. 10 uses. As an action, stabilize a dying creature without a Medicine check.','{}'),
('holy-water','Holy Water (flask)','adventuring_gear',null,'SRD','common',1,25,'Splash on an undead or fiend within 5 feet (ranged attack) for 2d6 radiant damage.','{}'),
('hourglass','Hourglass','adventuring_gear',null,'SRD','common',1,25,'Measures one hour.','{}'),
('hunting-trap','Hunting Trap','adventuring_gear',null,'SRD','common',25,5,'A spring-loaded jaw trap. DC 13 Dex save or creature is restrained (2d4 piercing damage). DC 13 Str to break free.','{}'),
('ink','Ink (1 oz. bottle)','adventuring_gear',null,'SRD','common',0,10,'A bottle of black writing ink.','{}'),
('ink-pen','Ink Pen','adventuring_gear',null,'SRD','common',0,0.02,'A quill for writing.','{}'),
('iron-pot','Iron Pot','adventuring_gear',null,'SRD','common',10,2,'A 1-gallon iron cooking pot.','{}'),
('jug','Jug or Pitcher','adventuring_gear',null,'SRD','common',4,0.02,'Holds 1 gallon of liquid.','{}'),
('ladder','Ladder (10-foot)','adventuring_gear',null,'SRD','common',25,0.1,'A portable 10-foot ladder.','{}'),
('lamp','Lamp','adventuring_gear',null,'SRD','common',1,0.5,'Burns for 6 hours per pint of oil. Bright light 15 ft, dim 30 ft.','{}'),
('lantern-bullseye','Lantern, Bullseye','adventuring_gear',null,'SRD','common',2,10,'Bright light in a 60-foot cone, dim another 60 ft. Burns for 6 hours per pint of oil.','{}'),
('lantern-hooded','Lantern, Hooded','adventuring_gear',null,'SRD','common',2,5,'Bright light 30 ft, dim 30 ft. Burns 6 hours per pint. Hood reduces to dim 5 ft.','{}'),
('lock','Lock','adventuring_gear',null,'SRD','common',1,10,'Iron lock with a key. DC 15 to pick.','{}'),
('magnifying-glass','Magnifying Glass','adventuring_gear',null,'SRD','common',0,100,'Grants advantage on appraisal checks. Can focus sunlight to start fires after 1 minute.','{}'),
('manacles','Manacles','adventuring_gear',null,'SRD','common',6,2,'Restrains a Medium or smaller creature. DC 20 Str or Dex (thieves'' tools DC 15) to escape.','{}'),
('mirror-steel','Mirror, Steel','adventuring_gear',null,'SRD','common',0.5,5,'A polished steel mirror.','{}'),
('oil-flask','Oil (flask)','adventuring_gear',null,'SRD','common',1,0.1,'A flask of lamp oil. Can be lit and splashed for 1d4 fire damage over 2 rounds, or poured on the ground in a 5-foot square for 2 rounds of difficult terrain.','{}'),
('paper','Paper (one sheet)','adventuring_gear',null,'SRD','common',0,0.2,'A sheet of fine paper.','{}'),
('parchment','Parchment (one sheet)','adventuring_gear',null,'SRD','common',0,0.1,'A sheet of writing parchment.','{}'),
('perfume','Perfume (vial)','adventuring_gear',null,'SRD','common',0,5,'A small vial of perfume.','{}'),
('pick-miners','Pick, Miner''s','adventuring_gear',null,'SRD','common',10,2,'A heavy pick for breaking rock.','{}'),
('piton','Piton','adventuring_gear',null,'SRD','common',0.25,0.05,'A metal spike hammered into stone for climbing.','{}'),
('poison-basic','Poison, Basic (vial)','adventuring_gear',null,'SRD','common',0,100,'Apply to a blade or place in food/drink. Creature exposed must succeed on DC 10 Con save or take 1d4 poison damage and be poisoned for 1 hour.','{}'),
('pole','Pole (10-foot)','adventuring_gear',null,'SRD','common',7,0.05,'A wooden pole for probing and measuring.','{}'),
('pouch','Pouch','adventuring_gear',null,'SRD','common',1,0.5,'A leather belt pouch. Holds 6 lb of gear.','{}'),
('quiver','Quiver','adventuring_gear',null,'SRD','common',1,1,'Holds up to 20 arrows.','{}'),
('ram-portable','Ram, Portable','adventuring_gear',null,'SRD','common',35,4,'Used by two people to break down doors. +4 to Str checks; advantage if used together.','{}'),
('rations','Rations (1 day)','adventuring_gear',null,'SRD','common',2,0.5,'Dried food for one day of travel.','{}'),
('robes','Robes','adventuring_gear',null,'SRD','common',4,1,'Loose flowing robes.','{}'),
('rope-hempen','Rope, Hempen (50 feet)','adventuring_gear',null,'SRD','common',10,1,'50 feet of hempen rope. 2 hp, DC 17 Str to break.','{}'),
('rope-silk','Rope, Silk (50 feet)','adventuring_gear',null,'SRD','common',5,10,'50 feet of silk rope. 2 hp, DC 17 Str to break.','{}'),
('sack','Sack','adventuring_gear',null,'SRD','common',0.5,0.01,'A cloth sack. Holds 30 lb.','{}'),
('scale-merchants','Scale, Merchant''s','adventuring_gear',null,'SRD','common',3,5,'A small balance for weighing coins and other items.','{}'),
('sealing-wax','Sealing Wax','adventuring_gear',null,'SRD','common',0,0.5,'Used to seal letters and documents.','{}'),
('shovel','Shovel','adventuring_gear',null,'SRD','common',5,2,'An iron-headed digging tool.','{}'),
('signal-whistle','Signal Whistle','adventuring_gear',null,'SRD','common',0,0.05,'A small metal whistle.','{}'),
('signet-ring','Signet Ring','adventuring_gear',null,'SRD','common',0,5,'A ring bearing a personal seal.','{}'),
('soap','Soap','adventuring_gear',null,'SRD','common',0,0.02,'A bar of soap.','{}'),
('spellbook','Spellbook','adventuring_gear',null,'SRD','common',3,50,'An essential tool for wizards. 100 pages, 1 per spell level.','{}'),
('spikes-iron','Spikes, Iron (10)','adventuring_gear',null,'SRD','common',5,1,'Ten iron spikes for securing things.','{}'),
('spyglass','Spyglass','adventuring_gear',null,'SRD','common',1,1000,'Magnifies distant objects by a factor of 2.','{}'),
('tent-two-person','Tent, Two-Person','adventuring_gear',null,'SRD','common',20,2,'A simple shelter for two.','{}'),
('tinderbox','Tinderbox','adventuring_gear',null,'SRD','common',1,0.5,'Contains flint, fire steel, and tinder. Lighting a fire takes 1 action (torch) to 1 minute (campfire).','{}'),
('torch','Torch','adventuring_gear',null,'SRD','common',1,0.01,'Burns for 1 hour. Bright light 20 ft, dim 20 ft. 1 fire damage if used as improvised weapon.','{}'),
('vial','Vial','adventuring_gear',null,'SRD','common',0,1,'A small glass container holding 4 oz.','{}'),
('waterskin','Waterskin','adventuring_gear',null,'SRD','common',5,0.2,'Holds 4 pints of liquid.','{}'),
('whetstone','Whetstone','adventuring_gear',null,'SRD','common',1,0.01,'Used to sharpen bladed weapons.','{}'),

-- ── Foci ──────────────────────────────────────────────────────────────────
('arcane-focus','Arcane Focus (crystal)','focus',null,'SRD','common',1,10,'A crystal orb used as a spellcasting focus for arcane spells.','{}'),
('druidic-focus','Druidic Focus (sprig of mistletoe)','focus',null,'SRD','common',0,1,'A sprig of mistletoe used as a spellcasting focus for druid spells.','{}'),
('holy-symbol','Holy Symbol','focus',null,'SRD','common',1,5,'An amulet, reliquary, or emblem used as a spellcasting focus for divine spells.','{}'),

-- ── Tools ─────────────────────────────────────────────────────────────────
('artisans-tools','Artisan''s Tools','tool',null,'SRD','common',5,2,'Specialized tools for a craft (varies by type).','{}'),
('disguise-kit','Disguise Kit','tool',null,'SRD','common',3,25,'Cosmetics and costumes for disguises. Proficiency adds to Charisma (Deception) checks to pass as someone else.','{}'),
('forgery-kit','Forgery Kit','tool',null,'SRD','common',5,15,'Inks, pens, and seals for creating forgeries.','{}'),
('herbalism-kit','Herbalism Kit','tool',null,'SRD','common',3,5,'Pouches and vials for preparing herbal remedies. Required for crafting antitoxin and healing potions.','{}'),
('navigators-tools','Navigator''s Tools','tool',null,'SRD','common',2,25,'Charts, compass, calipers and protractor. Proficiency lets you chart a ship''s course.','{}'),
('thieves-tools','Thieves'' Tools','tool',null,'SRD','common',1,25,'Picks, pliers and files for lockpicking. Proficiency lets you disable traps and open locks.','{}'),
('lute','Lute','tool',null,'SRD','common',2,35,'A stringed instrument popular among bards.','{}'),
('musical-instrument','Musical Instrument','tool',null,'SRD','common',2,5,'A musical instrument (varies by type).','{}'),

-- ── Packs ─────────────────────────────────────────────────────────────────
('burglars-pack','Burglar''s Pack','pack',null,'SRD','common',44.5,16,'Includes a backpack, 1,000 ball bearings, 10 feet of string, a bell, 5 candles, a crowbar, a hammer, 10 pitons, a hooded lantern, 2 flasks of oil, 5 days rations, a tinderbox, and a waterskin.','{}'),
('diplomats-pack','Diplomat''s Pack','pack',null,'SRD','common',39,39,'Includes a chest, 2 cases for maps and scrolls, a set of fine clothes, a bottle of ink, an ink pen, a lamp, 2 flasks of oil, 5 sheets of paper, a vial of perfume, sealing wax, and soap.','{}'),
('dungeoneers-pack','Dungeoneer''s Pack','pack',null,'SRD','common',61.5,12,'Includes a backpack, a crowbar, a hammer, 10 pitons, 10 torches, a tinderbox, 10 days of rations, and a waterskin. Also includes 50 feet of hempen rope.','{}'),
('entertainers-pack','Entertainer''s Pack','pack',null,'SRD','common',38,40,'Includes a backpack, a bedroll, 2 costumes, 5 candles, 5 days of rations, a waterskin, and a disguise kit.','{}'),
('explorers-pack','Explorer''s Pack','pack',null,'SRD','common',59,10,'Includes a backpack, a bedroll, a mess kit, a tinderbox, 10 torches, 10 days of rations, a waterskin, and 50 feet of hempen rope.','{}'),
('priests-pack','Priest''s Pack','pack',null,'SRD','common',29,19,'Includes a backpack, a blanket, 10 candles, a tinderbox, an alms box, 2 blocks of incense, a censer, vestments, 2 days of rations, and a waterskin.','{}'),
('scholars-pack','Scholar''s Pack','pack',null,'SRD','common',10,40,'Includes a backpack, a book of lore, a bottle of ink, an ink pen, 10 sheets of parchment, a little bag of sand, and a small knife.','{}' )

ON CONFLICT (slug) DO UPDATE SET
  name        = EXCLUDED.name,
  category    = EXCLUDED.category,
  subcategory = EXCLUDED.subcategory,
  weight_lb   = EXCLUDED.weight_lb,
  cost_gp     = EXCLUDED.cost_gp,
  description = EXCLUDED.description,
  properties  = EXCLUDED.properties,
  updated_at  = now();
