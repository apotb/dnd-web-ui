import type { PhbFeat } from "./types";

/** PHB feats available to Variant Human at 1st level. */
export const PHB_FEATS: PhbFeat[] = [
  {
    id: "alert",
    name: "Alert",
    description: "+5 initiative, can't be surprised while conscious, hidden creatures don't gain advantage on attacks against you.",
  },
  {
    id: "athlete",
    name: "Athlete",
    description: "Standing from prone costs 5 ft; climbing doesn't cost extra movement; running jump uses 10 ft of movement.",
  },
  {
    id: "actor",
    name: "Actor",
    description: "Advantage on Deception and Performance when mimicking; mimic speech and sounds.",
  },
  {
    id: "charger",
    name: "Charger",
    description: "When you Dash, bonus action melee attack with +5 damage if you moved 10+ ft straight toward target.",
  },
  {
    id: "crossbow-expert",
    name: "Crossbow Expert",
    description: "Ignore loading; no disadvantage within 5 ft; bonus action hand crossbow attack after one-handed attack.",
  },
  {
    id: "defensive-duelist",
    name: "Defensive Duelist",
    description: "Reaction to add proficiency to AC when wielding finesse weapon and hit by melee attack.",
  },
  {
    id: "dual-wielder",
    name: "Dual Wielder",
    description: "+1 AC with separate weapons; two-weapon fighting with non-light one-handed weapons; draw/stow two weapons.",
  },
  {
    id: "dungeon-delver",
    name: "Dungeon Delver",
    description: "Advantage on Perception and Investigation for secret doors; advantage on saves vs traps; resistance to trap damage.",
  },
  {
    id: "durable",
    name: "Durable",
    description: "+1 Con; minimum 2 HP per Hit Die spent.",
  },
  {
    id: "elemental-adept",
    name: "Elemental Adept",
    description: "Choose acid, cold, fire, lightning, or thunder. Spells ignore resistance; treat 1s on damage dice as 2s.",
  },
  {
    id: "great-weapon-master",
    name: "Great Weapon Master",
    description: "On crit or kill, bonus action attack; take -5 on attack for +10 damage with heavy melee weapon.",
  },
  {
    id: "healer",
    name: "Healer",
    description: "Stabilize and heal 1d6 + 4 + target's HD spent with healer's kit once per short rest per creature.",
  },
  {
    id: "heavily-armored",
    name: "Heavily Armored",
    description: "Proficiency with heavy armor; +1 Str.",
  },
  {
    id: "heavy-armor-master",
    name: "Heavy Armor Master",
    description: "Reduce bludgeoning, piercing, and slashing from nonmagical weapons by 3 while wearing heavy armor.",
  },
  {
    id: "inspiring-leader",
    name: "Inspiring Leader",
    description: "10-minute speech grants temp HP (level + Cha mod) to up to 6 creatures.",
  },
  {
    id: "keen-mind",
    name: "Keen Mind",
    description: "+1 Int; always know north and time; recall anything read in past month.",
  },
  {
    id: "lightly-armored",
    name: "Lightly Armored",
    description: "Proficiency with light armor; +1 Str or Dex.",
  },
  {
    id: "linguist",
    name: "Linguist",
    description: "Learn three languages; create written ciphers.",
  },
  {
    id: "lucky",
    name: "Lucky",
    description: "3 luck points per long rest to reroll attack, save, or ability check.",
  },
  {
    id: "mage-slayer",
    name: "Mage Slayer",
    description: "Reaction to attack spellcaster within 5 ft; advantage on saves vs spells cast within 5 ft.",
  },
  {
    id: "magic-initiate",
    name: "Magic Initiate",
    description: "Learn two cantrips and one 1st-level spell from cleric, druid, or wizard list; cast once per long rest.",
  },
  {
    id: "martial-adept",
    name: "Martial Adept",
    description: "Learn two maneuvers; one superiority die (d6).",
  },
  {
    id: "medium-armor-master",
    name: "Medium Armor Master",
    description: "Medium armor doesn't impose disadvantage on Stealth; +3 Dex to AC in medium armor.",
  },
  {
    id: "mobile",
    name: "Mobile",
    description: "+10 speed; Dash ignores difficult terrain; no OA from target you melee attacked.",
  },
  {
    id: "moderately-armored",
    name: "Moderately Armored",
    description: "Proficiency with medium armor and shields; +1 Str or Dex.",
  },
  {
    id: "mounted-combatant",
    name: "Mounted Combatant",
    description: "Advantage on melee vs unmounted smaller creatures; redirect mount attacks; mount takes no damage on successful Dex save.",
  },
  {
    id: "observant",
    name: "Observant",
    description: "+1 Int or Wis; +5 passive Perception and Investigation; read lips.",
  },
  {
    id: "polearm-master",
    name: "Polearm Master",
    description: "Bonus action butt-end attack; opportunity attacks when creatures enter reach.",
  },
  {
    id: "resilient",
    name: "Resilient",
    description: "+1 to chosen ability; proficiency in that saving throw.",
  },
  {
    id: "ritual-caster",
    name: "Ritual Caster",
    description: "Learn two 1st-level ritual spells from chosen class list.",
  },
  {
    id: "savage-attacker",
    name: "Savage Attacker",
    description: "Once per turn reroll weapon damage dice.",
  },
  {
    id: "sentinel",
    name: "Sentinel",
    description: "Reduce speed to 0 on OA; OA even when target Disengages; reaction attack when ally within 5 ft is hit.",
  },
  {
    id: "sharpshooter",
    name: "Sharpshooter",
    description: "Ignore half and three-quarters cover; no disadvantage at long range; -5 attack for +10 damage.",
  },
  {
    id: "shield-master",
    name: "Shield Master",
    description: "Bonus action shove after Attack; add shield to Dex saves; take no damage on successful Dex save.",
  },
  {
    id: "skilled",
    name: "Skilled",
    description: "Proficiency in any combination of three skills or tools.",
  },
  {
    id: "skulker",
    name: "Skulker",
    description: "Hide when lightly obscured; miss doesn't reveal position; dim light doesn't impose disadvantage on Perception.",
  },
  {
    id: "spell-sniper",
    name: "Spell Sniper",
    description: "Double range of attack spells; ignore half and three-quarters cover for spells.",
  },
  {
    id: "tavern-brawler",
    name: "Tavern Brawler",
    description: "+1 Str or Con; proficient with improvised weapons; bonus action grapple after unarmed or improvised hit.",
  },
  {
    id: "tough",
    name: "Tough",
    description: "+2 HP per level.",
  },
  {
    id: "war-caster",
    name: "War Caster",
    description: "Advantage on Con saves to maintain concentration; somatic with hands full; spell instead of OA.",
  },
  {
    id: "weapon-master",
    name: "Weapon Master",
    description: "+1 Str or Dex; proficiency with four weapons of your choice.",
  },
];

export function getFeat(id: string): PhbFeat | undefined {
  return PHB_FEATS.find((f) => f.id === id);
}
