import {
  ARTISAN_TOOLS,
  EXPLORER_TOOLS,
  GAMING_SETS,
  MUSICAL_INSTRUMENTS,
} from "./backgrounds";

/** Common tools for “proficiency with one tool of your choice” (e.g. Githyanki). */
export const GENERAL_TOOLS = [
  ...ARTISAN_TOOLS,
  ...GAMING_SETS,
  ...MUSICAL_INSTRUMENTS,
  ...EXPLORER_TOOLS,
  "disguise kit",
  "forgery kit",
  "herbalism kit",
  "navigator's tools",
  "poisoner's kit",
  "thieves' tools",
  "vehicles (land)",
  "vehicles (water)",
] as const;
