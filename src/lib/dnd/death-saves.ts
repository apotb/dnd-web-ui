import type { CharacterData } from "@/lib/schemas/character";

export type DeathSaveRollOutcome =
  | "natural-20"
  | "natural-1"
  | "success"
  | "failure";

export interface DeathSaveInterpretation {
  outcome: DeathSaveRollOutcome;
  roll: number;
  summary: string;
  detail: string;
}

export function interpretDeathSaveRoll(roll: number): DeathSaveInterpretation {
  if (roll === 20) {
    return {
      outcome: "natural-20",
      roll,
      summary: "Natural 20",
      detail: "You regain 1 hit point and wake up. Death saves reset to 0.",
    };
  }
  if (roll === 1) {
    return {
      outcome: "natural-1",
      roll,
      summary: "Natural 1",
      detail: "Counts as 2 failures.",
    };
  }
  if (roll >= 10) {
    return {
      outcome: "success",
      roll,
      summary: "Success",
      detail: "10 or higher — mark 1 success.",
    };
  }
  return {
    outcome: "failure",
    roll,
    summary: "Failure",
    detail: "9 or lower — mark 1 failure.",
  };
}

export interface DeathSaveApplyResult {
  combat: CharacterData["combat"];
  becameStable: boolean;
  becameDead: boolean;
  regainedConsciousness: boolean;
}

/** Apply a death saving throw roll to combat state (PHB rules). */
export function applyDeathSaveRoll(
  combat: CharacterData["combat"],
  roll: number
): DeathSaveApplyResult {
  const interpretation = interpretDeathSaveRoll(roll);
  let successes = combat.deathSaves.successes;
  let failures = combat.deathSaves.failures;
  let currentHp = combat.currentHp;
  let becameStable = false;
  let becameDead = false;
  let regainedConsciousness = false;

  if (interpretation.outcome === "natural-20") {
    currentHp = 1;
    successes = 0;
    failures = 0;
    regainedConsciousness = true;
  } else if (interpretation.outcome === "natural-1") {
    failures = Math.min(3, failures + 2);
  } else if (interpretation.outcome === "success") {
    successes = Math.min(3, successes + 1);
  } else {
    failures = Math.min(3, failures + 1);
  }

  if (interpretation.outcome !== "natural-20" && successes >= 3) {
    becameStable = true;
    successes = 0;
    failures = 0;
  }

  if (failures >= 3) {
    becameDead = true;
    failures = 3;
  }

  return {
    combat: {
      ...combat,
      currentHp,
      deathSaves: { successes, failures },
    },
    becameStable,
    becameDead,
    regainedConsciousness,
  };
}
