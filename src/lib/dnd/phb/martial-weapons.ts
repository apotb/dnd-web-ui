/** Martial weapons (PHB) for racial proficiency choices. */
export const MARTIAL_WEAPONS = [
  "battleaxe",
  "flail",
  "glaive",
  "greataxe",
  "greatsword",
  "halberd",
  "lance",
  "longsword",
  "maul",
  "morningstar",
  "pike",
  "rapier",
  "scimitar",
  "shortsword",
  "trident",
  "war pick",
  "warhammer",
  "whip",
  "blowgun",
  "hand crossbow",
  "heavy crossbow",
  "longbow",
  "net",
] as const;

export type MartialWeapon = (typeof MARTIAL_WEAPONS)[number];
