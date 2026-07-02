import type { ParsedCharacter } from "@/lib/character/utils";
import { registerBattleParticipants } from "@/lib/combat/battle-participants";
import { getPartyTokenLabel } from "@/lib/combat/party-token-label";
import type { CombatState, CombatToken } from "@/lib/schemas/combat-state";
import { combatTokenSchema } from "@/lib/schemas/combat-state";
import type { SavedEncounterCharacterSlot } from "@/lib/schemas/saved-encounter";

export const CHARACTER_SLOT_NAME = "Character";

export function isCharacterPlaceholder(token: CombatToken): boolean {
  return token.kind === "party" && token.characterId == null;
}

export function hasUnclaimedCharacterPlaceholders(state: CombatState): boolean {
  return state.tokens.some(isCharacterPlaceholder);
}

export function createCharacterPlaceholderToken(
  slot: SavedEncounterCharacterSlot
): CombatToken {
  return combatTokenSchema.parse({
    id: crypto.randomUUID(),
    kind: "party",
    name: CHARACTER_SLOT_NAME,
    label: CHARACTER_SLOT_NAME,
    x: slot.x,
    y: slot.y,
    width: slot.width,
    height: slot.height,
    placed: true,
    portraitPath: null,
  });
}

export function assignCharacterToPlaceholder(
  state: CombatState,
  tokenId: string,
  character: ParsedCharacter
): CombatState {
  const token = state.tokens.find((entry) => entry.id === tokenId);
  if (!token || !isCharacterPlaceholder(token)) return state;

  const excluded = state.excludedPartyCharacterIds.filter((id) => id !== character.id);

  return registerBattleParticipants(
    {
      ...state,
      excludedPartyCharacterIds: excluded,
      tokens: state.tokens.map((entry) =>
        entry.id === tokenId
          ? combatTokenSchema.parse({
              ...entry,
              id: character.id,
              characterId: character.id,
              name: character.name,
              label: getPartyTokenLabel(character.name),
              portraitPath: character.data.basicInfo.portrait || null,
              currentHp: character.data.combat.currentHp,
              maxHp: character.data.combat.maxHp,
            })
          : entry
      ),
    },
    [character.id]
  );
}

export function canPlayerClaimPlaceholder(
  token: CombatToken,
  ownedCharacter: ParsedCharacter | null,
  presentCharacterIds: Set<string>
): boolean {
  if (!isCharacterPlaceholder(token)) return false;
  if (!ownedCharacter) return false;
  if (presentCharacterIds.has(ownedCharacter.id)) return false;
  return true;
}

function sortPlaceholdersLeftToRightTopToBottom(a: CombatToken, b: CombatToken): number {
  if (a.y !== b.y) return a.y - b.y;
  return a.x - b.x;
}

/** Assign campaign characters to placeholder slots alphabetically, left to right, top to bottom. */
export function populateCharacterPlaceholders(
  state: CombatState,
  characters: ParsedCharacter[]
): CombatState {
  const placeholders = state.tokens
    .filter(isCharacterPlaceholder)
    .sort(sortPlaceholdersLeftToRightTopToBottom);
  if (placeholders.length === 0 || characters.length === 0) return state;

  const presentIds = new Set(
    state.tokens
      .filter((token) => token.kind === "party" && token.characterId)
      .map((token) => token.characterId!)
  );

  const available = characters
    .filter((character) => !presentIds.has(character.id))
    .sort((a, b) => a.name.localeCompare(b.name));
  if (available.length === 0) return state;

  const pairCount = Math.min(placeholders.length, available.length);

  let next = state;
  for (let i = 0; i < pairCount; i++) {
    next = assignCharacterToPlaceholder(next, placeholders[i].id, available[i]);
  }
  return next;
}
