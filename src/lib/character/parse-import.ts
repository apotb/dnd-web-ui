import {
  characterExportSchema,
  safeParseCharacterData,
  type CharacterData,
} from "@/lib/schemas/character";

export interface ParsedCharacterImport {
  name: string;
  playerName: string;
  data: CharacterData;
}

export function parseCharacterImportJson(
  input: unknown,
  fallbacks?: { name?: string; playerName?: string }
): ParsedCharacterImport | null {
  const exportResult = characterExportSchema.safeParse(input);
  if (exportResult.success) {
    return {
      name: exportResult.data.name,
      playerName: exportResult.data.playerName,
      data: exportResult.data.data,
    };
  }

  const dataResult = safeParseCharacterData(input);
  if (dataResult.success) {
    return {
      name: dataResult.data.basicInfo.name || fallbacks?.name || "Imported Character",
      playerName:
        dataResult.data.basicInfo.playerName || fallbacks?.playerName || "",
      data: dataResult.data,
    };
  }

  return null;
}

export async function parseCharacterImportFile(
  file: File,
  fallbacks?: { name?: string; playerName?: string }
): Promise<ParsedCharacterImport> {
  const text = await file.text();
  const parsed = JSON.parse(text) as unknown;
  const result = parseCharacterImportJson(parsed, fallbacks);
  if (!result) {
    throw new Error("Invalid character JSON");
  }
  return result;
}
