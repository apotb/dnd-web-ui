import type { ParsedCharacter } from "@/lib/character/utils";
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

  return {
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
  };
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
