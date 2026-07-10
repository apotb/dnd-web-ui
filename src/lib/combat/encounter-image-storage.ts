import type { SupabaseClient } from "@supabase/supabase-js";
import {
  copyCombatImage,
  removeCombatImageIfUnreferenced,
} from "@/lib/combat/storage";
import type {
  SavedEncounterData,
  SavedEncounterMarker,
} from "@/lib/schemas/saved-encounter";

export type EncounterSavePayload = {
  backgroundPath: string | null;
  gridWidth: number;
  gridHeight: number;
  tileFeet: number;
  blockedCells: unknown;
  data: SavedEncounterData;
  totalCr: number;
};

export function isEncounterOwnedImagePath(
  path: string,
  encounterId: string
): boolean {
  return path.startsWith(`encounters/${encounterId}/`);
}

function encounterImageDestPath(
  encounterId: string,
  label: string,
  sourcePath: string
): string {
  const fileName = sourcePath.split("/").pop() ?? "image";
  const safeName = fileName.replace(/[^a-zA-Z0-9._-]/g, "_");
  return `encounters/${encounterId}/${label}-${Date.now()}-${safeName}`;
}

async function clonePathForEncounter(
  supabase: SupabaseClient,
  encounterId: string,
  sourcePath: string | null | undefined,
  label: string
): Promise<{ path: string | null; error: string | null }> {
  if (!sourcePath) return { path: null, error: null };
  if (sourcePath.startsWith("http://") || sourcePath.startsWith("https://")) {
    return { path: sourcePath, error: null };
  }
  if (isEncounterOwnedImagePath(sourcePath, encounterId)) {
    return { path: sourcePath, error: null };
  }

  const toPath = encounterImageDestPath(encounterId, label, sourcePath);
  return copyCombatImage(supabase, sourcePath, toPath);
}

export async function cloneEncounterPayloadImages(
  supabase: SupabaseClient,
  encounterId: string,
  payload: EncounterSavePayload
): Promise<{ payload: EncounterSavePayload; error: string | null }> {
  const backgroundResult = await clonePathForEncounter(
    supabase,
    encounterId,
    payload.backgroundPath,
    "background"
  );
  if (backgroundResult.error) {
    return { payload, error: backgroundResult.error };
  }

  const markers: SavedEncounterMarker[] = [];
  for (let index = 0; index < payload.data.markers.length; index += 1) {
    const marker = payload.data.markers[index];
    const portraitResult = await clonePathForEncounter(
      supabase,
      encounterId,
      marker.portraitPath,
      `marker-${index}`
    );
    if (portraitResult.error) {
      return { payload, error: portraitResult.error };
    }
    markers.push({
      ...marker,
      portraitPath: portraitResult.path ?? marker.portraitPath,
    });
  }

  return {
    payload: {
      ...payload,
      backgroundPath: backgroundResult.path ?? payload.backgroundPath,
      data: { ...payload.data, markers },
    },
    error: null,
  };
}

export async function cleanupEncounterOwnedImages(
  supabase: SupabaseClient,
  encounterId: string,
  backgroundPath: string | null,
  data: SavedEncounterData
): Promise<void> {
  const paths = new Set<string>();
  if (
    backgroundPath &&
    isEncounterOwnedImagePath(backgroundPath, encounterId)
  ) {
    paths.add(backgroundPath);
  }
  for (const marker of data.markers) {
    if (
      marker.portraitPath &&
      isEncounterOwnedImagePath(marker.portraitPath, encounterId)
    ) {
      paths.add(marker.portraitPath);
    }
  }

  for (const path of paths) {
    await removeCombatImageIfUnreferenced(supabase, path);
  }
}
