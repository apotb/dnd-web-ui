-- Conditions catalog for character sheet and combat feature effects.

CREATE TABLE public.conditions (
  slug        TEXT PRIMARY KEY,
  name        TEXT NOT NULL,
  description TEXT NOT NULL DEFAULT '',
  is_standard BOOLEAN NOT NULL DEFAULT false,
  source      TEXT NOT NULL DEFAULT 'SRD',
  created_at  TIMESTAMPTZ DEFAULT NOW(),
  updated_at  TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.conditions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Public read conditions" ON public.conditions
  FOR SELECT USING (true);

CREATE POLICY "DMs manage conditions" ON public.conditions FOR ALL
  USING (EXISTS (SELECT 1 FROM public.campaign_members WHERE user_id = auth.uid() AND role = 'dm'))
  WITH CHECK (EXISTS (SELECT 1 FROM public.campaign_members WHERE user_id = auth.uid() AND role = 'dm'));

INSERT INTO public.conditions (slug, name, description, is_standard, source) VALUES
  (
    'blinded',
    'Blinded',
    $desc$• A blinded creature can't see and automatically fails any ability check that requires sight.
• Attack rolls against the creature have advantage, and the creature's attack rolls have disadvantage.$desc$,
    true,
    'SRD'
  ),
  (
    'charmed',
    'Charmed',
    $desc$• A charmed creature can't attack the charmer or target the charmer with harmful abilities or magical effects.
• The charmer has advantage on any ability check to interact socially with the creature.$desc$,
    true,
    'SRD'
  ),
  (
    'deafened',
    'Deafened',
    $desc$• A deafened creature can't hear and automatically fails any ability check that requires hearing.$desc$,
    true,
    'SRD'
  ),
  (
    'exhaustion',
    'Exhaustion',
    $desc$Exhaustion is measured in six levels. An effect can give a creature one or more levels of exhaustion.
1: Disadvantage on ability checks.
2: Speed halved.
3: Disadvantage on attack rolls and saving throws.
4: Hit point maximum halved.
5: Speed reduced to 0.
6: Death.$desc$,
    true,
    'SRD'
  ),
  (
    'frightened',
    'Frightened',
    $desc$• A frightened creature has disadvantage on ability checks and attack rolls while the source of its fear is within line of sight.
• The creature can't willingly move closer to the source of its fear.$desc$,
    true,
    'SRD'
  ),
  (
    'grappled',
    'Grappled',
    $desc$• A grappled creature's speed becomes 0, and it can't benefit from any bonus to its speed.
• The condition ends if the grappler is incapacitated.
• The condition also ends if an effect removes the grappled creature from the reach of the grappler or grappling effect.$desc$,
    true,
    'SRD'
  ),
  (
    'incapacitated',
    'Incapacitated',
    $desc$• An incapacitated creature can't take actions or reactions.$desc$,
    true,
    'SRD'
  ),
  (
    'invisible',
    'Invisible',
    $desc$• An invisible creature is impossible to see without the aid of magic or a special sense. For the purpose of hiding, the creature is heavily obscured. The creature's location can be detected by any noise it makes or any tracks it leaves.
• Attack rolls against the creature have disadvantage, and the creature's attack rolls have advantage.$desc$,
    true,
    'SRD'
  ),
  (
    'paralyzed',
    'Paralyzed',
    $desc$• A paralyzed creature is incapacitated and can't move or speak.
• The creature automatically fails Strength and Dexterity saving throws.
• Attack rolls against the creature have advantage.
• Any attack that hits the creature is a critical hit if the attacker is within 5 feet of the creature.$desc$,
    true,
    'SRD'
  ),
  (
    'petrified',
    'Petrified',
    $desc$• A petrified creature is transformed, along with any nonmagical object it is wearing or carrying, into a solid inanimate substance (usually stone). Its weight increases by a factor of ten, and it ceases aging.
• The creature is incapacitated, can't move or speak, and is unaware of its surroundings.
• Attack rolls against the creature have advantage.
• The creature automatically fails Strength and Dexterity saving throws.
• The creature has resistance to all damage.
• The creature is immune to poison and disease, although a poison or disease already in its system is suspended, not neutralized.$desc$,
    true,
    'SRD'
  ),
  (
    'poisoned',
    'Poisoned',
    $desc$• A poisoned creature has disadvantage on attack rolls and ability checks.$desc$,
    true,
    'SRD'
  ),
  (
    'prone',
    'Prone',
    $desc$• A prone creature's only movement option is to crawl, unless it stands up and thereby ends the condition.
• The creature has disadvantage on attack rolls.
• An attack roll against the creature has advantage if the attacker is within 5 feet of the creature. Otherwise, the attack roll has disadvantage.$desc$,
    true,
    'SRD'
  ),
  (
    'restrained',
    'Restrained',
    $desc$• A restrained creature's speed becomes 0, and it can't benefit from any bonus to its speed.
• Attack rolls against the creature have advantage, and the creature's attack rolls have disadvantage.
• The creature has disadvantage on Dexterity saving throws.$desc$,
    true,
    'SRD'
  ),
  (
    'stunned',
    'Stunned',
    $desc$• A stunned creature is incapacitated, can't move, and can speak only falteringly.
• The creature automatically fails Strength and Dexterity saving throws.
• Attack rolls against the creature have advantage.$desc$,
    true,
    'SRD'
  ),
  (
    'unconscious',
    'Unconscious',
    $desc$• An unconscious creature is incapacitated, can't move or speak, and is unaware of its surroundings.
• The creature drops whatever it's holding and falls prone.
• The creature automatically fails Strength and Dexterity saving throws.
• Attack rolls against the creature have advantage.
• Any attack that hits the creature is a critical hit if the attacker is within 5 feet of the creature.$desc$,
    true,
    'SRD'
  );
